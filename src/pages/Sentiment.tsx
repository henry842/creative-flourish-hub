import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Star, FileText, Zap, BarChart3, Activity, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type SentimentAnalysis = Tables<"sentiment_analyses">;

interface ScorePoint {
  date: string;
  score: number;
}

type SentimentFilter = "all" | "bullish" | "bearish" | "neutral";

export default function Sentiment() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SentimentAnalysis[]>([]);
  const [scoreHistory, setScoreHistory] = useState<Record<string, ScorePoint[]>>({});
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("sentiment_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("health_scores")
        .select("ticker, overall_score, created_at")
        .eq("user_id", user.id)
        .not("ticker", "is", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("watchlist")
        .select("ticker")
        .eq("user_id", user.id),
    ]).then(([sentRes, scoresRes, watchRes]) => {
      setAnalyses(sentRes.data || []);

      const history: Record<string, ScorePoint[]> = {};
      (scoresRes.data || []).forEach((s) => {
        const t = s.ticker!;
        if (!history[t]) history[t] = [];
        history[t].push({
          date: new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          score: s.overall_score,
        });
      });
      setScoreHistory(history);
      setWatchlistTickers(new Set((watchRes.data || []).map((w: any) => w.ticker)));
      setLoading(false);
    });
  }, [user]);

  const toggleWatchlist = async (tickerName: string) => {
    if (!user || !tickerName) return;
    if (watchlistTickers.has(tickerName)) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("ticker", tickerName);
      setWatchlistTickers((prev) => { const n = new Set(prev); n.delete(tickerName); return n; });
      toast({ title: `${tickerName} removido da watchlist` });
    } else {
      await supabase.from("watchlist").insert({ user_id: user.id, ticker: tickerName });
      setWatchlistTickers((prev) => new Set(prev).add(tickerName));
      toast({ title: `${tickerName} adicionado à watchlist ⭐` });
    }
  };

  const sentimentConfig = {
    bullish: { icon: TrendingUp, color: "text-bullish", bg: "bg-bullish/10", label: "Bullish" },
    bearish: { icon: TrendingDown, color: "text-bearish", bg: "bg-bearish/10", label: "Bearish" },
    neutral: { icon: Minus, color: "text-neutral", bg: "bg-neutral/10", label: "Neutro" },
  };

  const byTicker: Record<string, SentimentAnalysis[]> = {};
  analyses.forEach((a) => {
    const key = a.ticker || "sem_ticker";
    if (!byTicker[key]) byTicker[key] = [];
    byTicker[key].push(a);
  });

  // Summary calculations
  const uniqueTickers = Object.keys(byTicker).filter((t) => t !== "sem_ticker");
  const allSentiments = analyses.map((a) => a.sentiment);
  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  allSentiments.forEach((s) => {
    if (s in sentimentCounts) sentimentCounts[s as keyof typeof sentimentCounts]++;
  });
  const predominantSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof sentimentConfig | undefined;
  const avgConfidence = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / analyses.length
    : 0;

  // Filtered analyses for table
  const filteredAnalyses = sentimentFilter === "all"
    ? analyses
    : analyses.filter((a) => a.sentiment === sentimentFilter);

  const filterButtons: { key: SentimentFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "bullish", label: "Bullish" },
    { key: "bearish", label: "Bearish" },
    { key: "neutral", label: "Neutro" },
  ];

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
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground/40 mb-6" />
            <h3 className="font-display text-xl font-semibold mb-2">Nenhuma análise de sentimento ainda</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Análises de sentimento são geradas automaticamente ao analisar seus documentos financeiros.
            </p>
            <div className="max-w-xs mx-auto space-y-3">
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Faça upload de um PDF em <span className="font-medium text-foreground">Documentos</span></p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Clique em <span className="font-medium text-foreground">Analisar</span> para gerar o sentimento</p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Os resultados aparecem <span className="font-medium text-foreground">automaticamente aqui</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass">
              <CardContent className="py-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <BarChart3 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empresas analisadas</p>
                  <p className="text-3xl font-bold font-display">{uniqueTickers.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="py-6 flex items-center gap-4">
                {predominantSentiment && (() => {
                  const cfg = sentimentConfig[predominantSentiment];
                  const Icon = cfg.icon;
                  return (
                    <>
                      <div className={`p-3 rounded-xl ${cfg.bg}`}>
                        <Icon className={`h-7 w-7 ${cfg.color}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sentimento predominante</p>
                        <p className={`text-2xl font-bold font-display ${cfg.color}`}>{cfg.label}</p>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="py-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent/50">
                  <Target className="h-7 w-7 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confiança média</p>
                  <p className="text-3xl font-bold font-display">{(avgConfidence * 100).toFixed(0)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ticker cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(byTicker).map(([ticker, items]) => {
              const isUnidentified = ticker === "sem_ticker";
              const displayName = isUnidentified ? "Sem ticker identificado" : ticker;
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
              const hasHistory = scoreHistory[ticker] && scoreHistory[ticker].length > 1;
              const sentimentPercent = Math.round((dominant[topSentiment] / items.length) * 100);
              const lastAnalysis = items[0]?.created_at;

              return (
                <Card
                  key={ticker}
                  className={`hover:shadow-lg transition-all cursor-pointer ${
                    isUnidentified
                      ? "border-dashed border-muted-foreground/30 opacity-70"
                      : "glass border-l-4"
                  }`}
                  style={!isUnidentified ? { borderLeftColor: `hsl(var(--${topSentiment}))` } : undefined}
                  onClick={() => setExpandedTicker(expandedTicker === ticker ? null : ticker)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-display text-lg">{displayName}</CardTitle>
                        {!isUnidentified && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); toggleWatchlist(ticker); }}
                            title={watchlistTickers.has(ticker) ? "Remover da watchlist" : "Adicionar à watchlist"}
                          >
                            <Star className={`h-4 w-4 ${watchlistTickers.has(ticker) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Large sentiment score */}
                    <div className="flex items-center justify-center gap-3 py-3">
                      <div className={`p-3 rounded-full ${cfg.bg}`}>
                        <Icon className={`h-8 w-8 ${cfg.color}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-4xl font-bold font-display ${cfg.color}`}>{sentimentPercent}%</p>
                        <p className="text-xs text-muted-foreground">{cfg.label}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-bullish/10 text-bullish border-0">{dominant.bullish} bullish</Badge>
                      <Badge className="bg-bearish/10 text-bearish border-0">{dominant.bearish} bearish</Badge>
                      <Badge className="bg-neutral/10 text-neutral border-0">{dominant.neutral} neutro</Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <span>{items.length} análise{items.length > 1 ? "s" : ""}</span>
                      {lastAnalysis && (
                        <span>
                          {new Date(lastAnalysis).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {hasHistory && (
                      <p className="text-xs text-primary">
                        {expandedTicker === ticker ? "▲ Fechar gráfico" : "▼ Ver evolução do score"}
                      </p>
                    )}

                    {expandedTicker === ticker && hasHistory && (
                      <div className="pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Evolução do Health Score</p>
                        <ResponsiveContainer width="100%" height={160}>
                          <LineChart data={scoreHistory[ticker]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                            <YAxis domain={[0, 100]} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                                fontSize: 12,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))", r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* History table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-display text-xl font-semibold">Histórico</h2>
              <div className="flex gap-1">
                {filterButtons.map((f) => (
                  <Button
                    key={f.key}
                    variant={sentimentFilter === f.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSentimentFilter(f.key)}
                    className="text-xs"
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead className="hidden md:table-cell">Resumo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma análise com esse filtro
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnalyses.map((a, idx) => {
                      const cfg = sentimentConfig[a.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
                      return (
                        <TableRow key={a.id} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            {a.ticker || <span className="text-muted-foreground italic">N/A</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${cfg.bg} ${cfg.color} border-0`}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.confidence ? `${(a.confidence * 100).toFixed(0)}%` : "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                            {a.summary || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
