/**
 * Local backend.
 *
 * When there is no real Supabase session (project asleep, anonymous sign-in disabled, or
 * simply offline) the app would be readable but dead: nothing could be created or saved.
 * This module keeps it fully usable by serving the same HTTP contract from IndexedDB.
 *
 * It intercepts `fetch` for the project's `/rest/v1` and `/storage/v1` endpoints and
 * emulates the slice of PostgREST the app actually uses — equality/range filters,
 * ordering, limits, `count=exact`, single-object responses, insert/update/delete — so no
 * page or query had to change.
 */

const DB_NAME = "finsight-local";
const DB_VERSION = 1;
const ROWS = "rows";
const FILES = "files";

export const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000000";

let active = false;
let memory: Record<string, any[]> = {};
let idb: IDBDatabase | null = null;

export function isLocalBackend() {
  return active;
}

/* ────────────────────────────── storage engine ────────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROWS)) db.createObjectStore(ROWS);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (!idb) return resolve(undefined);
    const req = idb.transaction(store, "readonly").objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => resolve(undefined);
  });
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    if (!idb) return resolve();
    const tx = idb.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

let persistTimer: number | undefined;
function persist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => void idbPut(ROWS, "all", memory), 120);
}

/* ────────────────────────────── query emulation ────────────────────────────── */

const RESERVED = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

/** Parses a PostgREST scalar literal (`null`, `"quoted"`, or a bare value). */
function literal(raw: string): unknown {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matches(row: any, column: string, expression: string): boolean {
  let expr = expression;
  let negate = false;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }

  const dot = expr.indexOf(".");
  const op = dot === -1 ? expr : expr.slice(0, dot);
  const rawValue = dot === -1 ? "" : expr.slice(dot + 1);
  const value = literal(rawValue);
  const cell = row[column];

  let result: boolean;
  switch (op) {
    case "eq":
      result = String(cell) === String(value);
      break;
    case "neq":
      result = String(cell) !== String(value);
      break;
    case "is":
      result = value === null ? cell === null || cell === undefined : cell === value;
      break;
    case "gt":
      result = compare(cell, value) > 0;
      break;
    case "gte":
      result = compare(cell, value) >= 0;
      break;
    case "lt":
      result = compare(cell, value) < 0;
      break;
    case "lte":
      result = compare(cell, value) <= 0;
      break;
    case "in": {
      const list = rawValue.replace(/^\(|\)$/g, "").split(",").map((v) => literal(v.trim()));
      result = list.some((v) => String(v) === String(cell));
      break;
    }
    case "like":
    case "ilike": {
      const pattern = String(value).replace(/%/g, ".*");
      result = new RegExp(`^${pattern}$`, op === "ilike" ? "i" : "").test(String(cell ?? ""));
      break;
    }
    default:
      result = true;
  }
  return negate ? !result : result;
}

function applyQuery(table: string, params: URLSearchParams): any[] {
  let rows = [...(memory[table] ?? [])];

  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) continue;
    rows = rows.filter((r) => matches(r, key, value));
  }

  const order = params.get("order");
  if (order) {
    // e.g. "created_at.desc" or "name.asc.nullslast", possibly comma separated
    const terms = order.split(",").map((t) => {
      const [col, ...rest] = t.split(".");
      return { col, desc: rest.includes("desc") };
    });
    rows.sort((a, b) => {
      for (const { col, desc } of terms) {
        const c = compare(a[col], b[col]);
        if (c !== 0) return desc ? -c : c;
      }
      return 0;
    });
  }

  const offset = Number(params.get("offset") ?? 0);
  const limit = params.get("limit");
  if (offset) rows = rows.slice(offset);
  if (limit) rows = rows.slice(0, Number(limit));

  return rows;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function stamp(table: string, row: any) {
  const out = { ...row };
  if (!out.id) out.id = crypto.randomUUID();
  if (!out.created_at) out.created_at = nowIso();
  out.updated_at = nowIso();
  if (!out.user_id) out.user_id = LOCAL_USER_ID;
  memory[table] = memory[table] ?? [];
  return out;
}

