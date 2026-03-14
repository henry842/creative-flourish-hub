import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, makeHeaders, checkRateLimit, rateLimitResponse,
  verifyAuth, isValidUUID, logSecurityEvent, fetchWithTimeout,
} from "../_shared/security.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const NEWS_API_URL = "https://newsapi.org/v2/everything";

async function fetchNews(tickers: string[], newsApiKey: string): Promise<string> {
  try {
    const queries = tickers.length > 0 ? tickers.slice(0, 5).join(" OR ") : "mercado financeiro Brasil OR Selic OR IFIX OR IPCA";
    const params = new URLSearchParams({ q: queries, language: "pt", sortBy: "publishedAt", pageSize: "10", apiKey: newsApiKey });

    const response = await fetchWithTimeout(`${NEWS_API_URL}?${params}`, {}, 15000);
    if (!response.ok) return "⚠️ Não foi possível buscar notícias hoje.";

    const data = await response.json();
    const articles = data.articles || [];
    if (articles.length === 0) return "Nenhuma notícia relevante encontrada hoje.";

    return articles.slice(0, 8).map((a: any, i: number) =>
      `${i + 1}. **${a.title}** — ${a.source?.name || "Fonte"} (${new Date(a.publishedAt).toLocaleDateString("pt-BR")})\n   ${a.description || ""}`
    ).join("\n\n");
  } catch {
    return "⚠️ Não foi possível buscar notícias hoje.";
  }
}

async function callGroq(messages: any[], groqApiKey: string): Promise<string> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  for (const model of models) {
    const res = await fetchWithTimeout(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages }),
    }, 30000);
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
    const errText = await res.text();
    console.error(`Groq model ${model} failed (${res.status}):`, errText);
    if (res.status === 429) continue;
    if (res.status >= 400 && res.status < 500) throw new Error(`Groq error ${res.status}`);
  }
  throw new Error("All Groq models unavailable");
}

async function incrementUsage(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("groq_usage").select("id, request_count").eq("user_id", userId).eq("date", today).maybeSingle();
  if (data) {
    await supabase.from("groq_usage").update({ request_count: data.request_count + 1, updated_at: new Date().toISOString() }).eq("id", data.id);
  } else {
    await supabase.from("groq_usage").insert({ user_id: userId, date: today, request_count: 1 });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determine mode
    let userIds: string[] = [];

    try {
      const body = await req.json();
      if (body.user_id) {
        // Validate UUID
        if (!isValidUUID(body.user_id)) {
          return new Response(JSON.stringify({ error: "user_id inválido" }), { status: 400, headers: makeHeaders() });
        }

        // For single-user mode, verify auth and rate limit
        const { user, error: authError } = await verifyAuth(req);
        if (authError || !user) {
          // Allow cron (no auth) but validate user_id format
          if (req.headers.get("Authorization")) return authError!;
        }

        // Rate limit: 5/day per user
        const rl = checkRateLimit(`brief:${body.user_id}`, 5, 86400000);
        if (!rl.allowed) {
          await logSecurityEvent(supabase, { user_id: body.user_id, event_type: "rate_limit_exceeded", details: "generate-brief: 5/day limit", ip_address: ip });
          return rateLimitResponse(rl.retryAfterMs);
        }

        userIds = [body.user_id];
      }
    } catch { /* No body = cron mode */ }

    if (userIds.length === 0) {
      const now = new Date();
      const currentHour = now.getUTCHours().toString().padStart(2, "0");
      const { data: activeBriefs } = await supabase.from("scheduled_briefs").select("user_id, schedule_time").eq("is_active", true);
      if (activeBriefs) {
        for (const brief of activeBriefs) {
          const briefHour = brief.schedule_time?.substring(0, 2);
          if (briefHour === currentHour) userIds.push(brief.user_id);
        }
      }
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users to process" }), { headers: makeHeaders() });
    }

    const results = [];
    for (const userId of userIds) {
      try {
        await generateBriefForUser(supabase, userId, GROQ_API_KEY, NEWS_API_KEY);
        await incrementUsage(supabase, userId);
        results.push({ userId, success: true });
      } catch (err) {
        console.error(`Error generating brief for user ${userId}:`, err);
        results.push({ userId, success: false, error: String(err) });
      }
    }

    const successUserIds = results.filter((r) => r.success).map((r) => r.userId);
    if (successUserIds.length > 0) {
      await supabase.from("scheduled_briefs").update({ last_run_at: new Date().toISOString() }).in("user_id", successUserIds);
    }

    return new Response(JSON.stringify({ results }), { headers: makeHeaders() });
  } catch (error) {
    console.error("generate-brief error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: makeHeaders() });
  }
});

async function generateBriefForUser(supabase: any, userId: string, groqApiKey: string, newsApiKey: string | undefined) {
  const { data: config } = await supabase.from("scheduled_briefs").select("*").eq("user_id", userId).eq("is_active", true).single();
  if (!config) throw new Error("No active briefing config found");

  const { data: briefAssets } = await supabase.from("scheduled_brief_assets").select("asset_id, assets(name, ticker)").eq("scheduled_brief_id", config.id);
  const tickers = (briefAssets || []).map((ba: any) => ba.assets?.ticker).filter(Boolean);
  const assetNames = (briefAssets || []).map((ba: any) => `${ba.assets?.name} (${ba.assets?.ticker || "sem ticker"})`).filter(Boolean);

  const assetIds = (briefAssets || []).map((ba: any) => ba.asset_id);
  let healthData = "";
  if (assetIds.length > 0) {
    const { data: scores } = await supabase.from("health_scores").select("ticker, overall_score, sentiment, summary, revenue_growth, debt_level, net_margin").eq("user_id", userId).in("asset_id", assetIds).order("created_at", { ascending: false }).limit(assetIds.length);
    if (scores?.length > 0) {
      healthData = scores.map((s: any) => `${s.ticker || "?"}: Score ${s.overall_score}/100, Sentimento: ${s.sentiment}, Margem: ${s.net_margin}%, Crescimento: ${s.revenue_growth}%, Endividamento: ${s.debt_level}/100`).join("\n");
    }
  }

  let newsContent = "";
  if ((config.include_news || config.include_macro) && newsApiKey) {
    newsContent = await fetchNews(tickers, newsApiKey);
  } else if (config.include_news || config.include_macro) {
    newsContent = "⚠️ NEWS_API_KEY não configurada.";
  }

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const content = await callGroq([
    { role: "system", content: "Você é um analista financeiro expert em mercado brasileiro. Gere briefings concisos e actionable." },
    { role: "user", content: `Gere um briefing diário.\n\nData: ${today}\nATIVOS: ${assetNames.length > 0 ? assetNames.join(", ") : "Nenhum"}\nSCORES:\n${healthData || "N/A"}\nNOTÍCIAS:\n${newsContent || "N/A"}\n\nFormate em markdown com emojis. Seções: Seus Ativos, Mercado, Ações Recomendadas.` }
  ], groqApiKey);

  if (!content) throw new Error("Empty response from AI");

  const { error } = await supabase.from("daily_briefs").insert({ user_id: userId, content, tickers: tickers.length > 0 ? tickers : [] });
  if (error) throw new Error(`Failed to save brief: ${error.message}`);
  return content;
}
