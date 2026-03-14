import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
      // Cron mode: find all active users whose schedule_time matches current hour
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
        const briefContent = await generateBriefForUser(supabase, userId, LOVABLE_API_KEY);
        results.push({ userId, success: true });
        console.log(`Brief generated for user ${userId}`);
      } catch (err) {
        console.error(`Error generating brief for user ${userId}:`, err);
        results.push({ userId, success: false, error: String(err) });
      }
    }

    // Update last_run_at for processed users
    const successUserIds = results.filter(r => r.success).map(r => r.userId);
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
  apiKey: string
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

  // 4. Search real news via Perplexity/Sonar through Lovable AI Gateway
  let newsContent = "";
  if (config.include_news || config.include_macro) {
    const tickerList = tickers.length > 0 ? tickers.join(", ") : "mercado financeiro brasileiro";
    const newsPrompt = `Quais são as principais notícias financeiras do Brasil hoje? Inclua: variação do IFIX, decisão do Banco Central sobre Selic, IPCA mais recente, e notícias sobre os seguintes tickers: ${tickerList}. Responda em português de forma concisa.`;

    try {
      const newsResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "perplexity/sonar",
            messages: [{ role: "user", content: newsPrompt }],
          }),
        }
      );

      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        newsContent = newsData.choices?.[0]?.message?.content || "";
      } else {
        console.error("News search failed:", newsResponse.status);
        newsContent = "⚠️ Não foi possível buscar notícias em tempo real hoje.";
      }
    } catch (err) {
      console.error("News search error:", err);
      newsContent = "⚠️ Não foi possível buscar notícias em tempo real hoje.";
    }
  }

  // 5. Generate the final briefing using Gemini Flash
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

NOTÍCIAS E DADOS DE MERCADO (fonte: busca em tempo real):
${newsContent || "Sem dados de mercado disponíveis"}

INSTRUÇÕES:
- Formate o briefing em markdown
- Use emojis para tornar visual (📊 🏦 📈 📰 ⚡ 🔴 🟢 🟡)
- Comece com "📊 Seu briefing de hoje — ${today}"
- Seções: Seus Ativos (com scores e sentimento), Mercado Hoje (IFIX, Selic, IPCA), Notícias Relevantes, Ações Recomendadas
- Seja conciso e actionable
- Se não houver dados para alguma seção, indique isso brevemente
- Termine com uma recomendação de ação clara`;

  const briefResponse = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um analista financeiro expert em mercado brasileiro. Gere briefings concisos e actionable.",
          },
          { role: "user", content: briefingPrompt },
        ],
      }),
    }
  );

  if (!briefResponse.ok) {
    const status = briefResponse.status;
    if (status === 429) throw new Error("Rate limit exceeded. Try again later.");
    if (status === 402) throw new Error("Payment required. Add credits to your workspace.");
    throw new Error(`AI gateway error: ${status}`);
  }

  const briefData = await briefResponse.json();
  const content = briefData.choices?.[0]?.message?.content;

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
