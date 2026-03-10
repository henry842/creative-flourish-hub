import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";

interface HealthScore {
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: string;
  confidence: number;
  summary: string | null;
  ticker: string | null;
  price_target_low?: number | null;
  price_target_high?: number | null;
  price_target_rationale?: string | null;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-bullish";
  if (score >= 60) return "text-neutral";
  return "text-bearish";
}

function scoreBg(score: number) {
  if (score >= 80) return "bg-bullish";
  if (score >= 60) return "bg-neutral";
  return "bg-bearish";
}

function scoreEmoji(score: number) {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  return "🔴";
}

const categories = [
  { key: "revenue_growth" as const, label: "Crescimento de Receita" },
  { key: "net_margin" as const, label: "Margem Líquida" },
  { key: "debt_level" as const, label: "Nível de Endividamento" },
  { key: "earnings_quality" as const, label: "Qualidade dos Lucros" },
  { key: "regulatory_risk" as const, label: "Risco Regulatório" },
];

export function HealthScoreCard({ score }: { score: HealthScore }) {
  const sentimentConfig = {
    bullish: { icon: TrendingUp, label: "Bullish", color: "text-bullish" },
    bearish: { icon: TrendingDown, label: "Bearish", color: "text-bearish" },
    neutral: { icon: Minus, label: "Neutro", color: "text-neutral" },
  };

  const cfg = sentimentConfig[score.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const SentimentIcon = cfg.icon;

  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Financial Health Score
          </CardTitle>
          {score.ticker && <Badge variant="secondary" className="font-mono">{score.ticker}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall Score */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={score.overall_score >= 80 ? "hsl(var(--bullish))" : score.overall_score >= 60 ? "hsl(var(--neutral))" : "hsl(var(--bearish))"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(score.overall_score / 100) * 264} 264`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute text-2xl font-display font-bold ${scoreColor(score.overall_score)}`}>
              {score.overall_score}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">Score Geral {scoreEmoji(score.overall_score)}</p>
            <div className="flex items-center gap-2">
              <SentimentIcon className={`h-4 w-4 ${cfg.color}`} />
              <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-muted-foreground">
                ({(score.confidence * 100).toFixed(0)}% confiança)
              </span>
            </div>
            {score.summary && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{score.summary}</p>
            )}
          </div>
        </div>

        {/* Category Bars */}
        <div className="space-y-3">
          {categories.map(({ key, label }) => {
            const val = score[key];
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium ${scoreColor(val)}`}>
                    {val}/100 {scoreEmoji(val)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${scoreBg(val)}`}
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