async function handleRest(table: string, url: URL, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers as HeadersInit);
  const wantsObject = (headers.get("Accept") ?? "").includes("pgrst.object");
  const prefer = headers.get("Prefer") ?? "";
  const wantsCount = prefer.includes("count=");
  const wantsRepresentation = prefer.includes("return=representation");

  memory[table] = memory[table] ?? [];

  if (method === "GET" || method === "HEAD") {
    const rows = applyQuery(table, url.searchParams);
    const countHeaders: Record<string, string> = wantsCount
      ? { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` }
      : {};

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: countHeaders });
    }
    if (wantsObject) {
      if (rows.length === 0) {
        return json(
          { code: "PGRST116", details: "Results contain 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" },
          { status: 406 }
        );
      }
      return json(rows[0], { headers: { "Content-Type": "application/json", ...countHeaders } });
    }
    return json(rows, { headers: { "Content-Type": "application/json", ...countHeaders } });
  }

  if (method === "POST") {
    const payload = JSON.parse((init.body as string) || "[]");
    const list = Array.isArray(payload) ? payload : [payload];
    const created = list.map((r) => stamp(table, r));
    memory[table].push(...created);
    persist();
    if (wantsRepresentation) {
      return json(wantsObject ? created[0] : created, { status: 201 });
    }
    return new Response(null, { status: 201 });
  }

  if (method === "PATCH") {
    const patch = JSON.parse((init.body as string) || "{}");
    const targets = applyQuery(table, url.searchParams);
    const ids = new Set(targets.map((r) => r.id));
    memory[table] = memory[table].map((r) =>
      ids.has(r.id) ? { ...r, ...patch, updated_at: nowIso() } : r
    );
    persist();
    const updated = memory[table].filter((r) => ids.has(r.id));
    if (wantsRepresentation) return json(wantsObject ? updated[0] ?? null : updated);
    return new Response(null, { status: 204 });
  }

  if (method === "DELETE") {
    const targets = applyQuery(table, url.searchParams);
    const ids = new Set(targets.map((r) => r.id));
    memory[table] = memory[table].filter((r) => !ids.has(r.id));
    persist();
    if (wantsRepresentation) return json(targets);
    return new Response(null, { status: 204 });
  }

  return json({ message: `Método ${method} não suportado no modo local.` }, { status: 400 });
}

/* ────────────────────────────── storage emulation ────────────────────────────── */

async function handleStorage(url: URL, init: RequestInit): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  // .../storage/v1/object[/authenticated|/public|/sign]/<bucket>/<path...>
  const after = url.pathname.split("/storage/v1/object/")[1] ?? "";
  const cleaned = after.replace(/^(authenticated|public|sign)\//, "");
  const [bucket, ...rest] = cleaned.split("/");
  const path = decodeURIComponent(rest.join("/"));
  const key = `${bucket}/${path}`;

  if (method === "POST" || method === "PUT") {
    const body = init.body;
    const blob =
      body instanceof Blob
        ? body
        : body instanceof FormData
        ? ((body.get("file") ?? body.get("")) as Blob)
        : new Blob([body as BlobPart]);
    await idbPut(FILES, key, blob);
    return json({ Key: key, path }, { status: 200 });
  }

  if (method === "GET") {
    const blob = await idbGet<Blob>(FILES, key);
    if (!blob) return json({ message: "Arquivo não encontrado." }, { status: 404 });
    return new Response(blob, { status: 200, headers: { "Content-Type": "application/pdf" } });
  }

  if (method === "DELETE") {
    let prefixes: string[] = [path].filter(Boolean);
    try {
      const parsed = JSON.parse((init.body as string) || "{}");
      if (Array.isArray(parsed.prefixes)) prefixes = parsed.prefixes;
    } catch {
      /* keep default */
    }
    for (const p of prefixes) await idbPut(FILES, `${bucket}/${p}`, undefined);
    return json({ message: "ok" });
  }

  return json({ message: "Operação de storage não suportada." }, { status: 400 });
}

/* ────────────────────────────── activation ────────────────────────────── */

/** Realistic starting content so the product is demonstrable from the first open. */
function seed() {
  if (Object.keys(memory).length) return;

  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const a1 = crypto.randomUUID();
  const a2 = crypto.randomUUID();

  memory = {
    assets: [
      { id: a1, user_id: LOCAL_USER_ID, name: "Maxi Renda FII", ticker: "MXRF11", asset_type: "fii",
        description: "Fundo de recebíveis imobiliários.", created_at: daysAgo(30), updated_at: daysAgo(1) },
      { id: a2, user_id: LOCAL_USER_ID, name: "CSHG Logística", ticker: "HGLG11", asset_type: "fii",
        description: "Galpões logísticos de alto padrão.", created_at: daysAgo(24), updated_at: daysAgo(1) },
    ],
    documents: [],
    health_scores: [
      { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, asset_id: a1, ticker: "MXRF11", document_id: null,
        overall_score: 62, revenue_growth: 58, net_margin: 61, debt_level: 55, earnings_quality: 64,
        regulatory_risk: 30, sentiment: "bearish", confidence: 0.78,
        summary: "Resultado pressionado pela alta da vacância e por maior custo de dívida no curto prazo.",
        red_flags: ["Vacância física subiu de 4% para 7%", "Dívida de curto prazo 40% maior"],
        timeline_events: [{ date: "2026-05", event: "Divulgação do relatório gerencial" }],
        price_target_low: 9, price_target_high: 11, price_target_rationale: "Faixa derivada do valor patrimonial e da distribuição recente.",
        created_at: daysAgo(1), updated_at: daysAgo(1) },
      { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, asset_id: a1, ticker: "MXRF11", document_id: null,
        overall_score: 80, revenue_growth: 76, net_margin: 79, debt_level: 74, earnings_quality: 82,
        regulatory_risk: 25, sentiment: "bullish", confidence: 0.8,
        summary: "Distribuição estável e vacância sob controle no trimestre anterior.",
        red_flags: ["Dívida de curto prazo 40% maior"], timeline_events: [],
        price_target_low: 10, price_target_high: 12, price_target_rationale: null,
        created_at: daysAgo(21), updated_at: daysAgo(21) },
      { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, asset_id: a2, ticker: "HGLG11", document_id: null,
        overall_score: 88, revenue_growth: 85, net_margin: 84, debt_level: 90, earnings_quality: 87,
        regulatory_risk: 22, sentiment: "bullish", confidence: 0.85,
        summary: "Portfólio logístico com ocupação alta e contratos longos.",
        red_flags: [], timeline_events: [{ date: "2026-04", event: "Nova locação de galpão" }],
        price_target_low: 155, price_target_high: 172, price_target_rationale: null,
        created_at: daysAgo(2), updated_at: daysAgo(2) },
      { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, asset_id: a2, ticker: "HGLG11", document_id: null,
        overall_score: 80, revenue_growth: 78, net_margin: 80, debt_level: 83, earnings_quality: 79,
        regulatory_risk: 24, sentiment: "bullish", confidence: 0.8,
        summary: "Ocupação estável, sem eventos relevantes no período.",
        red_flags: [], timeline_events: [], price_target_low: null, price_target_high: null,
        price_target_rationale: null, created_at: daysAgo(20), updated_at: daysAgo(20) },
    ],
    sentiment_analyses: [],
    watchlist: [
      { id: crypto.randomUUID(), user_id: LOCAL_USER_ID, ticker: "XPML11", created_at: daysAgo(5) },
    ],
    conversations: [],
    messages: [],
    daily_briefs: [],
    profiles: [{ id: crypto.randomUUID(), user_id: LOCAL_USER_ID, display_name: "Você", custom_prompt: null, created_at: daysAgo(30), updated_at: daysAgo(30) }],
    groq_usage: [],
    scheduled_briefs: [],
    scheduled_brief_assets: [],
  };

  // sentiment rows mirror the analyses so the Sentiment page has content
  memory.sentiment_analyses = memory.health_scores.map((s: any) => ({
    id: crypto.randomUUID(), user_id: LOCAL_USER_ID, document_id: null, ticker: s.ticker,
    sentiment: s.sentiment, confidence: s.confidence, summary: s.summary, created_at: s.created_at,
  }));

  persist();
}

let originalFetch: typeof window.fetch | null = null;

/** Switches the app to the local backend and installs the fetch interceptor. */
export async function enableLocalBackend(): Promise<void> {
  if (active) return;
  active = true;

  try {
    idb = await openDb();
    const saved = await idbGet<Record<string, any[]>>(ROWS, "all");
    if (saved && Object.keys(saved).length) memory = saved;
  } catch {
    /* in-memory only */
  }
  seed();

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  if (!base || originalFetch) return;

  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (raw.startsWith(base)) {
      const url = new URL(raw);
      const merged: RequestInit =
        input instanceof Request
          ? { method: input.method, headers: input.headers, body: init.body ?? (input as any)._bodyInit, ...init }
          : init;

      if (url.pathname.includes("/rest/v1/")) {
        const table = url.pathname.split("/rest/v1/")[1]?.split("?")[0];
        if (table) return handleRest(table, url, merged);
      }
      if (url.pathname.includes("/storage/v1/object/")) {
        return handleStorage(url, merged);
      }
    }

    return originalFetch!(input as RequestInfo, init);
  };

  window.dispatchEvent(new Event("finsight-local-backend"));
}
