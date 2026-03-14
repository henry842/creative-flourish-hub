import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, makeHeaders, securityHeaders, checkRateLimit, rateLimitResponse,
  verifyAuth, sanitizeText, detectPromptInjection, logSecurityEvent, fetchWithTimeout,
} from "../_shared/security.ts";

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
- Nunca forneça recomendações de investimento diretas`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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
    // 1. Auth
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      if (authError) return authError;
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: makeHeaders() });
    }

    // 2. Rate limit: 50/hour
    const rl = checkRateLimit(`chat:${user.id}`, 50, 3600000);
    if (!rl.allowed) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supa = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logSecurityEvent(supa, { user_id: user.id, event_type: "rate_limit_exceeded", details: "chat: 50/hour limit", ip_address: ip });
      return rateLimitResponse(rl.retryAfterMs);
    }

    // 3. Parse & validate
    const { messages, documentContext } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), { status: 400, headers: makeHeaders() });
    }

    // Validate message sizes and check for prompt injection
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const msg of messages) {
      if (typeof msg.content !== "string") continue;
      if (msg.content.length > 2000) {
        return new Response(JSON.stringify({ error: "Mensagem excede o limite de 2000 caracteres" }), { status: 400, headers: makeHeaders() });
      }
      if (msg.role === "user" && detectPromptInjection(msg.content)) {
        await logSecurityEvent(supabase, { user_id: user.id, event_type: "prompt_injection", details: `Blocked message: ${msg.content.slice(0, 100)}`, ip_address: ip });
        return new Response(JSON.stringify({ error: "⚠️ Mensagem bloqueada por motivos de segurança. Reformule sua pergunta." }), { status: 400, headers: makeHeaders() });
      }
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    // Get custom prompt
    let customPrompt: string | null = null;
    const { data: profile } = await supabase.from("profiles").select("custom_prompt").eq("user_id", user.id).single();
    customPrompt = profile?.custom_prompt ? sanitizeText(profile.custom_prompt, 500) : null;

    const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

    let response: Response | null = null;
    for (const model of models) {
      const res = await fetchWithTimeout(GROQ_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: customPrompt ? `${SYSTEM_PROMPT}\n\nCONTEXTO DO USUÁRIO: ${customPrompt}` : SYSTEM_PROMPT },
            ...(documentContext ? [{ role: "system", content: `INSTRUÇÃO CRÍTICA: Baseie sua resposta APENAS nas informações do documento a seguir. NÃO invente dados.\n\nDocumento:\n\n${String(documentContext).slice(0, 8000)}` }] : []),
            ...messages.map((m: any) => ({ role: String(m.role).slice(0, 10), content: String(m.content).slice(0, 2000) })),
          ],
          stream: true,
        }),
      }, 30000);

      if (res.ok) {
        response = res;
        break;
      }
      const errText = await res.text();
      console.error(`Groq model ${model} failed (${res.status}):`, errText);
      if (res.status !== 429 && res.status >= 400 && res.status < 500) {
        return new Response(JSON.stringify({ error: errText }), { status: res.status, headers: makeHeaders() });
      }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: "Todos os modelos indisponíveis. Tente novamente." }), { status: 503, headers: makeHeaders() });
    }

    await incrementUsage(supabase, user.id);

    return new Response(response.body, {
      headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: makeHeaders() });
  }
});
