/**
 * Automatic alerts.
 *
 * Derived from the analysis history the app already stores, so the feature needs no new
 * tables, no cron and no backend: every time the user opens the app we compare each
 * asset's two most recent analyses and surface what changed. "Seen" state is local.
 */
import { supabase } from "@/integrations/supabase/client";

export type AlertKind =
  | "score_drop"
  | "score_rise"
  | "sentiment_flip"
  | "new_red_flag"
  | "high_risk";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  ticker: string;
  assetId: string | null;
  title: string;
  detail: string;
  at: string;
}

/** Score move (in points) that is worth telling the user about. */
const SCORE_DELTA = 5;
const REGULATORY_RISK_LIMIT = 70;
const SEEN_KEY = "finsight_alerts_seen";

interface ScoreRow {
  ticker: string | null;
  asset_id: string | null;
  overall_score: number;
  regulatory_risk: number;
  sentiment: string | null;
  red_flags: unknown;
  created_at: string;
}

const SENTIMENT_LABEL: Record<string, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutro",
};

function toFlags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) =>
      typeof f === "string"
        ? f
        : f && typeof f === "object" && "text" in (f as any)
        ? String((f as any).text)
        : ""
    )
    .filter(Boolean);
}

export function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function markSeen(ids: string[]) {
  const seen = getSeen();
  ids.forEach((id) => seen.add(id));
  // Keep the list from growing forever.
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-400)));
  window.dispatchEvent(new Event("finsight-alerts"));
}

/** Builds the alert list for a user, newest first. */
export async function computeAlerts(userId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("health_scores")
    .select("ticker, asset_id, overall_score, regulatory_risk, sentiment, red_flags, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  // Group by ticker when present, else by asset.
  const groups = new Map<string, ScoreRow[]>();
  for (const row of data as ScoreRow[]) {
    const key = row.ticker || row.asset_id;
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  const alerts: Alert[] = [];

  for (const [key, rows] of groups) {
    const latest = rows[0];
    const prev = rows[1];
    const label = latest.ticker || key;
    const stamp = latest.created_at;

    if (latest.regulatory_risk >= REGULATORY_RISK_LIMIT) {
      alerts.push({
        id: `${key}:high_risk:${stamp}`,
        kind: "high_risk",
        severity: "warning",
        ticker: label,
        assetId: latest.asset_id,
        title: `${label} com risco regulatório elevado`,
        detail: `O risco regulatório está em ${latest.regulatory_risk}/100 na análise mais recente.`,
        at: stamp,
      });
    }

    if (!prev) continue;

    const delta = latest.overall_score - prev.overall_score;
    if (Math.abs(delta) >= SCORE_DELTA) {
      const dropped = delta < 0;
      alerts.push({
        id: `${key}:${dropped ? "score_drop" : "score_rise"}:${stamp}`,
        kind: dropped ? "score_drop" : "score_rise",
        severity: dropped ? (delta <= -10 ? "critical" : "warning") : "info",
        ticker: label,
        assetId: latest.asset_id,
        title: `${label} ${dropped ? "caiu" : "subiu"} ${Math.abs(delta)} ponto${Math.abs(delta) > 1 ? "s" : ""}`,
        detail: `Health Score foi de ${prev.overall_score} para ${latest.overall_score}.`,
        at: stamp,
      });
    }

    if (latest.sentiment && prev.sentiment && latest.sentiment !== prev.sentiment) {
      alerts.push({
        id: `${key}:sentiment_flip:${stamp}`,
        kind: "sentiment_flip",
        severity: latest.sentiment === "bearish" ? "warning" : "info",
        ticker: label,
        assetId: latest.asset_id,
        title: `${label} mudou de sentimento`,
        detail: `De ${SENTIMENT_LABEL[prev.sentiment] ?? prev.sentiment} para ${
          SENTIMENT_LABEL[latest.sentiment] ?? latest.sentiment
        }.`,
        at: stamp,
      });
    }

    const before = new Set(toFlags(prev.red_flags));
    const added = toFlags(latest.red_flags).filter((f) => !before.has(f));
    if (added.length) {
      alerts.push({
        id: `${key}:new_red_flag:${stamp}`,
        kind: "new_red_flag",
        severity: "critical",
        ticker: label,
        assetId: latest.asset_id,
        title: `${label}: ${added.length} novo${added.length > 1 ? "s" : ""} ponto${
          added.length > 1 ? "s" : ""
        } de atenção`,
        detail: added.slice(0, 2).join(" · "),
        at: stamp,
      });
    }
  }

  return alerts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
