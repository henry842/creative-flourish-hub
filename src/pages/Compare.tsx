import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, Trophy, Crown } from "lucide-react";

interface HealthScore {
  id: string;
  ticker: string | null;
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: string;
  summary: string | null;
  created_at: string;
}

const categories = [
  { key: "overall_score" as const, label: "Score Geral" },
  { key: "revenue_growth" as const, label: "Crescimento de Receita" },
  { key: "net_margin" as const, label: "Margem Líquida" },
  { key: "debt_level" as const, label: "Endividamento" },
  { key: "earnings_quality" as const, label: "Qualidade dos Lucros" },
  { key: "regulatory_risk" as const, label: "Risco Regulatório" },
];

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

export default function Compare() {
  const { user } = useAuth();
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker1, setTicker1] = useState("");
  const [ticker2, setTicker2] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("health_scores")
      .select("*")
      .eq("user_id", user.id)
      .not("ticker", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setScores((data as HealthScore[]) || []);
        setLoading(false);
      });
  }, [user]);

  const tickers = [...new Set(scores.filter((s) => s.ticker).map((s) => s.ticker!))];
  const score1 = scores.find((s) => s.ticker === ticker1);
  const score2 = scores.find((s) => s.ticker === ticker2);

  let wins1 = 0, wins2 = 0;
  if (score1 && score2) {
    categories.forEach(({ key }) => {
      if (score1[key] > score2[key]) wins1++;
      else if (score2[key] > score1[key]) wins2++;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Swords className="h-8 w-8 text-primary" />
          Modo Batalha
        </h1>
        <p className="text-muted-foreground mt-1">Compare duas empresas lado a lado</p>
      </div>

      {/* Ticker selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass">
          <CardContent className="pt-6">
            <Select value={ticker1} onValueChange={setTicker1}>
              <SelectTrigger><SelectValue placeholder="Empresa 1" /></SelectTrigger>
              <SelectContent>
                {tickers.filter((t) => t !== ticker2).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <Select value={ticker2} onValueChange={setTicker2}>
              <SelectTrigger><SelectValue placeholder="Empresa 2" /></SelectTrigger>
              <SelectContent>
                {tickers.filter((t) => t !== ticker1).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {loading && <Skeleton className="h-64" />}

      {!loading && tickers.length < 2 && (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <Swords className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Você precisa de pelo menos 2 empresas analisadas para comparar.</p>
            <p className="text-sm text-muted-foreground mt-1">Envie documentos com tickers diferentes e analise-os primeiro.</p>
          </CardContent>
        </Card>
      )}

      {/* Comparison */}
      {score1 && score2 && (
        <>
          {/* Winner banner */}
          <Card className="glass border-primary/50">
            <CardContent className="py-6 text-center">
              <Crown className="h-8 w-8 mx-auto text-neutral mb-2" />
              <p className="font-display text-xl font-bold">
                {wins1 > wins2 ? (
                  <><span className="text-bullish">{ticker1}</span> vence {wins1}×{wins2}</>
                ) : wins2 > wins1 ? (
                  <><span className="text-bullish">{ticker2}</span> vence {wins2}×{wins1}</>
                ) : (
                  "Empate!"
                )}
              </p>
            </CardContent>
          </Card>

          {/* Category comparison */}
          <div className="space-y-3">
            {categories.map(({ key, label }) => {
              const v1 = score1[key];
              const v2 = score2[key];
              const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
              return (
                <Card key={key} className="glass">
                  <CardContent className="py-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3 text-center">{label}</p>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                      {/* Left */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {winner === 1 && <Trophy className="h-4 w-4 text-neutral" />}
                          <span className={`text-2xl font-display font-bold ${scoreColor(v1)}`}>{v1}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                          <div className={`h-full rounded-full ${scoreBg(v1)} ml-auto`} style={{ width: `${v1}%` }} />
                        </div>
                      </div>
                      <span className="text-muted-foreground text-sm font-medium">VS</span>
                      {/* Right */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-display font-bold ${scoreColor(v2)}`}>{v2}</span>
                          {winner === 2 && <Trophy className="h-4 w-4 text-neutral" />}
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                          <div className={`h-full rounded-full ${scoreBg(v2)}`} style={{ width: `${v2}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mt-1">
                      <p className="text-right text-xs text-muted-foreground">{ticker1}</p>
                      <span />
                      <p className="text-xs text-muted-foreground">{ticker2}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
