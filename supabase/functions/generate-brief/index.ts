import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const NEWS_API_URL = "https://newsapi.org/v2/everything";

async function fetchNews(tickers: string[], newsApiKey: string): Promise<string> {
  try {
    const queries = tickers.length > 0
      ? tickers.slice(0, 5).join(" OR ")
      : "mercado financeiro Brasil OR Selic OR IFIX OR IPCA";

    const params = new URLSearchParams({
      q: queries,
      language: "pt",
      sortBy: "publishedAt",
      pageSize: "10",
      apiKey: newsApiKey,
    });

    const response = await fetch(`${NEWS_API_URL}?${params}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error("NewsAPI error:", response.status, errText);
      return "⚠️ Não foi possível buscar notícias hoje.";
    }

    const data = await response.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      return "Nenhuma notícia relevante encontrada hoje.";
    }

    return articles
      .slice(0, 8)
      .map((a: any, i: number) => `${i + 1}. **${a.title}** — ${a.source?.name || "Fonte"} (${new Date(a.publishedAt).toLocaleDateString("pt-BR")})\n   ${a.description || ""}`)
      .join("\n\n");
  } catch (err) {
    console.error("NewsAPI fetch error:", err);
    return "⚠️ Não foi possível buscar notícias hoje.";
  }
}

async function callGroq(messages: any[], groqApiKey: string): Promise<string> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  for (const model of models) {
    console.log(`Trying Groq model: ${model}`);
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    const errText = await res.text();
    console.error(`Groq model ${model} failed (${res.status}):`, errText);

    if (res.status === 429) continue;
    if (res.status >= 400 && res.status < 500) {
      throw new Error(`Groq error ${res.status}: ${errText}`);
    }
  }

  throw new Error("All Groq models unavailable. Try again later.");
}

async function incrementUsage(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("groq_usage")
    .select("id, request_count")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (data) {
    await supabase
      .from("groq_usage")
      .update({ request_count: data.request_count + 1, updated_at: new Date().toISOString() })
      .eq("id", data.id);
  } else {
    await supabase
      .from("groq_usage")
      .insert({ user_id: userId, date: today, request_count: 1 });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine mode: single user or cron (all active users)
    let userIds: string[] = [];

    try {
      const body = await req.json();
      if (body.user_id) {
        userIds = [body.user_id];
      }
    } catch {
      // No body = cron mode
    }

    if (userIds.length === 0) {
      const now = new Date();
      const currentHour = now.getUTCHours().toString().padStart(2, "0");

      const { data: activeBriefs } = await supabase
        .from("scheduled_briefs")
        .select("user_id, schedule_time")
        .eq("is_active", true);

      if (activeBriefs) {
        for (const brief of activeBriefs) {
          const briefHour = brief.schedule_time?.substring(0, 2);
          if (briefHour === currentHour) {
            userIds.push(brief.user_id);
          }
        }
      }
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const userId of userIds) {
      try {
        await generateBriefForUser(supabase, userId, GROQ_API_KEY, NEWS_API_KEY);
        await incrementUsage(supabase, userId);
        results.push({ userId, success: true });
        console.log(`Brief generated for user ${userId}`);
      } catch (err) {
        console.error(`Error generating brief for user ${userId}:`, err);
        results.push({ userId, success: false, error: String(err) });
      }
    }

    // Update last_run_at for processed users
    const successUserIds = results.filter((r) => r.success).map((r) => r.userId);
    if (successUserIds.length > 0) {
      await supabase
        .from("scheduled_briefs")
        .update({ last_run_at: new Date().toISOString() })
        .in("user_id", successUserIds);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-brief error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateBriefForUser(
  supabase: any,
  userId: string,
  groqApiKey: string,
  newsApiKey: string | undefined
) {
  // 1. Get user's scheduled brief config
  const { data: config } = await supabase
    .from("scheduled_briefs")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!config) throw new Error("No active briefing config found");

  // 2. Get linked assets
  const { data: briefAssets } = await supabase
    .from("scheduled_brief_assets")
    .select("asset_id, assets(name, ticker)")
    .eq("scheduled_brief_id", config.id);

  const tickers = (briefAssets || [])
    .map((ba: any) => ba.assets?.ticker)
    .filter(Boolean);

  const assetNames = (briefAssets || [])
    .map((ba: any) => `${ba.assets?.name} (${ba.assets?.ticker || "sem ticker"})`)
    .filter(Boolean);

  // 3. Get latest health scores for these assets
  const assetIds = (briefAssets || []).map((ba: any) => ba.asset_id);
  let healthData = "";
  if (assetIds.length > 0) {
    const { data: scores } = await supabase
      .from("health_scores")
      .select("ticker, overall_score, sentiment, summary, revenue_growth, debt_level, net_margin")
      .eq("user_id", userId)
      .in("asset_id", assetIds)
      .order("created_at", { ascending: false })
      .limit(assetIds.length);

    if (scores && scores.length > 0) {
      healthData = scores
        .map(
          (s: any) =>
            `${s.ticker || "?"}: Score ${s.overall_score}/100, Sentimento: ${s.sentiment}, Margem: ${s.net_margin}%, Crescimento Receita: ${s.revenue_growth}%, Endividamento: ${s.debt_level}/100`
        )
        .join("\n");
    }
  }

  // 4. Fetch news via NewsAPI (free, no Lovable credits)
  let newsContent = "";
  if ((config.include_news || config.include_macro) && newsApiKey) {
    newsContent = await fetchNews(tickers, newsApiKey);
  } else if (config.include_news || config.include_macro) {
    newsContent = "⚠️ NEWS_API_KEY não configurada. Configure em Configurações para receber notícias.";
  }

  // 5. Generate the final briefing using Groq (free)
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const briefingPrompt = `Você é um analista financeiro pessoal. Gere um briefing diário para o investidor.

Data de hoje: ${today}

ATIVOS DO INVESTIDOR:
${assetNames.length > 0 ? assetNames.join("\n") : "Nenhum ativo configurado"}

DADOS INTERNOS (Health Scores):
${healthData || "Nenhum score disponível"}

NOTÍCIAS E DADOS DE MERCADO:
${newsContent || "Sem dados de mercado disponíveis"}

INSTRUÇÕES:
- Formate o briefing em markdown
- Use emojis para tornar visual (📊 🏦 📈 📰 ⚡ 🔴 🟢 🟡)
- Comece com "📊 Seu briefing de hoje — ${today}"
- Seções: Seus Ativos (com scores e sentimento), Mercado Hoje (notícias relevantes), Ações Recomendadas
- Seja conciso e actionable
- Se não houver dados para alguma seção, indique isso brevemente
- Termine com uma recomendação de ação clara`;

  const content = await callGroq(
    [
      {
        role: "system",
        content: "Você é um analista financeiro expert em mercado brasileiro. Gere briefings concisos e actionable.",
      },
      { role: "user", content: briefingPrompt },
    ],
    groqApiKey
  );

  if (!content) throw new Error("Empty response from AI");

  // 6. Save to daily_briefs
  const { error: insertError } = await supabase.from("daily_briefs").insert({
    user_id: userId,
    content,
    tickers: tickers.length > 0 ? tickers : [],
  });

  if (insertError) throw new Error(`Failed to save brief: ${insertError.message}`);

  return content;
}
