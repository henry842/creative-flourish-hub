/**
 * Daily briefing generation.
 *
 * Prefers the `generate-brief` Edge Function (which can also pull news). When that is
 * unavailable, composes the briefing in the browser from the user's own portfolio data
 * so the feature still delivers something useful and grounded.
 */
import { supabase } from "@/integrations/supabase/client";
import { chatOnce, getAIConfig, AINotConfiguredError } from "@/lib/ai";

const SYSTEM = `Você é um analista financeiro que escreve briefings diários curtos em português do Brasil.
Regras:
- Baseie-se SOMENTE nos dados fornecidos; nunca invente números, notícias ou preços.
- Estruture em markdown com seções curtas e bullets objetivos.
- Comece por um resumo de uma frase, depois destaques por ativo e, por fim, pontos de atenção.
- Não faça recomendação de compra ou venda; descreva o que os dados mostram.`;

export interface BriefResult {
  content: string;
  tickers: string[];
  source: "server" | "local";
}

/** Pulls the portfolio snapshot the local briefing is grounded on. */
async function buildSnapshot(userId: string) {
  const [assetsRes, scoresRes, watchRes] = await Promise.all([
    supabase.from("assets").select("id, name, ticker, asset_type").eq("user_id", userId),
    supabase
      .from("health_scores")
      .select("ticker, asset_id, overall_score, sentiment, summary, red_flags, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("watchlist").select("ticker").eq("user_id", userId),
  ]);

  const assets = assetsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const watch = (watchRes.data ?? []).map((w) => w.ticker);

  // latest + previous score per ticker, to describe movement
  const byTicker = new Map<string, typeof scores>();
  for (const s of scores) {
    if (!s.ticker) continue;
    const arr = byTicker.get(s.ticker) ?? [];
    arr.push(s);
    byTicker.set(s.ticker, arr);
  }

  const lines: string[] = [];
  const tickers: string[] = [];

  for (const [ticker, rows] of byTicker) {
    const latest = rows[0];
    const prev = rows[1];
    const delta = prev ? latest.overall_score - prev.overall_score : null;
    const flags = Array.isArray(latest.red_flags) ? latest.red_flags.length : 0;
    const asset = assets.find((a) => a.ticker === ticker);
    tickers.push(ticker);
    lines.push(
      `- ${ticker}${asset ? ` (${asset.name})` : ""}: score ${latest.overall_score}/100, ` +
        `sentimento ${latest.sentiment ?? "neutro"}, ` +
        `${delta === null ? "primeira análise" : `variação ${delta >= 0 ? "+" : ""}${delta} vs. anterior`}, ` +
        `${flags} ponto(s) de atenção. ` +
        `Resumo: ${String(latest.summary ?? "").slice(0, 300)}`
    );
  }

  const untracked = watch.filter((t) => !tickers.includes(t));

  return {
    tickers: [...new Set([...tickers, ...watch])],
    text:
      (lines.length ? `Ativos analisados:\n${lines.join("\n")}` : "Nenhum ativo analisado ainda.") +
      (untracked.length
        ? `\n\nNa watchlist, ainda sem análise: ${untracked.join(", ")}.`
        : ""),
    hasData: lines.length > 0 || watch.length > 0,
  };
}

export async function generateBrief(userId: string): Promise<BriefResult> {
  // ── path 1: server function (may enrich with real news)
  try {
    const { data, error } = await supabase.functions.invoke("generate-brief", {
      body: { user_id: userId },
    });
    if (!error) {
      const { data: latest } = await supabase
        .from("daily_briefs")
        .select("content, tickers")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.content) {
        return { content: latest.content, tickers: latest.tickers ?? [], source: "server" };
      }
      if (typeof (data as any)?.content === "string") {
        return { content: (data as any).content, tickers: [], source: "server" };
      }
    }
  } catch {
    /* fall through */
  }

  // ── path 2: compose it here
  if (!getAIConfig()) throw new AINotConfiguredError();

  const snapshot = await buildSnapshot(userId);
  if (!snapshot.hasData) {
    throw new Error(
      "Ainda não há dados para o briefing. Analise ao menos um documento ou adicione tickers à watchlist."
    );
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const content = await chatOnce(
    [
      {
        role: "user",
        content: `Escreva o briefing de hoje (${today}) para esta carteira.\n\n${snapshot.text}`,
      },
    ],
    { systemPrompt: SYSTEM }
  );

  await supabase.from("daily_briefs").insert({
    user_id: userId,
    content,
    tickers: snapshot.tickers,
  });

  return { content, tickers: snapshot.tickers, source: "local" };
}
