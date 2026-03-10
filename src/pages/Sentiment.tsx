import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type SentimentAnalysis = Tables<"sentiment_analyses">;

export default function Sentiment() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SentimentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("sentiment_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAnalyses(data || []);
        setLoading(false);
      });
  }, [user]);

  const sentimentConfig = {
    bullish: { icon: TrendingUp, color: "text-bullish", bg: "bg-bullish/10", label: "Bullish" },
    bearish: { icon: TrendingDown, color: "text-bearish", bg: "bg-bearish/10", label: "Bearish" },
    neutral: { icon: Minus, color: "text-neutral", bg: "bg-neutral/10", label: "Neutro" },
  };

  // Group by ticker
  const byTicker: Record<string, SentimentAnalysis[]> = {};
  analyses.forEach((a) => {
    const key = a.ticker || "Sem ticker";
    if (!byTicker[key]) byTicker[key] = [];
    byTicker[key].push(a);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Análise de Sentimento</h1>
        <p className="text-muted-foreground mt-1">Sentimento dos seus documentos financeiros</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : analyses.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma análise de sentimento ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use o chat para analisar seus documentos e gerar insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Ticker summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(byTicker).map(([ticker, items]) => {
              const dominant = items.reduce(
                (acc, curr) => {
                  acc[curr.sentiment as keyof typeof acc]++;
                  return acc;
                },
                { bullish: 0, bearish: 0, neutral: 0 }
              );
              const topSentiment = Object.entries(dominant).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof sentimentConfig;
              const cfg = sentimentConfig[topSentiment];
              const Icon = cfg.icon;

              return (
                <Card key={ticker} className={`glass hover:shadow-lg transition-shadow border-l-4`} style={{ borderLeftColor: `hsl(var(--${topSentiment}))` }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-lg">{ticker}</CardTitle>
                      <div className={`p-2 rounded-full ${cfg.bg}`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-bullish/10 text-bullish border-0">{dominant.bullish} bullish</Badge>
                      <Badge className="bg-bearish/10 text-bearish border-0">{dominant.bearish} bearish</Badge>
                      <Badge className="bg-neutral/10 text-neutral border-0">{dominant.neutral} neutro</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{items.length} análises</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Individual analyses */}
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Histórico</h2>
            {analyses.map((a) => {
              const cfg = sentimentConfig[a.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
              const Icon = cfg.icon;
              return (
                <Card key={a.id} className="glass">
                  <CardContent className="py-4 flex items-start gap-4">
                    <div className={`p-2 rounded-full ${cfg.bg} shrink-0 mt-1`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{cfg.label}</Badge>
                        {a.ticker && <Badge variant="secondary">{a.ticker}</Badge>}
                        {a.confidence && (
                          <span className="text-xs text-muted-foreground">
                            {(a.confidence * 100).toFixed(0)}% confiança
                          </span>
                        )}
                      </div>
                      {a.summary && <p className="text-sm text-muted-foreground">{a.summary}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
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
