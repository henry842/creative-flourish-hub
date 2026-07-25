/**
 * Universal AI layer.
 *
 * Two paths, one interface:
 *  1. Supabase Edge Function (`chat`) — preferred. The key lives on the server and
 *     usage/rate limits are enforced there.
 *  2. Direct provider call (BYOK) — the user's own key, kept in this browser only.
 *     Guarantees the product works even with no backend deployed.
 *
 * Every supported provider speaks the OpenAI chat-completions dialect, so both paths
 * share the same SSE parsing and the same request shape.
 */
import { supabase } from "@/integrations/supabase/client";

export type ProviderId = "groq" | "openrouter" | "openai";

export interface Provider {
  id: ProviderId;
  label: string;
  baseUrl: string;
  /** Preferred model first; the rest are automatic fallbacks. */
  models: string[];
  keyHint: string;
  keysUrl: string;
  free: boolean;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyHint: "gsk_...",
    keysUrl: "https://console.groq.com/keys",
    free: true,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["meta-llama/llama-3.3-70b-instruct", "google/gemini-2.0-flash-001"],
    keyHint: "sk-or-...",
    keysUrl: "https://openrouter.ai/keys",
    free: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o"],
    keyHint: "sk-...",
    keysUrl: "https://platform.openai.com/api-keys",
    free: false,
  },
};

export interface AIConfig {
  provider: ProviderId;
  apiKey: string;
  model?: string;
}

const STORAGE_KEY = "finsight_ai_config";
const EDGE_STATE_KEY = "finsight_edge_ai";

/* ─────────────────────────── configuration ─────────────────────────── */

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as AIConfig;
    if (!cfg?.apiKey || !PROVIDERS[cfg.provider]) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function saveAIConfig(cfg: AIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("finsight-ai-config"));
}

export function clearAIConfig() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("finsight-ai-config"));
}

export function hasDirectKey(): boolean {
  return getAIConfig() !== null;
}

function modelsFor(cfg: AIConfig): string[] {
  const list = PROVIDERS[cfg.provider].models;
  return cfg.model ? [cfg.model, ...list.filter((m) => m !== cfg.model)] : list;
}

/**
 * Whether the server-side function is known to be unavailable. Cached per tab so a
 * missing deployment costs one failed request, not one per message.
 */
function edgeKnownDown(): boolean {
  return sessionStorage.getItem(EDGE_STATE_KEY) === "down";
}
function markEdgeDown() {
  const first = sessionStorage.getItem(EDGE_STATE_KEY) !== "down";
  sessionStorage.setItem(EDGE_STATE_KEY, "down");
  // Lets the UI surface "AI needs a key" the moment the server path is ruled out.
  if (first) window.dispatchEvent(new Event("finsight-ai-config"));
}
function markEdgeUp() {
  sessionStorage.setItem(EDGE_STATE_KEY, "up");
}

/** True when the app can reach a model at all (either path). */
export function aiReady(): boolean {
  return hasDirectKey() || !edgeKnownDown();
}

export class AINotConfiguredError extends Error {
  constructor() {
    super(
      "A IA ainda não está configurada. Abra Perfil → Inteligência artificial e informe uma chave para ativar."
    );
    this.name = "AINotConfiguredError";
  }
}

/* ─────────────────────────── low-level calls ─────────────────────────── */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function directHeaders(cfg: AIConfig): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  if (cfg.provider === "openrouter") {
    // OpenRouter attributes traffic with these; harmless elsewhere.
    h["HTTP-Referer"] = window.location.origin;
    h["X-Title"] = "FinSight";
  }
  return h;
}

async function directFetch(cfg: AIConfig, body: unknown, signal?: AbortSignal) {
  return fetch(`${PROVIDERS[cfg.provider].baseUrl}/chat/completions`, {
    method: "POST",
    headers: directHeaders(cfg),
    body: JSON.stringify(body),
    signal,
  });
}

/** Turns provider/network failures into a message a non-technical user can act on. */
async function describeFailure(res: Response | null, err?: unknown): Promise<string> {
  if (res) {
    let detail = "";
    try {
      const txt = await res.text();
      detail = (JSON.parse(txt)?.error?.message as string) || txt.slice(0, 200);
    } catch {
      /* keep empty */
    }
    if (res.status === 401 || res.status === 403)
      return "Chave de IA inválida ou sem permissão. Verifique a chave em Perfil → Inteligência artificial.";
    if (res.status === 429)
      return "Limite de uso da IA atingido no momento. Aguarde alguns instantes e tente de novo.";
    if (res.status === 413)
      return "O conteúdo enviado é grande demais para o modelo. Tente um documento menor.";
    return `A IA respondeu com erro ${res.status}. ${detail}`.trim();
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
    return "Não foi possível falar com o provedor de IA a partir do navegador. Verifique a conexão — ou troque o provedor em Perfil → Inteligência artificial.";
  }
  return msg || "Falha inesperada ao contatar a IA.";
}

/* ─────────────────────────── streaming chat ─────────────────────────── */

/** Parses an OpenAI-style SSE body, invoking `onDelta` for each text chunk. */
async function pumpSSE(body: ReadableStream<Uint8Array>, onDelta: (t: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        /* partial frame — ignore */
      }
    }
  }
}

