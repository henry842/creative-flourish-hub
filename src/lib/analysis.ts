/**
 * Document analysis.
 *
 * Mirrors the `analyze-document` Edge Function so the feature works with or without a
 * backend: it tries the function first, and otherwise runs the same prompt and the same
 * database writes from the browser using the user's own key.
 */
import { supabase } from "@/integrations/supabase/client";
import { generateStructured, getAIConfig, AINotConfiguredError } from "@/lib/ai";
import { extractPdfText } from "@/lib/pdf";

export interface DocumentAnalysis {
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  price_target_low: number | null;
  price_target_high: number | null;
  price_target_rationale: string | null;
  red_flags: string[];
  timeline_events: { date: string; event: string }[];
}

export type AnalysisStage =
  | "reading"      // pulling the file / text
  | "extracting"   // parsing the PDF
  | "analyzing"    // model call
  | "saving";

const SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "integer" },
    revenue_growth: { type: "integer" },
    net_margin: { type: "integer" },
    debt_level: { type: "integer" },
    earnings_quality: { type: "integer" },
    regulatory_risk: { type: "integer" },
    sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"] },
    confidence: { type: "number" },
    summary: { type: "string" },
    price_target_low: { type: "integer" },
    price_target_high: { type: "integer" },
    price_target_rationale: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    timeline_events: {
      type: "array",
      items: {
        type: "object",
        properties: { date: { type: "string" }, event: { type: "string" } },
        required: ["date", "event"],
      },
    },
  },
  required: [
    "overall_score", "revenue_growth", "net_margin", "debt_level", "earnings_quality",
    "regulatory_risk", "sentiment", "confidence", "summary", "price_target_low",
    "price_target_high", "price_target_rationale", "red_flags", "timeline_events",
  ],
  additionalProperties: false,
} as const;

function systemPrompt(customPrompt?: string | null) {
  return `Você é um especialista multidisciplinar capaz de analisar qualquer tipo de documento: financeiro, científico, jurídico, médico, técnico, acadêmico, jornalístico ou qualquer outra área.

PASSO 1 — IDENTIFIQUE O TIPO:
Leia o documento e classifique em uma dessas categorias:
- Financeiro (FII, ações, balanços, relatórios)
- Científico/Acadêmico (artigos, pesquisas, teses)
- Jurídico (contratos, leis, processos)
- Médico/Saúde (laudos, bulas, estudos clínicos)
- Técnico (manuais, especificações, engenharia)
- Jornalístico (notícias, reportagens)
- Outro (qualquer documento não listado acima)

PASSO 2 — ADAPTE A ANÁLISE conforme o tipo.

PASSO 3 — ADAPTE OS SCORES:
- revenue_growth → relevância/impacto (0-100)
- net_margin → qualidade das informações (0-100)
- debt_level → clareza e organização (0-100)
- earnings_quality → confiabilidade das fontes (0-100)
- regulatory_risk → risco regulatório 0-100 (0=sem risco, 100=máximo)

PASSO 4 — REGRAS UNIVERSAIS:
1. Nunca invente informações
2. Summary em português claro
3. Red flags = pontos críticos
4. Timeline = eventos importantes
5. Se uma métrica não puder ser determinada, use 50${customPrompt ? `\n\nCONTEXTO DO USUÁRIO: ${customPrompt}` : ""}`;
}

const clamp = (n: unknown, lo = 0, hi = 100) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 50;
};

/** Never trust model output shape — normalise before it reaches the database or UI. */
function normalise(raw: any): DocumentAnalysis {
  const sentiment = ["bullish", "bearish", "neutral"].includes(raw?.sentiment)
    ? raw.sentiment
    : "neutral";

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  return {
    overall_score: clamp(raw?.overall_score),
    revenue_growth: clamp(raw?.revenue_growth),
    net_margin: clamp(raw?.net_margin),
    debt_level: clamp(raw?.debt_level),
    earnings_quality: clamp(raw?.earnings_quality),
    regulatory_risk: clamp(raw?.regulatory_risk),
    sentiment,
    confidence: Math.min(1, Math.max(0, Number(raw?.confidence) || 0.5)),
    summary: String(raw?.summary ?? "").slice(0, 4000) || "Sem resumo disponível.",
    price_target_low: num(raw?.price_target_low),
    price_target_high: num(raw?.price_target_high),
    price_target_rationale: raw?.price_target_rationale
      ? String(raw.price_target_rationale).slice(0, 1000)
      : null,
    red_flags: Array.isArray(raw?.red_flags)
      ? raw.red_flags.map((f: unknown) => String(f)).filter(Boolean).slice(0, 12)
      : [],
    timeline_events: Array.isArray(raw?.timeline_events)
      ? raw.timeline_events
          .filter((e: any) => e && (e.date || e.event))
          .map((e: any) => ({ date: String(e.date ?? ""), event: String(e.event ?? "") }))
          .slice(0, 20)
      : [],
  };
}

