import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Security Headers ───
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function makeHeaders(extra: Record<string, string> = {}) {
  return { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json", ...extra };
}

// ─── Rate Limiting (in-memory per isolate + DB-backed) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const minutes = Math.ceil(retryAfterMs / 60000);
  return new Response(
    JSON.stringify({ error: `Limite atingido. Tente novamente em ${minutes} minuto(s).` }),
    { status: 429, headers: makeHeaders() }
  );
}

// ─── Auth Verification ───
export async function verifyAuth(req: Request): Promise<{
  user: { id: string; email?: string } | null;
  error: Response | null;
}> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      user: null,
      error: new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: makeHeaders(),
      }),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, anonKey);
  const token = authHeader.replace("Bearer ", "");

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user) {
    return {
      user: null,
      error: new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: makeHeaders(),
      }),
    };
  }

  return { user: { id: data.user.id, email: data.user.email }, error: null };
}

// ─── Input Sanitization ───
export function sanitizeTicker(ticker: string | null | undefined): string | null {
  if (!ticker) return null;
  const clean = ticker.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10);
  return clean || null;
}

export function sanitizeText(text: string | null | undefined, maxLength: number): string | null {
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, "") // strip HTML
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
    .slice(0, maxLength) || null;
}

export function sanitizeDocName(name: string): string {
  return name
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\s.\-()àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ]/g, "")
    .trim()
    .slice(0, 200);
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ─── Prompt Injection Detection ───
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /forget\s+(everything|all|your|previous)/i,
  /disregard\s+(all|your|the|previous)/i,
  /new\s+instructions?\s*:/i,
  /system\s*prompt\s*:/i,
  /\bact\s+as\b/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /override\s+(system|instructions|prompt)/i,
  /jailbreak/i,
  /DAN\s*mode/i,
  /do\s+anything\s+now/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// ─── Security Logging ───
export async function logSecurityEvent(
  supabase: any,
  event: {
    user_id?: string | null;
    event_type: string;
    details: string;
    ip_address?: string | null;
  }
) {
  try {
    await supabase.from("security_logs").insert({
      user_id: event.user_id || null,
      event_type: event.event_type,
      details: event.details,
      ip_address: event.ip_address || null,
    });
  } catch (e) {
    console.error("Failed to log security event:", e);
  }
}

// ─── Fetch with timeout ───
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
