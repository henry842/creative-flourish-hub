import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  // Reject known fallback/error markers
  const invalidMarkers = [
    "falha na extração",
    "não foi possível extrair",
    "use o botão editar para colar",
    "texto extraído limitado",
    "documento pode",
  ];
  const lower = normalized.toLowerCase();
  if (invalidMarkers.some((marker) => lower.includes(marker))) return false;

  // Ensure meaningful language signal (letters) and readability ratio
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
  
  // Use Deno's standard base64 encoder for correct encoding of binary data
  const base64Pdf = base64Encode(pdfBytes);
  console.log(`Base64 encoded: ${base64Pdf.length} chars`);
  
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extraia TODO o texto visível deste documento PDF de forma organizada. Mantenha a estrutura original: títulos, subtítulos, tabelas (formate como texto), números, datas, rodapés. Inclua TODOS os dados numéricos e financeiros. Retorne APENAS o texto extraído, sem comentários ou explicações adicionais."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64Pdf}`
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini Vision error:", response.status, errText.slice(0, 500));
    throw new Error(`Gemini Vision failed: ${response.status}`);
  }

  const result = await response.json();
  const extracted = result.choices?.[0]?.message?.content || "";
  console.log(`Gemini Vision extracted ${extracted.length} chars`);
  return cleanTextForLLM(extracted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, ticker } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's custom prompt
    let customPrompt: string | null = null;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("custom_prompt")
      .eq("user_id", user.id)
      .single();
    customPrompt = profileData?.custom_prompt || null;

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch document record
    const { data: docRecord, error: docError } = await supabase
      .from("documents")
      .select("file_path, name, extracted_text")
      .eq("id", document_id)
      .single();

    if (docError || !docRecord) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if existing extracted_text is readable, otherwise re-extract
    let text = docRecord.extracted_text;
    const needsExtraction = !text || !isTextReadable(text);

    if (needsExtraction) {
      console.log(`Downloading PDF from storage: ${docRecord.file_path}`);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(docRecord.file_path);

      if (downloadError || !fileData) {
        console.error("PDF download error:", downloadError);
        return new Response(JSON.stringify({ error: "Falha ao baixar o PDF do storage" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
      console.log(`PDF size: ${pdfBytes.length} bytes`);

      // Strategy 1: Try basic text extraction first (fast, free)
      const basicText = extractTextFromPdfStreams(pdfBytes);
      console.log(`Basic extraction: ${basicText.length} chars, readable: ${isTextReadable(basicText)}`);

      if (isTextReadable(basicText) && basicText.length > 200) {
        text = basicText;
        console.log("Using basic text extraction (readable text found)");
      } else {
        // Strategy 2: Use Gemini Vision (handles scanned PDFs, images, complex layouts)
        try {
          text = await extractTextWithGeminiVision(pdfBytes, LOVABLE_API_KEY);
          if (!isTextReadable(text) || text.length < 100) {
            text = `[Não foi possível extrair texto legível do PDF "${docRecord.name}". O documento pode estar protegido ou em formato não suportado. Use o botão Editar para colar o texto manualmente.]`;
            console.warn("Both extraction methods failed");
          }
        } catch (visionErr) {
          console.error("Gemini Vision extraction failed:", visionErr);
          text = `[Falha na extração do PDF "${docRecord.name}". Use o botão Editar para colar o texto manualmente.]`;
        }
      }

      // Save extracted text
      await supabase
        .from("documents")
        .update({ extracted_text: text })
        .eq("id", document_id);
      
      console.log("Saved extracted_text to documents table");
    }

    // Track usage
    const incrementUsage = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("groq_usage")
        .select("id, request_count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("groq_usage")
          .update({ request_count: existing.request_count + 1, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("groq_usage")
          .insert({ user_id: user.id, date: today, request_count: 1 });
      }
    };

    // Groq models to try
    const models = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ];

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

PASSO 2 — ADAPTE A ANÁLISE:
Para FINANCEIRO: avalie indicadores, riscos, retorno, red flags
Para CIENTÍFICO: avalie metodologia, conclusões, limitações, relevância
Para JURÍDICO: avalie cláusulas importantes, riscos, obrigações
Para MÉDICO: avalie diagnóstico, riscos, recomendações
Para TÉCNICO: avalie especificações, pontos críticos, limitações
Para JORNALÍSTICO: avalie fatos principais, fontes, impacto
Para OUTRO: extraia os pontos mais importantes do documento

PASSO 3 — ADAPTE OS SCORES:
Os scores de 0-100 devem refletir a área do documento:
- revenue_growth → para não-financeiros use como "relevância/impacto" (0-100)
- net_margin → use como "qualidade das informações" (0-100)
- debt_level → use como "clareza e organização" (0-100)
- earnings_quality → use como "confiabilidade das fontes" (0-100)
- regulatory_risk → use como "riscos identificados" (0-100 onde 100 = baixo risco)

PASSO 4 — REGRAS UNIVERSAIS:
1. Nunca invente informações — use APENAS o que está no documento
2. Summary em português claro e acessível para qualquer pessoa
3. Red flags = pontos críticos ou preocupantes do documento
4. Timeline = eventos ou etapas importantes mencionados
5. Se o documento for em outro idioma, analise normalmente e responda em português
6. Se uma métrica não puder ser determinada, use o valor 50 (neutro) e mencione na summary`
        },
        {
          role: "user",
          content: `Analise este documento${ticker ? ` (ticker: ${ticker})` : ""}:\n\n${text!.slice(0, 8000)}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_financial_analysis",
            description: "Submit the complete document analysis with adapted scores",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "integer", description: "Overall document quality/health score 0-100" },
                revenue_growth: { type: "integer", description: "For financial: revenue growth. For others: relevance/impact score 0-100" },
                net_margin: { type: "integer", description: "For financial: net margin. For others: information quality score 0-100" },
                debt_level: { type: "integer", description: "For financial: debt health. For others: clarity/organization score 0-100 (100 = excellent)" },
                earnings_quality: { type: "integer", description: "For financial: earnings quality. For others: source reliability score 0-100" },
                regulatory_risk: { type: "integer", description: "Risk score 0-100 (100 = low risk)" },
                sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], description: "Overall sentiment: bullish=positive, bearish=negative, neutral" },
                confidence: { type: "number", description: "Confidence level 0-1" },
                summary: { type: "string", description: "Brief analysis summary in Portuguese (2-3 sentences). Mention the document type identified." },
                price_target_low: { type: "integer", description: "For financial: conservative price target. For others: use 0" },
                price_target_high: { type: "integer", description: "For financial: optimistic price target. For others: use 0" },
                price_target_rationale: { type: "string", description: "For financial: price target rationale. For others: brief key takeaway in Portuguese" },
                red_flags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Up to 5 critical concerns/risks in Portuguese, based ONLY on document content"
                },
                timeline_events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", description: "Date or period (e.g., 'Q3 2025', 'Mar 2025')" },
                      event: { type: "string", description: "Event description in Portuguese" }
                    },
                    required: ["date", "event"]
                  },
                  description: "Key events or milestones extracted from the document"
                }
              },
              required: ["overall_score", "revenue_growth", "net_margin", "debt_level", "earnings_quality", "regulatory_risk", "sentiment", "confidence", "summary", "price_target_low", "price_target_high", "price_target_rationale", "red_flags", "timeline_events"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "submit_financial_analysis" } }
    });

    let aiResult: any = null;
    let lastError: string = "";
    for (const model of models) {
      console.log(`Trying Groq model: ${model}`);
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: buildBody(model),
      });
      if (res.ok) {
        aiResult = await res.json();
        break;
      }
      lastError = await res.text();
      console.error(`Groq model ${model} failed (${res.status}):`, lastError);
      
      if (res.status === 400 && lastError.includes("tool_use_failed")) {
        console.log("Attempting to extract JSON from failed_generation...");
        try {
          const errorObj = JSON.parse(lastError);
          const failedGen = errorObj?.error?.failed_generation || "";
          const jsonMatch = failedGen.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.overall_score !== undefined) {
              console.log("Successfully extracted analysis from failed_generation");
              aiResult = { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(parsed) } }] } }] };
              break;
            }
          }
        } catch (extractErr) {
          console.error("Failed to extract from failed_generation:", extractErr);
        }
        continue;
      }
      
      if (res.status !== 429 && res.status !== 413 && res.status >= 400 && res.status < 500) {
        return new Response(JSON.stringify({ error: lastError }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "Todos os modelos Groq falharam. Tente novamente em alguns minutos." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await incrementUsage();

    let analysis: any;
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Tool call parse failed:", e);
      }
    }

    if (!analysis) {
      const content = aiResult.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Content JSON parse failed:", e);
        }
      }
    }

    if (!analysis) throw new Error("Could not extract structured data from AI response");

    // Delete old health_scores and sentiment for this document before inserting new ones
    await supabase.from("health_scores").delete().eq("document_id", document_id).eq("user_id", user.id);
    await supabase.from("sentiment_analyses").delete().eq("document_id", document_id).eq("user_id", user.id);

    const { error: hsError } = await supabase.from("health_scores").insert({
      user_id: user.id,
      document_id,
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
      price_target_low: analysis.price_target_low || null,
      price_target_high: analysis.price_target_high || null,
      price_target_rationale: analysis.price_target_rationale || null,
    });
    if (hsError) console.error("health_scores insert error:", hsError);

    const { error: saError } = await supabase.from("sentiment_analyses").insert({
      user_id: user.id,
      document_id,
      ticker: ticker || null,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      summary: analysis.summary,
    });
    if (saError) console.error("sentiment_analyses insert error:", saError);

    await supabase.from("documents").update({ status: "processed" }).eq("id", document_id);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
