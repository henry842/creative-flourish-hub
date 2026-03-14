import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  TrendingUp, TrendingDown, Minus, Star, FileText, Zap, BarChart3, Activity, Target, Trash2,
  Download, ChevronDown, ChevronUp, Gauge,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, Legend,
} from "recharts";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type SentimentAnalysis = Tables<"sentiment_analyses">;

interface HealthScore {
  id: string;
  ticker: string | null;
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: string | null;
  created_at: string;
}

interface ScorePoint {
  date: string;
  score: number;
}

type SentimentFilter = "all" | "bullish" | "bearish" | "neutral";
type PeriodFilter = "7d" | "30d" | "90d" | "all";

const sentimentConfig = {
  bullish: { icon: TrendingUp, color: "text-bullish", bg: "bg-bullish/10", label: "Bullish" },
  bearish: { icon: TrendingDown, color: "text-bearish", bg: "bg-bearish/10", label: "Bearish" },
  neutral: { icon: Minus, color: "text-neutral", bg: "bg-neutral/10", label: "Neutro" },
};

export default function Sentiment() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SentimentAnalysis[]>([]);
  const [healthScores, setHealthScores] = useState<HealthScore[]>([]);
  const [scoreHistory, setScoreHistory] = useState<Record<string, ScorePoint[]>>({});
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = () => {
    if (!user) return;
    Promise.all([
      supabase.from("sentiment_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_scores").select("*").eq("user_id", user.id).not("ticker", "is", null).order("created_at", { ascending: true }),
      supabase.from("watchlist").select("ticker").eq("user_id", user.id),
    ]).then(([sentRes, scoresRes, watchRes]) => {
      setAnalyses(sentRes.data || []);
      const allScores = (scoresRes.data || []) as HealthScore[];
      setHealthScores(allScores);
      const history: Record<string, ScorePoint[]> = {};
      allScores.forEach((s) => {
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
  };

  useEffect(() => { fetchData(); }, [user]);

  // === Computed data ===

  // Sentiment evolution over time
  const sentimentEvolution = useMemo(() => {
    if (analyses.length === 0) return [];
    const sorted = [...analyses].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const byDate: Record<string, { bullish: number; bearish: number; neutral: number; total: number }> = {};
    sorted.forEach((a) => {
      const d = new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!byDate[d]) byDate[d] = { bullish: 0, bearish: 0, neutral: 0, total: 0 };
      byDate[d][a.sentiment as keyof typeof sentimentConfig]++;
      byDate[d].total++;
    });
    return Object.entries(byDate).map(([date, v]) => ({
      date,
      bullish: Math.round((v.bullish / v.total) * 100),
      bearish: Math.round((v.bearish / v.total) * 100),
      neutral: Math.round((v.neutral / v.total) * 100),
    }));
  }, [analyses]);

  // Momentum
  const momentum = useMemo(() => {
    if (analyses.length < 2) return null;
    const last3 = analyses.slice(0, 3);
    const bullishCount = last3.filter((a) => a.sentiment === "bullish").length;
    const bearishCount = last3.filter((a) => a.sentiment === "bearish").length;
    if (bullishCount >= 2) return "positive";
    if (bearishCount >= 2) return "negative";
    return "neutral";
  }, [analyses]);

  // By ticker
  const byTicker: Record<string, SentimentAnalysis[]> = {};
  analyses.forEach((a) => {
    const key = a.ticker || "sem_ticker";
    if (!byTicker[key]) byTicker[key] = [];
    byTicker[key].push(a);
  });

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

  // Period filter
  const getPeriodDate = (period: PeriodFilter): Date | null => {
    if (period === "all") return null;
    const now = new Date();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return new Date(now.getTime() - days * 86400000);
  };

  const filteredAnalyses = useMemo(() => {
    let result = analyses;
    if (sentimentFilter !== "all") result = result.filter((a) => a.sentiment === sentimentFilter);
    const periodDate = getPeriodDate(periodFilter);
    if (periodDate) result = result.filter((a) => new Date(a.created_at) >= periodDate);
    return result;
  }, [analyses, sentimentFilter, periodFilter]);

  // Variation badge per ticker
  const getVariation = (items: SentimentAnalysis[]) => {
    if (items.length < 2) return null;
    const current = items[0].sentiment;
    const previous = items[1].sentiment;
    const rank = { bullish: 3, neutral: 2, bearish: 1 };
    const diff = (rank[current as keyof typeof rank] || 2) - (rank[previous as keyof typeof rank] || 2);
    if (diff > 0) return "up";
    if (diff < 0) return "down";
    return "same";
  };

  // Radar data for a ticker
  const getRadarData = (ticker: string) => {
    const scores = healthScores.filter((s) => s.ticker === ticker);
    if (scores.length === 0) return null;
    const latest = scores[scores.length - 1];
    return [
      { dim: "Crescimento", value: latest.revenue_growth },
      { dim: "Margem", value: latest.net_margin },
      { dim: "Endividamento", value: 100 - latest.debt_level },
      { dim: "Qualidade", value: latest.earnings_quality },
      { dim: "Reg. Risk", value: 100 - latest.regulatory_risk },
    ];
  };

  // Comparison data
  const comparisonData = useMemo(() => {
    if (selectedTickers.size < 2) return null;
    const tickers = Array.from(selectedTickers);
    const allDates = new Set<string>();
    tickers.forEach((t) => scoreHistory[t]?.forEach((p) => allDates.add(p.date)));
    const sorted = Array.from(allDates).sort();
    return sorted.map((date) => {
      const point: Record<string, any> = { date };
      tickers.forEach((t) => {
        const match = scoreHistory[t]?.find((p) => p.date === date);
        point[t] = match?.score ?? null;
      });
      return point;
    });
  }, [selectedTickers, scoreHistory]);

  // === Actions ===

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

  const handleDeleteAnalysis = async (id: string) => {
    const { error } = await supabase.from("sentiment_analyses").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Análise removida ✅" });
    }
  };

  const toggleTickerSelect = (ticker: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedTickers((prev) => {
        const n = new Set(prev);
        if (n.has(ticker)) n.delete(ticker); else n.add(ticker);
        return n;
      });
    } else {
      setExpandedTicker(expandedTicker === ticker ? null : ticker);
    }
  };

  const exportCSV = () => {
    const headers = ["Ticker", "Sentimento", "Confiança", "Resumo", "Data"];
    const rows = filteredAnalyses.map((a) => [
      a.ticker || "N/A",
      a.sentiment,
      a.confidence ? `${(a.confidence * 100).toFixed(0)}%` : "—",
      `"${(a.summary || "").replace(/"/g, '""')}"`,
      new Date(a.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentimento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado! 📥" });
  };

  // Health score for expanded row
  const getHealthScoreForAnalysis = (analysis: SentimentAnalysis) => {
    return healthScores.find((s) => s.ticker === analysis.ticker);
  };

  const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--bullish))", "hsl(var(--bearish))", "hsl(var(--neutral))", "#8b5cf6", "#f59e0b"];

  const filterButtons: { key: SentimentFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "bullish", label: "Bullish" },
    { key: "bearish", label: "Bearish" },
    { key: "neutral", label: "Neutro" },
  ];

  const periodButtons: { key: PeriodFilter; label: string }[] = [
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "90d", label: "3 meses" },
    { key: "all", label: "Tudo" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Análise de Sentimento</h1>
        <p className="text-muted-foreground mt-1">Sentimento dos seus documentos financeiros</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
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
                <p className="text-sm text-muted-foreground">Faça upload de um PDF em <span className="font-medium text-foreground">Meus Ativos</span></p>
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
          {/* Summary cards - 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="p-3 rounded-xl bg-accent/10">
                  <Target className="h-7 w-7 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confiança média</p>
                  <p className="text-3xl font-bold font-display">{(avgConfidence * 100).toFixed(0)}%</p>
                </div>
              </CardContent>
            </Card>

            {/* Momentum card */}
            <Card className="glass">
              <CardContent className="py-6 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  momentum === "positive" ? "bg-bullish/10" : momentum === "negative" ? "bg-bearish/10" : "bg-muted"
                }`}>
                  {momentum === "positive" ? (
                    <TrendingUp className="h-7 w-7 text-bullish" />
                  ) : momentum === "negative" ? (
                    <TrendingDown className="h-7 w-7 text-bearish" />
                  ) : (
                    <Activity className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Momentum</p>
                  <p className={`text-lg font-bold font-display ${
                    momentum === "positive" ? "text-bullish" : momentum === "negative" ? "text-bearish" : "text-muted-foreground"
                  }`}>
                    {momentum === "positive" ? "📈 Positivo" : momentum === "negative" ? "📉 Negativo" : "➡️ Estável"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sentiment evolution chart */}
          {sentimentEvolution.length > 1 && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">Evolução do Sentimento</CardTitle>
                <p className="text-xs text-muted-foreground">% de análises bullish vs bearish ao longo do tempo</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={sentimentEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }}
                      formatter={(value: number, name: string) => [`${value}%`, name === "bullish" ? "Bullish" : name === "bearish" ? "Bearish" : "Neutro"]}
                    />
                    <Legend formatter={(value) => value === "bullish" ? "Bullish" : value === "bearish" ? "Bearish" : "Neutro"} />
                    <Area type="monotone" dataKey="bullish" stackId="1" stroke="hsl(var(--bullish))" fill="hsl(var(--bullish))" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="neutral" stackId="1" stroke="hsl(var(--neutral))" fill="hsl(var(--neutral))" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="bearish" stackId="1" stroke="hsl(var(--bearish))" fill="hsl(var(--bearish))" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison chart (Ctrl+click) */}
          {selectedTickers.size >= 2 && comparisonData && comparisonData.length > 0 && (
            <Card className="glass border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-lg">Comparação: {Array.from(selectedTickers).join(" vs ")}</CardTitle>
                    <p className="text-xs text-muted-foreground">Health Score ao longo do tempo</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTickers(new Set())} className="text-xs">
                    Limpar seleção
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                    <Legend />
                    {Array.from(selectedTickers).map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Hint for comparison */}
          {selectedTickers.size === 1 && (
            <p className="text-xs text-muted-foreground text-center">
              💡 Segure <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono">Ctrl</kbd> e clique em outro ticker para comparar
            </p>
          )}

          {/* Ticker cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(byTicker).map(([ticker, items]) => {
              const isUnidentified = ticker === "sem_ticker";
              const displayName = isUnidentified ? "Sem ticker identificado" : ticker;
              const dominant = items.reduce(
                (acc, curr) => { acc[curr.sentiment as keyof typeof acc]++; return acc; },
                { bullish: 0, bearish: 0, neutral: 0 }
              );
              const topSentiment = Object.entries(dominant).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof sentimentConfig;
              const cfg = sentimentConfig[topSentiment];
              const Icon = cfg.icon;
              const hasHistory = scoreHistory[ticker] && scoreHistory[ticker].length > 1;
              const sentimentPercent = Math.round((dominant[topSentiment] / items.length) * 100);
              const lastAnalysis = items[0]?.created_at;
              const variation = getVariation(items);
              const radarData = getRadarData(ticker);
              const isSelected = selectedTickers.has(ticker);

              return (
                <Card
                  key={ticker}
                  className={`hover:shadow-lg transition-all cursor-pointer ${
                    isUnidentified ? "border-dashed border-muted-foreground/30 opacity-70" : "glass border-l-4"
                  } ${isSelected ? "ring-2 ring-primary" : ""}`}
                  style={!isUnidentified ? { borderLeftColor: `hsl(var(--${topSentiment}))` } : undefined}
                  onClick={(e) => isUnidentified ? setExpandedTicker(expandedTicker === ticker ? null : ticker) : toggleTickerSelect(ticker, e)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-display text-lg">{displayName}</CardTitle>
                        {!isUnidentified && (
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); toggleWatchlist(ticker); }}
                            title={watchlistTickers.has(ticker) ? "Remover da watchlist" : "Adicionar à watchlist"}
                          >
                            <Star className={`h-4 w-4 ${watchlistTickers.has(ticker) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                          </Button>
                        )}
                      </div>
                      {/* Variation badge */}
                      {variation && (
                        <Badge className={`text-[10px] border-0 ${
                          variation === "up" ? "bg-bullish/10 text-bullish" : variation === "down" ? "bg-bearish/10 text-bearish" : "bg-muted text-muted-foreground"
                        }`}>
                          {variation === "up" ? "↑ Melhorou" : variation === "down" ? "↓ Piorou" : "= Estável"}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                        <span>{new Date(lastAnalysis).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      )}
                    </div>

                    {/* Expandable area */}
                    {(hasHistory || radarData) && (
                      <p className="text-xs text-primary">
                        {expandedTicker === ticker ? "▲ Fechar" : "▼ Ver gráficos"}
                      </p>
                    )}

                    {expandedTicker === ticker && (
                      <div className="space-y-4 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                        {/* Health Score evolution */}
                        {hasHistory && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Evolução do Health Score</p>
                            <ResponsiveContainer width="100%" height={160}>
                              <LineChart data={scoreHistory[ticker]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                                <YAxis domain={[0, 100]} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Radar chart */}
                        {radarData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Dimensões Fundamentais</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <RadarChart data={radarData}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis dataKey="dim" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                                <PolarRadiusAxis domain={[0, 100]} fontSize={9} stroke="hsl(var(--muted-foreground))" />
                                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
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
              <div className="flex items-center gap-3 flex-wrap">
                {/* Period filter */}
                <div className="flex gap-1">
                  {periodButtons.map((f) => (
                    <Button key={f.key} variant={periodFilter === f.key ? "secondary" : "ghost"} size="sm" onClick={() => setPeriodFilter(f.key)} className="text-[10px] h-7 px-2">
                      {f.label}
                    </Button>
                  ))}
                </div>
                <div className="w-px h-5 bg-border" />
                {/* Sentiment filter */}
                <div className="flex gap-1">
                  {filterButtons.map((f) => (
                    <Button key={f.key} variant={sentimentFilter === f.key ? "default" : "outline"} size="sm" onClick={() => setSentimentFilter(f.key)} className="text-xs">
                      {f.label}
                    </Button>
                  ))}
                </div>
                <div className="w-px h-5 bg-border" />
                {/* Export */}
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCSV}>
                  <Download className="h-3.5 w-3.5" /> Exportar CSV
                </Button>
              </div>
            </div>

            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Sentimento</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead className="hidden md:table-cell">Resumo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalyses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma análise com esse filtro
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAnalyses.map((a, idx) => {
                      const cfg2 = sentimentConfig[a.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
                      const isExpanded = expandedRow === a.id;
                      const relatedScore = getHealthScoreForAnalysis(a);

                      return (
                        <>
                          <TableRow
                            key={a.id}
                            className={`cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/30" : ""} ${isExpanded ? "bg-primary/5" : ""}`}
                            onClick={() => setExpandedRow(isExpanded ? null : a.id)}
                          >
                            <TableCell className="px-2">
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-medium">
                              {a.ticker || <span className="text-muted-foreground italic">N/A</span>}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${cfg2.bg} ${cfg2.color} border-0`}>{cfg2.label}</Badge>
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
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover análise?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta análise de sentimento será removida permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteAnalysis(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                          {/* Expanded row */}
                          {isExpanded && (
                            <TableRow key={`${a.id}-expanded`} className="bg-muted/20">
                              <TableCell colSpan={7} className="p-4">
                                <div className="space-y-3">
                                  {a.summary && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Resumo completo</p>
                                      <p className="text-sm">{a.summary}</p>
                                    </div>
                                  )}
                                  {relatedScore && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-2">Health Score</p>
                                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                        <div className="rounded-lg bg-background p-2.5 text-center">
                                          <p className="text-2xl font-bold text-primary">{relatedScore.overall_score}</p>
                                          <p className="text-[10px] text-muted-foreground">Score Geral</p>
                                        </div>
                                        {[
                                          { label: "Crescimento", value: relatedScore.revenue_growth },
                                          { label: "Margem", value: relatedScore.net_margin },
                                          { label: "Endivid.", value: relatedScore.debt_level },
                                          { label: "Qualidade", value: relatedScore.earnings_quality },
                                          { label: "Reg. Risk", value: relatedScore.regulatory_risk },
                                        ].map((m) => (
                                          <div key={m.label} className="rounded-lg bg-background p-2.5 text-center">
                                            <p className="text-lg font-semibold">{m.value}</p>
                                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {!a.summary && !relatedScore && (
                                    <p className="text-sm text-muted-foreground">Sem dados adicionais disponíveis.</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
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
