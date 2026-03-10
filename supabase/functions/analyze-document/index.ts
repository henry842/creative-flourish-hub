import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_id, text, ticker } = await req.json();
    if (!document_id || !text) {
      return new Response(JSON.stringify({ error: "document_id and text are required" }), {
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

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use tool calling to get structured output
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista financeiro especializado. Analise o texto do documento financeiro fornecido e extraia métricas de saúde financeira. Avalie cada categoria de 0 a 100. Identifique red flags (riscos críticos) e eventos importantes com suas datas.`
          },
          {
            role: "user",
            content: `Analise este documento financeiro${ticker ? ` da empresa ${ticker}` : ""}:\n\n${text.slice(0, 15000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_financial_analysis",
              description: "Submit the complete financial health analysis of a document",
              parameters: {
                type: "object",
                properties: {
                  overall_score: { type: "integer", description: "Overall financial health score 0-100" },
                  revenue_growth: { type: "integer", description: "Revenue growth score 0-100" },
                  net_margin: { type: "integer", description: "Net margin quality score 0-100" },
                  debt_level: { type: "integer", description: "Debt health score 0-100 (100 = low debt, healthy)" },
                  earnings_quality: { type: "integer", description: "Earnings quality score 0-100" },
                  regulatory_risk: { type: "integer", description: "Regulatory risk score 0-100 (100 = low risk)" },
                  sentiment: { type: "string", enum: ["bullish", "bearish", "neutral"], description: "Overall sentiment" },
                  confidence: { type: "number", description: "Confidence level 0-1" },
                  summary: { type: "string", description: "Brief analysis summary in Portuguese (2-3 sentences)" },
                  red_flags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Up to 5 critical risk flags in Portuguese"
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
                    description: "Key financial events extracted from the document"
                  }
                },
                required: ["overall_score", "revenue_growth", "net_margin", "debt_level", "earnings_quality", "regulatory_risk", "sentiment", "confidence", "summary", "red_flags", "timeline_events"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_financial_analysis" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Save health score
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
    });
    if (hsError) console.error("health_scores insert error:", hsError);

    // Save sentiment analysis
    const { error: saError } = await supabase.from("sentiment_analyses").insert({
      user_id: user.id,
      document_id,
      ticker: ticker || null,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      summary: analysis.summary,
    });
    if (saError) console.error("sentiment_analyses insert error:", saError);

    // Update document status
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
