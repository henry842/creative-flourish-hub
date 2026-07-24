import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import {
  corsHeaders, makeHeaders, checkRateLimit, rateLimitResponse,
  verifyAuth, sanitizeTicker, isValidUUID, logSecurityEvent, fetchWithTimeout,
} from "../_shared/security.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function cleanTextForLLM(text: string): string {
  return text
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t\u00C0-\u024F\u1E00-\u1EFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTextReadable(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 500) return false;
  const invalidMarkers = ["falha na extração", "não foi possível extrair", "use o botão editar para colar", "texto extraído limitado", "documento pode"];
  const lower = normalized.toLowerCase();
  if (invalidMarkers.some((marker) => lower.includes(marker))) return false;
  const letters = normalized.match(/[a-zA-ZàáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]/g)?.length || 0;
  const readableChars = normalized.match(/[a-zA-Z0-9\s.,;:!?()%$€R\-\/àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]/g)?.length || 0;
  const ratio = readableChars / normalized.length;
  return letters >= 100 && ratio > 0.6;
}

function extractTextFromPdfStreams(pdfBytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(pdfBytes);
  const textChunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const content = match[1];
    const textOpRegex = /\(([^)]*)\)\s*Tj|\[(.*?)\]\s*TJ/g;
    let textMatch;
    while ((textMatch = textOpRegex.exec(content)) !== null) {
      const text = textMatch[1] || textMatch[2];
      if (text) {
        const cleaned = text.replace(/\)\s*[-\d.]+\s*\(/g, "").replace(/^\(|\)$/g, "");
        if (cleaned.trim()) textChunks.push(cleaned);
      }
    }
    const btBlocks = content.match(/BT[\s\S]*?ET/g);
    if (btBlocks) {
      for (const block of btBlocks) {
        const texts = block.match(/\(([^)]+)\)/g);
        if (texts) {
          for (const t of texts) {
            const clean = t.slice(1, -1).trim();
            if (clean) textChunks.push(clean);
          }
        }
      }
    }
  }
  const deduped: string[] = [];
  for (const chunk of textChunks) {
    if (deduped[deduped.length - 1] !== chunk) deduped.push(chunk);
  }
  return cleanTextForLLM(deduped.join(" "));
}

