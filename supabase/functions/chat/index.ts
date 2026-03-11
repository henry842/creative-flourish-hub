import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o FinSight AI, um analista financeiro especialista com profundo conhecimento em:
- Análise fundamentalista e técnica de ações
- Leitura e interpretação de relatórios 10-K, 10-Q, earnings calls
- Análise de sentimento de mercado
- Métricas financeiras (P/E, EV/EBITDA, ROE, ROIC, margens, etc.)
- Macroeconomia e impacto em investimentos

Diretrizes:
- Responda sempre em português brasileiro
- Use formatação markdown rica: tabelas, listas, negrito para destaques
- Quando analisar documentos, seja detalhado mas objetivo
- Indique nível de confiança nas análises
- Mencione riscos e limitações das análises
- Quando possível, classifique o sentimento como: Bullish 📈, Bearish 📉, ou Neutro ➡️
- Nunca forneça recomendações de investimento diretas — forneça análises para que o usuário tome suas próprias decisões`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    // Groq models to try in order
    const models = [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
    ];

    let response: Response | null = null;
    for (const model of models) {
      console.log(`Trying Groq model: ${model}`);
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      });
      if (res.ok) {
        response = res;
        break;
      }
      const errText = await res.text();
      console.error(`Groq model ${model} failed (${res.status}):`, errText);
      if (res.status !== 429 && res.status >= 400 && res.status < 500) {
        return new Response(JSON.stringify({ error: errText }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: "Todos os modelos Groq estão indisponíveis. Tente novamente em alguns minutos." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