async function bumpUsage(userId: string) {
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
    await supabase.from("groq_usage").insert({ user_id: userId, date: today, request_count: 1 });
  }
}

/** Thrown when a scanned PDF yields no text — the UI offers manual entry. */
export class NoTextInPdfError extends Error {
  constructor() {
    super(
      "Não foi possível ler texto deste PDF (provavelmente digitalizado). Use “Editar texto” no documento e cole o conteúdo para analisar."
    );
    this.name = "NoTextInPdfError";
  }
}

interface AnalyzeArgs {
  documentId: string;
  userId: string;
  ticker?: string | null;
  assetId?: string | null;
  onStage?: (stage: AnalysisStage, detail?: string) => void;
  signal?: AbortSignal;
}

/** Ensures `documents.extracted_text` is populated, parsing the PDF here if needed. */
async function ensureText(
  documentId: string,
  onStage?: AnalyzeArgs["onStage"]
): Promise<string> {
  onStage?.("reading");
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, name, file_path, extracted_text")
    .eq("id", documentId)
    .single();

  if (error || !doc) throw new Error("Documento não encontrado.");

  const existing = (doc.extracted_text ?? "").trim();
  const unusable =
    existing.length < 200 ||
    /falha na extração|não foi possível extrair|use o botão editar/i.test(existing);
  if (!unusable) return existing;

  const { data: blob, error: dlErr } = await supabase.storage
    .from("documents")
    .download(doc.file_path);
  if (dlErr || !blob) throw new Error("Não foi possível baixar o arquivo do documento.");

  onStage?.("extracting");
  const { text, needsManualText } = await extractPdfText(blob, (p, t) =>
    onStage?.("extracting", `página ${p} de ${t}`)
  );
  if (needsManualText) throw new NoTextInPdfError();

  await supabase.from("documents").update({ extracted_text: text }).eq("id", documentId);

  return text;
}

/**
 * Analyses a document and persists the results, exactly as the Edge Function does.
 * Prefers the server; falls back to the browser when it is unavailable.
 */
export async function analyzeDocument(args: AnalyzeArgs): Promise<DocumentAnalysis> {
  const { documentId, userId, ticker, assetId, onStage, signal } = args;

  // ── path 1: server-side function (keeps the key off the client when deployed)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      onStage?.("analyzing");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ document_id: documentId, ticker, asset_id: assetId }),
          signal,
        }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.analysis) return normalise(json.analysis);
      }
    }
  } catch {
    /* fall through to the browser path */
  }

  // ── path 2: run it here
  if (!getAIConfig()) throw new AINotConfiguredError();

  const text = await ensureText(documentId, onStage);

  const { data: profile } = await supabase
    .from("profiles")
    .select("custom_prompt")
    .eq("user_id", userId)
    .maybeSingle();

  onStage?.("analyzing");
  const raw = await generateStructured<DocumentAnalysis>({
    system: systemPrompt(profile?.custom_prompt),
    user: `Analise este documento${ticker ? ` (ticker: ${ticker})` : ""}:\n\n${text.slice(0, 8000)}`,
    schemaName: "submit_financial_analysis",
    schema: SCHEMA as unknown as Record<string, unknown>,
    signal,
  });

  const analysis = normalise(raw);

  onStage?.("saving");
  await supabase.from("health_scores").delete().eq("document_id", documentId).eq("user_id", userId);
  await supabase.from("sentiment_analyses").delete().eq("document_id", documentId).eq("user_id", userId);

  await supabase.from("health_scores").insert({
    user_id: userId,
    document_id: documentId,
    asset_id: assetId || null,
    ticker: ticker || null,
    overall_score: analysis.overall_score,
    revenue_growth: analysis.revenue_growth,
    net_margin: analysis.net_margin,
    debt_level: analysis.debt_level,
    earnings_quality: analysis.earnings_quality,
    regulatory_risk: analysis.regulatory_risk,
    red_flags: analysis.red_flags,
    timeline_events: analysis.timeline_events,
    summary: analysis.summary,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence,
    price_target_low: analysis.price_target_low,
    price_target_high: analysis.price_target_high,
    price_target_rationale: analysis.price_target_rationale,
  } as any);

  await supabase.from("sentiment_analyses").insert({
    user_id: userId,
    document_id: documentId,
    ticker: ticker || null,
    sentiment: analysis.sentiment,
    confidence: analysis.confidence,
    summary: analysis.summary,
  } as any);

  await supabase.from("documents").update({ status: "processed" }).eq("id", documentId);
  await bumpUsage(userId).catch(() => {});

  return analysis;
}
