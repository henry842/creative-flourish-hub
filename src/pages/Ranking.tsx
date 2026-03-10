import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, TrendingDown, Minus, Medal, FileText, Zap } from "lucide-react";

interface RankedCompany {
  ticker: string;
  overall_score: number;
  sentiment: string;
  count: number;
}

export default function Ranking() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<RankedCompany[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("health_scores")
      .select("ticker, overall_score, sentiment")
      .eq("user_id", user.id)
      .not("ticker", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const byTicker: Record<string, { scores: number[]; sentiments: string[] }> = {};
        (data || []).forEach((d) => {
          const t = d.ticker!;
          if (!byTicker[t]) byTicker[t] = { scores: [], sentiments: [] };
          byTicker[t].scores.push(d.overall_score);
          byTicker[t].sentiments.push(d.sentiment || "neutral");
        });

        const ranked = Object.entries(byTicker)
          .map(([ticker, { scores, sentiments }]) => ({
            ticker,
            overall_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            sentiment: sentiments[0],
            count: scores.length,
          }))
          .sort((a, b) => b.overall_score - a.overall_score);

        setCompanies(ranked);
        setLoading(false);
      });
  }, [user]);

  const sentimentConfig: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
    bullish: { icon: TrendingUp, color: "text-bullish", label: "Bullish" },
    bearish: { icon: TrendingDown, color: "text-bearish", label: "Bearish" },
    neutral: { icon: Minus, color: "text-neutral", label: "Neutro" },
  };

  const getMedalColor = (pos: number) => {
    if (pos === 0) return "text-yellow-500";
    if (pos === 1) return "text-gray-400";
    if (pos === 2) return "text-amber-700";
    return "text-muted-foreground";
  };

  const scoreColor = (s: number) => s >= 80 ? "text-bullish" : s >= 60 ? "text-neutral" : "text-bearish";
  const scoreBg = (s: number) => s >= 80 ? "bg-bullish" : s >= 60 ? "bg-neutral" : "bg-bearish";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" /> Ranking de Empresas
        </h1>
        <p className="text-muted-foreground mt-1">Leaderboard das empresas analisadas por Health Score</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : companies.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground/40 mb-6" />
            <h3 className="font-display text-xl font-semibold mb-2">Nenhuma empresa no ranking ainda</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Analise pelo menos 2 empresas diferentes para comparar e ver quem lidera o ranking.
            </p>
            <div className="max-w-xs mx-auto space-y-3">
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Vá em <span className="font-medium text-foreground">Documentos</span> e faça upload de PDFs</p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Analise pelo menos <span className="font-medium text-foreground">2 tickers diferentes</span></p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Volte aqui para ver o <span className="font-medium text-foreground">ranking automático</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((company, i) => {
            const cfg = sentimentConfig[company.sentiment] || sentimentConfig.neutral;
            const Icon = cfg.icon;
            return (
              <Card key={company.ticker} className="glass hover:shadow-lg transition-shadow">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 shrink-0">
                    {i < 3 ? (
                      <Medal className={`h-8 w-8 ${getMedalColor(i)}`} />
                    ) : (
                      <span className="text-2xl font-display font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold">{company.ticker}</span>
                      <Badge variant="outline" className={cfg.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{company.count} análise{company.count > 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-32 hidden sm:block">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${scoreBg(company.overall_score)}`}
                          style={{ width: `${company.overall_score}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-2xl font-display font-bold ${scoreColor(company.overall_score)} min-w-[3rem] text-right`}>
                      {company.overall_score}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