export interface StreamOptions {
  messages: ChatMessage[];
  /** Extra grounding text (document contents). */
  documentContext?: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

/**
 * Streams an assistant reply. Prefers the Edge Function; falls back to the user's key.
 * Throws AINotConfiguredError when neither path is usable.
 */
export async function streamChat(opts: StreamOptions): Promise<void> {
  const { messages, documentContext, systemPrompt, signal, onDelta } = opts;

  // ── path 1: server-side function
  if (!edgeKnownDown()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages, documentContext }),
        signal,
      });

      if (res.ok && res.body) {
        markEdgeUp();
        await pumpSSE(res.body, onDelta);
        return;
      }
      // 404/5xx => not deployed or broken; anything else with a key available also falls back.
      markEdgeDown();
      if (!hasDirectKey()) throw new Error(await describeFailure(res));
    } catch (e) {
      if (signal?.aborted) throw e;
      markEdgeDown();
      if (!hasDirectKey()) {
        if (e instanceof Error && e.name === "AINotConfiguredError") throw e;
        throw new AINotConfiguredError();
      }
    }
  }

  // ── path 2: user's own key
  const cfg = getAIConfig();
  if (!cfg) throw new AINotConfiguredError();

  const system: ChatMessage[] = [];
  if (systemPrompt) system.push({ role: "system", content: systemPrompt });
  if (documentContext) {
    system.push({
      role: "system",
      content:
        "INSTRUÇÃO CRÍTICA: baseie sua resposta APENAS nas informações do documento a seguir. NÃO invente dados.\n\nDocumento:\n\n" +
        documentContext.slice(0, 8000),
    });
  }

  let lastRes: Response | null = null;
  let lastErr: unknown = null;

  for (const model of modelsFor(cfg)) {
    try {
      const res = await directFetch(
        cfg,
        { model, messages: [...system, ...messages], stream: true },
        signal
      );
      if (res.ok && res.body) {
        await pumpSSE(res.body, onDelta);
        return;
      }
      lastRes = res;
      if (res.status === 401 || res.status === 403) break; // bad key: retrying won't help
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }

  throw new Error(await describeFailure(lastRes, lastErr));
}

/** Non-streaming convenience wrapper. */
export async function chatOnce(
  messages: ChatMessage[],
  opts: { systemPrompt?: string; documentContext?: string; signal?: AbortSignal } = {}
): Promise<string> {
  let out = "";
  await streamChat({ ...opts, messages, onDelta: (t) => (out += t) });
  return out;
}

/* ─────────────────────── structured (tool-call) output ─────────────────────── */

/**
 * Asks the model for a JSON object matching `schema`, using tool-calling with a
 * plain-JSON fallback (some models return the object in `content` instead).
 * Runs on the user's key — structured analysis is not exposed by the chat function.
 */
export async function generateStructured<T>(args: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<T> {
  const cfg = getAIConfig();
  if (!cfg) throw new AINotConfiguredError();

  const body = (model: string) => ({
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: args.schemaName,
          description: "Retorna a análise estruturada do documento.",
          parameters: args.schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: args.schemaName } },
  });

  let lastRes: Response | null = null;
  let lastErr: unknown = null;

  for (const model of modelsFor(cfg)) {
    try {
      const res = await directFetch(cfg, body(model), args.signal);

      if (res.ok) {
        const json = await res.json();
        const msg = json?.choices?.[0]?.message;
        const raw = msg?.tool_calls?.[0]?.function?.arguments ?? msg?.content;
        const parsed = coerceJSON(raw);
        if (parsed) return parsed as T;
        lastErr = new Error("A IA respondeu em um formato inesperado.");
        continue;
      }

      // Groq surfaces a malformed tool call as 400 + `failed_generation`; salvage it.
      const txt = await res.clone().text();
      if (res.status === 400 && txt.includes("failed_generation")) {
        const salvaged = coerceJSON(safeJSON(txt)?.error?.failed_generation);
        if (salvaged) return salvaged as T;
      }
      lastRes = res;
      if (res.status === 401 || res.status === 403) break;
    } catch (e) {
      if (args.signal?.aborted) throw e;
      lastErr = e;
    }
  }

  throw new Error(await describeFailure(lastRes, lastErr));
}

function safeJSON(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Accepts a JSON string, a fenced block, or an object; returns an object or null. */
function coerceJSON(raw: unknown): unknown | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  const direct = safeJSON(raw);
  if (direct && typeof direct === "object") return direct;
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? safeJSON(match[0]) : null;
}

/* ─────────────────────────── connection test ─────────────────────────── */

export async function testAIConnection(cfg: AIConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await directFetch(cfg, {
      model: modelsFor(cfg)[0],
      messages: [{ role: "user", content: "Responda apenas: ok" }],
      max_tokens: 5,
    });
    if (res.ok) return { ok: true, message: "Conexão bem-sucedida. A IA está pronta para uso." };
    return { ok: false, message: await describeFailure(res) };
  } catch (e) {
    return { ok: false, message: await describeFailure(null, e) };
  }
}