async function extractTextWithGeminiVision(pdfBytes: Uint8Array, apiKey: string): Promise<string> {
  console.log(`Using Gemini Vision for PDF text extraction (${pdfBytes.length} bytes)...`);
  const base64Pdf = base64Encode(pdfBytes);

  // OCR runs server-side only. Endpoint is configurable; falls back to the previously
  // configured gateway so existing deployments keep working without a secret change.
  const gatewayUrl = Deno.env.get("OCR_GATEWAY_URL") ?? "https://ai.gateway.lovable.dev/v1/chat/completions";

  const response = await fetchWithTimeout(gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extraia TODO o texto visível deste documento PDF de forma organizada. Mantenha a estrutura original: títulos, subtítulos, tabelas (formate como texto), números, datas, rodapés. Inclua TODOS os dados numéricos e financeiros. Retorne APENAS o texto extraído, sem comentários ou explicações adicionais." },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } }
        ]
      }],
    }),
  }, 30000);

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini Vision error:", response.status, errText.slice(0, 500));
    throw new Error(`Gemini Vision failed: ${response.status}`);
  }

  const result = await response.json();
  const extracted = result.choices?.[0]?.message?.content || "";
  return cleanTextForLLM(extracted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  try {
    // 1. Auth verification
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) return authError!;

    // 2. Rate limiting: 10/hour
    const rl = checkRateLimit(`analyze:${user.id}`, 10, 3600000);
    if (!rl.allowed) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logSecurityEvent(supabase, { user_id: user.id, event_type: "rate_limit_exceeded", details: "analyze-document: 10/hour limit", ip_address: ip });
      return rateLimitResponse(rl.retryAfterMs);
    }

    // 3. Parse & validate input
    const body = await req.json();
    const document_id = body.document_id;
    const ticker = sanitizeTicker(body.ticker);
    const asset_id = body.asset_id;

    if (!document_id || !isValidUUID(document_id)) {
      return new Response(JSON.stringify({ error: "document_id inválido" }), { status: 400, headers: makeHeaders() });
    }
    if (asset_id && !isValidUUID(asset_id)) {
      return new Response(JSON.stringify({ error: "asset_id inválido" }), { status: 400, headers: makeHeaders() });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. Verify document ownership
    const { data: docRecord, error: docError } = await supabase
      .from("documents")
      .select("file_path, name, extracted_text, user_id")
      .eq("id", document_id)
      .single();

    if (docError || !docRecord) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), { status: 404, headers: makeHeaders() });
    }

    // Double auth: verify user owns the document
    if (docRecord.user_id !== user.id) {
      await logSecurityEvent(supabase, { user_id: user.id, event_type: "unauthorized_access", details: `User tried to analyze document ${document_id} owned by ${docRecord.user_id}`, ip_address: ip });
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: makeHeaders() });
    }

    // Fetch user's custom prompt
    let customPrompt: string | null = null;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("custom_prompt")
      .eq("user_id", user.id)
      .single();
    customPrompt = profileData?.custom_prompt ? String(profileData.custom_prompt).slice(0, 500).replace(/<[^>]*>/g, "") : null;

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const OCR_API_KEY = Deno.env.get("OCR_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
    if (!OCR_API_KEY) throw new Error("OCR_API_KEY is not configured");

    // Check/extract text
    let text = docRecord.extracted_text;
    const needsExtraction = !text || !isTextReadable(text);

    if (needsExtraction) {
      const { data: fileData, error: downloadError } = await supabase.storage.from("documents").download(docRecord.file_path);
      if (downloadError || !fileData) {
        return new Response(JSON.stringify({ error: "Falha ao baixar o PDF" }), { status: 500, headers: makeHeaders() });
      }

      const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

      // Validate PDF magic bytes
      if (pdfBytes.length < 5 || pdfBytes[0] !== 0x25 || pdfBytes[1] !== 0x50 || pdfBytes[2] !== 0x44 || pdfBytes[3] !== 0x46) {
        await logSecurityEvent(supabase, { user_id: user.id, event_type: "invalid_file", details: `File ${docRecord.name} is not a valid PDF`, ip_address: ip });
        return new Response(JSON.stringify({ error: "Arquivo inválido: não é um PDF válido" }), { status: 400, headers: makeHeaders() });
      }

      // 10MB limit
      if (pdfBytes.length > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Arquivo excede o limite de 10MB" }), { status: 400, headers: makeHeaders() });
      }

      const basicText = extractTextFromPdfStreams(pdfBytes);
      if (isTextReadable(basicText) && basicText.length > 200) {
        text = basicText;
      } else {
        try {
          text = await extractTextWithGeminiVision(pdfBytes, OCR_API_KEY);
          if (!isTextReadable(text) || text.length < 100) {
            text = `[Não foi possível extrair texto legível do PDF "${docRecord.name}". Use o botão Editar para colar o texto manualmente.]`;
          }
        } catch (visionErr) {
          console.error("Gemini Vision extraction failed:", visionErr);
          text = `[Falha na extração do PDF "${docRecord.name}". Use o botão Editar para colar o texto manualmente.]`;
        }
      }

      await supabase.from("documents").update({ extracted_text: text }).eq("id", document_id);
    }

    // Track usage
    const incrementUsage = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase.from("groq_usage").select("id, request_count").eq("user_id", user.id).eq("date", today).maybeSingle();
      if (existing) {
        await supabase.from("groq_usage").update({ request_count: existing.request_count + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("groq_usage").insert({ user_id: user.id, date: today, request_count: 1 });
      }
    };

    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

    const buildBody = (model: string) => JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `Você é um especialista multidisciplinar capaz de analisar qualquer tipo de documento: financeiro, científico, jurídico, médico, técnico, acadêmico, jornalístico ou qualquer outra área.

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
5. Se uma métrica não puder ser determinada, use 50${customPrompt ? `\n\nCONTEXTO DO USUÁRIO: ${customPrompt}` : ""}`
        },
        {
          role: "user",
          content: `Analise este documento${ticker ? ` (ticker: ${ticker})` : ""}:\n\n${text!.slice(0, 8000)}`
        }
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_financial_analysis",
          description: "Submit the complete document analysis with adapted scores",
          parameters: {
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
              timeline_events: { type: "array", items: { type: "object", properties: { date: { type: "string" }, event: { type: "string" } }, required: ["date", "event"] } }
            },
            required: ["overall_score", "revenue_growth", "net_margin", "debt_level", "earnings_quality", "regulatory_risk", "sentiment", "confidence", "summary", "price_target_low", "price_target_high", "price_target_rationale", "red_flags", "timeline_events"],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: "function", function: { name: "submit_financial_analysis" } }
    });

    let aiResult: any = null;
    let lastError = "";
    for (const model of models) {
      console.log(`Trying Groq model: ${model}`);
      const res = await fetchWithTimeout(GROQ_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: buildBody(model),
      }, 30000);

      if (res.ok) {
        aiResult = await res.json();
        break;
      }
      lastError = await res.text();
      console.error(`Groq model ${model} failed (${res.status}):`, lastError);

      if (res.status === 400 && lastError.includes("tool_use_failed")) {
        try {
          const errorObj = JSON.parse(lastError);
          const failedGen = errorObj?.error?.failed_generation || "";
          const jsonMatch = failedGen.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.overall_score !== undefined) {
              aiResult = { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(parsed) } }] } }] };
              break;
            }
          }
        } catch { /* ignore */ }
        continue;
      }

      if (res.status !== 429 && res.status !== 413 && res.status >= 400 && res.status < 500) {
        return new Response(JSON.stringify({ error: lastError }), { status: res.status, headers: makeHeaders() });
      }
    }

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "Todos os modelos falharam. Tente novamente." }), { status: 503, headers: makeHeaders() });
    }

    await incrementUsage();

    let analysis: any;
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try { analysis = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
    }
    if (!analysis) {
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { analysis = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }
    }
    if (!analysis) throw new Error("Could not extract structured data from AI response");

    // Delete old & insert new
    await supabase.from("health_scores").delete().eq("document_id", document_id).eq("user_id", user.id);
    await supabase.from("sentiment_analyses").delete().eq("document_id", document_id).eq("user_id", user.id);

    await supabase.from("health_scores").insert({
      user_id: user.id, document_id, asset_id: asset_id || null, ticker,
      overall_score: analysis.overall_score, revenue_growth: analysis.revenue_growth,
      net_margin: analysis.net_margin, debt_level: analysis.debt_level,
      earnings_quality: analysis.earnings_quality, regulatory_risk: analysis.regulatory_risk,
      red_flags: analysis.red_flags, timeline_events: analysis.timeline_events,
      summary: analysis.summary, sentiment: analysis.sentiment, confidence: analysis.confidence,
      price_target_low: analysis.price_target_low || null,
      price_target_high: analysis.price_target_high || null,
      price_target_rationale: analysis.price_target_rationale || null,
    });

    await supabase.from("sentiment_analyses").insert({
      user_id: user.id, document_id, ticker,
      sentiment: analysis.sentiment, confidence: analysis.confidence, summary: analysis.summary,
    });

    await supabase.from("documents").update({ status: "processed" }).eq("id", document_id);

    return new Response(JSON.stringify({ success: true, analysis }), { headers: makeHeaders() });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: makeHeaders() });
  }
});
