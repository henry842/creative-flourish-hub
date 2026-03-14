import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, MessageSquare, TrendingUp, TrendingDown, Minus, Activity,
  Star, X, Plus, Bell, Clock, Trophy, Upload, Brain, Zap, ArrowRight,
  ChevronUp, ChevronDown, Folder,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { PortfolioCharts } from "@/components/PortfolioCharts";

interface Stats {
  totalDocs: number;
  totalConversations: number;
  totalAssets: number;
  sentimentCounts: { bullish: number; bearish: number; neutral: number };
  recentSentiments: { date: string; bullish: number; bearish: number; neutral: number }[];
  // month-over-month
  docsThisMonth: number;
  convsThisMonth: number;
  analysesThisMonth: number;
}

interface WatchlistItem {
  id: string;
  ticker: string;
  lastScore?: number;
  lastSentiment?: string;
}

interface RankedAsset {
  id: string;
  name: string;
  ticker: string | null;
  score: number;
  sentiment: string;
}

interface ActivityItem {
  id: string;
  type: "document" | "analysis" | "briefing";
  description: string;
  created_at: string;
}

interface PortfolioHealth {
  avgScore: number;
  prevAvgScore: number | null;
  totalAssets: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [lastBrief, setLastBrief] = useState<{ content: string; created_at: string } | null>(null);
  const [rankedAssets, setRankedAssets] = useState<RankedAsset[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [portfolioHealth, setPortfolioHealth] = useState<PortfolioHealth | null>(null);
  const [nextBriefTime, setNextBriefTime] = useState<string | null>(null);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [latestByAssetId, setLatestByAssetId] = useState<Record<string, { score: number; sentiment: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newTicker, setNewTicker] = useState("");
  const [addingTicker, setAddingTicker] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      docsRes, convsRes, sentRes, watchRes, scoresRes, briefRes,
      assetsRes, docsMonthRes, convsMonthRes, sentMonthRes,
      recentDocsRes, recentBriefsRes, scheduledRes,
    ] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("sentiment_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("watchlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_scores").select("ticker, overall_score, sentiment, created_at, asset_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("daily_briefs").select("content, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("assets").select("id, name, ticker, asset_type").eq("user_id", user.id).order("name"),
      // Month counts
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfMonth),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfMonth),
      supabase.from("sentiment_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfMonth),
      // Recent activity
      supabase.from("documents").select("id, name, ticker, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("daily_briefs").select("id, created_at, tickers").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
      // Scheduled brief config
      supabase.from("scheduled_briefs").select("schedule_time, is_active").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    ]);

    // Sentiments
    const sentiments = sentRes.data || [];
    const counts = { bullish: 0, bearish: 0, neutral: 0 };
    sentiments.forEach((s) => {
      if (s.sentiment in counts) counts[s.sentiment as keyof typeof counts]++;
    });

    const byDate: Record<string, { bullish: number; bearish: number; neutral: number }> = {};
    sentiments.forEach((s) => {
      const date = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!byDate[date]) byDate[date] = { bullish: 0, bearish: 0, neutral: 0 };
      if (s.sentiment in byDate[date]) byDate[date][s.sentiment as keyof typeof counts]++;
    });

    // Scores + Watchlist
    const scores = scoresRes.data || [];
    const assets = assetsRes.data || [];
    const latestByTicker: Record<string, { score: number; sentiment: string }> = {};
    scores.forEach((s) => {
      if (s.ticker && !latestByTicker[s.ticker]) {
        latestByTicker[s.ticker] = { score: s.overall_score, sentiment: s.sentiment || "neutral" };
      }
    });

    const wl: WatchlistItem[] = (watchRes.data || []).map((w: any) => ({
      id: w.id,
      ticker: w.ticker,
      lastScore: latestByTicker[w.ticker]?.score,
      lastSentiment: latestByTicker[w.ticker]?.sentiment,
    }));
    setWatchlist(wl);

    // Ranked assets (top 3 by health score)
    const latestByAssetId: Record<string, { score: number; sentiment: string }> = {};
    scores.forEach((s) => {
      if (s.asset_id && !latestByAssetId[s.asset_id]) {
        latestByAssetId[s.asset_id] = { score: s.overall_score, sentiment: s.sentiment || "neutral" };
      }
    });

    const ranked = assets
      .filter((a) => latestByAssetId[a.id])
      .map((a) => ({
        id: a.id,
        name: a.name,
        ticker: a.ticker,
        score: latestByAssetId[a.id].score,
        sentiment: latestByAssetId[a.id].sentiment,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    setRankedAssets(ranked);

    // Portfolio health
    const assetScores = assets
      .filter((a) => latestByAssetId[a.id])
      .map((a) => latestByAssetId[a.id].score);

    if (assetScores.length > 0) {
      const avgScore = Math.round(assetScores.reduce((a, b) => a + b, 0) / assetScores.length);

      // Previous week avg
      const prevWeekScores = scores.filter((s) => s.asset_id && s.created_at < oneWeekAgo);
      const prevByAsset: Record<string, number> = {};
      prevWeekScores.forEach((s) => {
        if (s.asset_id && !prevByAsset[s.asset_id]) prevByAsset[s.asset_id] = s.overall_score;
      });
      const prevValues = Object.values(prevByAsset);
      const prevAvg = prevValues.length > 0 ? Math.round(prevValues.reduce((a, b) => a + b, 0) / prevValues.length) : null;

      setPortfolioHealth({ avgScore, prevAvgScore: prevAvg, totalAssets: assetScores.length });
    }

    // Activity timeline
    const activityItems: ActivityItem[] = [];
    (recentDocsRes.data || []).forEach((d: any) => {
      activityItems.push({
        id: `doc-${d.id}`,
        type: "document",
        description: `Upload: ${d.name}${d.ticker ? ` (${d.ticker})` : ""}`,
        created_at: d.created_at,
      });
    });
    sentiments.slice(0, 5).forEach((s) => {
      activityItems.push({
        id: `sent-${s.id}`,
        type: "analysis",
        description: `Análise de sentimento${s.ticker ? `: ${s.ticker}` : ""} → ${s.sentiment === "bullish" ? "🟢 Bullish" : s.sentiment === "bearish" ? "🔴 Bearish" : "🟡 Neutro"}`,
        created_at: s.created_at,
      });
    });
    (recentBriefsRes.data || []).forEach((b: any) => {
      const tickers = b.tickers?.length > 0 ? ` (${b.tickers.slice(0, 3).join(", ")})` : "";
      activityItems.push({
        id: `brief-${b.id}`,
        type: "briefing",
        description: `Briefing gerado${tickers}`,
        created_at: b.created_at,
      });
    });
    activityItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivities(activityItems.slice(0, 5));

    // Next briefing
    if (scheduledRes.data) {
      const scheduleTime = scheduledRes.data.schedule_time;
      const [hours] = scheduleTime.split(":");
      const todayAt = new Date();
      todayAt.setHours(parseInt(hours), 0, 0, 0);
      if (todayAt > now) {
        setNextBriefTime(`Hoje às ${scheduleTime.substring(0, 5)}`);
      } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        setNextBriefTime(`Amanhã às ${scheduleTime.substring(0, 5)}`);
      }
    }

    // Briefing
    if (briefRes.data && briefRes.data.length > 0) {
      setLastBrief(briefRes.data[0] as any);
    }

    const total = counts.bullish + counts.bearish + counts.neutral;

    setStats({
      totalDocs: docsRes.count || 0,
      totalConversations: convsRes.count || 0,
      totalAssets: assets.length,
      sentimentCounts: counts,
      recentSentiments: Object.entries(byDate).map(([date, v]) => ({ date, ...v })).reverse(),
      docsThisMonth: docsMonthRes.count || 0,
      convsThisMonth: convsMonthRes.count || 0,
      analysesThisMonth: sentMonthRes.count || 0,
    });

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const removeFromWatchlist = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    toast({ title: "Removido da watchlist" });
  };

  const addToWatchlist = async () => {
    if (!user || !newTicker.trim()) return;
    const tickerUpper = newTicker.trim().toUpperCase();
    if (watchlist.some((w) => w.ticker === tickerUpper)) {
      toast({ title: "Ticker já existe na watchlist", variant: "destructive" });
      return;
    }
    setAddingTicker(true);
    const { data, error } = await supabase
      .from("watchlist")
      .insert({ user_id: user.id, ticker: tickerUpper })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setWatchlist((prev) => [{ id: data.id, ticker: data.ticker }, ...prev]);
      setNewTicker("");
      toast({ title: `${tickerUpper} adicionado à watchlist ⭐` });
    }
    setAddingTicker(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  };

  const scoreColor = (s: number) => s >= 80 ? "text-bullish" : s >= 60 ? "text-neutral" : "text-bearish";
  const scoreBg = (s: number) => s >= 80 ? "hsl(var(--bullish))" : s >= 60 ? "hsl(var(--neutral))" : "hsl(var(--bearish))";

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const total = (stats?.sentimentCounts.bullish || 0) + (stats?.sentimentCounts.bearish || 0) + (stats?.sentimentCounts.neutral || 0);
  const hasData = (stats?.totalDocs || 0) > 0 || (stats?.totalAssets || 0) > 0 || total > 0;

  // Empty state
  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo à sua central de inteligência</p>
        </div>
        <Card className="glass max-w-2xl mx-auto">
          <CardContent className="py-12 space-y-8">
            <div className="text-center space-y-2">
              <div className="text-5xl mb-4">🚀</div>
              <h2 className="font-display text-2xl font-bold">Comece sua jornada</h2>
              <p className="text-muted-foreground">
                Configure sua carteira em 3 passos simples e comece a receber análises inteligentes.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { step: 1, icon: Folder, title: "Crie seu primeiro ativo", desc: "Adicione um FII, ação ou qualquer investimento", action: "Criar Ativo", path: "/assets" },
                { step: 2, icon: Upload, title: "Faça upload de um PDF", desc: "Relatório gerencial, informe trimestral ou qualquer documento", action: "Ir para Ativos", path: "/assets" },
                { step: 3, icon: Brain, title: "Gere sua primeira análise", desc: "A IA vai extrair scores, riscos e sentimento automaticamente", action: "Ir para Ativos", path: "/assets" },
              ].map(({ step, icon: Icon, title, desc, action, path }) => (
                <div key={step} className="flex items-center gap-4 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-display font-bold text-lg shrink-0">
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <p className="font-medium">{title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(path)} className="shrink-0">
                    {action} <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieData = stats ? [
    { name: "Bullish", value: stats.sentimentCounts.bullish, color: "hsl(160, 84%, 39%)" },
    { name: "Bearish", value: stats.sentimentCounts.bearish, color: "hsl(0, 84%, 60%)" },
    { name: "Neutral", value: stats.sentimentCounts.neutral, color: "hsl(45, 93%, 47%)" },
  ].filter(d => d.value > 0) : [];

  const activityIcon = (type: string) => {
    switch (type) {
      case "document": return <FileText className="h-4 w-4 text-primary" />;
      case "analysis": return <Brain className="h-4 w-4 text-accent" />;
      case "briefing": return <Bell className="h-4 w-4 text-amber-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const medalEmoji = (i: number) => i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";

  const healthDiff = portfolioHealth?.prevAvgScore != null
    ? portfolioHealth.avgScore - portfolioHealth.prevAvgScore
    : null;

  const monthBadge = (count: number) =>
    count > 0 ? (
      <span className="text-xs text-bullish font-medium">+{count} este mês</span>
    ) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da sua inteligência financeira</p>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats?.totalDocs || 0}</div>
            {monthBadge(stats?.docsThisMonth || 0)}
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats?.totalConversations || 0}</div>
            {monthBadge(stats?.convsThisMonth || 0)}
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Análises</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{total}</div>
            {monthBadge(stats?.analysesThisMonth || 0)}
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sentimento Geral</CardTitle>
            {stats && stats.sentimentCounts.bullish >= stats.sentimentCounts.bearish ? (
              <TrendingUp className="h-4 w-4 text-bullish" />
            ) : (
              <TrendingDown className="h-4 w-4 text-bearish" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-xl font-display font-bold">
              {total === 0 ? "—" : stats && stats.sentimentCounts.bullish > stats.sentimentCounts.bearish ? "Bullish" : stats && stats.sentimentCounts.bearish > stats.sentimentCounts.bullish ? "Bearish" : "Neutro"}
            </div>
            <span className="text-xs text-muted-foreground">{stats?.totalAssets || 0} ativos monitorados</span>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Health + Next Briefing row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Portfolio Health Card */}
        <Card className="glass lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Saúde da Carteira
            </CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioHealth ? (
              <div className="flex items-center gap-8">
                {/* Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={scoreBg(portfolioHealth.avgScore)}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(portfolioHealth.avgScore / 100) * 264} 264`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className={`absolute text-3xl font-display font-bold ${scoreColor(portfolioHealth.avgScore)}`}>
                    {portfolioHealth.avgScore}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium">Média geral dos Health Scores</p>
                  <p className="text-sm text-muted-foreground">
                    Baseado em {portfolioHealth.totalAssets} ativo{portfolioHealth.totalAssets !== 1 ? "s" : ""} analisado{portfolioHealth.totalAssets !== 1 ? "s" : ""}
                  </p>
                  {healthDiff !== null && (
                    <div className="flex items-center gap-1.5">
                      {healthDiff >= 0 ? (
                        <ChevronUp className="h-4 w-4 text-bullish" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-bearish" />
                      )}
                      <span className={`text-sm font-medium ${healthDiff >= 0 ? "text-bullish" : "text-bearish"}`}>
                        {healthDiff >= 0 ? "+" : ""}{healthDiff} pontos vs semana anterior
                        {healthDiff >= 0 ? " ✅" : " ⚠️"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Analise documentos dos seus ativos para ver o score da carteira</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Briefing + Last Briefing */}
        <div className="space-y-4">
          {/* Next Briefing */}
          <Card className="glass">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Próximo briefing</p>
                  <p className="font-medium text-sm truncate">
                    {nextBriefTime || "Não agendado"}
                  </p>
                </div>
                {!nextBriefTime && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/briefing")} className="shrink-0">
                    Agendar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Last Briefing */}
          <Card className="glass hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Último Briefing
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/briefing")} className="text-xs">
                Ver completo →
              </Button>
            </CardHeader>
            <CardContent>
              {lastBrief ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {new Date(lastBrief.created_at).toLocaleDateString("pt-BR", {
                      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm line-clamp-2 text-muted-foreground">
                    {lastBrief.content.split("\n").filter(l => l.trim()).slice(0, 2).join(" ").substring(0, 140)}...
                  </p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground mb-1">Nenhum briefing gerado</p>
                  <Button variant="secondary" size="sm" onClick={() => navigate("/briefing")}>
                    Configurar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Watchlist + Ranking row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watchlist */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" /> Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar ticker (ex: PETR4)..."
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && addToWatchlist()}
                className="max-w-xs"
              />
              <Button onClick={addToWatchlist} disabled={addingTicker || !newTicker.trim()} size="sm" className="gap-1">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {watchlist.length > 0 ? (
              <div className="space-y-2">
                {watchlist.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-sm">{w.ticker}</span>
                      {w.lastScore !== undefined && (
                        <span className={`text-sm font-medium ${scoreColor(w.lastScore)}`}>
                          {w.lastScore}/100
                        </span>
                      )}
                      {w.lastSentiment && (
                        <Badge variant="outline" className="text-xs">
                          {w.lastSentiment === "bullish" ? "🟢" : w.lastSentiment === "bearish" ? "🔴" : "🟡"}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromWatchlist(w.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum ticker na watchlist</p>
            )}
          </CardContent>
        </Card>

        {/* Ranking Top 3 */}
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Top Ativos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/ranking")} className="text-xs">
              Ver ranking completo →
            </Button>
          </CardHeader>
          <CardContent>
            {rankedAssets.length > 0 ? (
              <div className="space-y-3">
                {rankedAssets.map((asset, i) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <span className="text-2xl">{medalEmoji(i)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{asset.name}</p>
                      {asset.ticker && (
                        <p className="text-xs text-muted-foreground">{asset.ticker}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-display font-bold text-lg ${scoreColor(asset.score)}`}>
                        {asset.score}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {asset.sentiment === "bullish" ? "🟢 Bullish" : asset.sentiment === "bearish" ? "🔴 Bearish" : "🟡 Neutro"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Analise seus ativos para ver o ranking</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline + Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-1">
                {activities.map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 py-2.5">
                    <div className="mt-0.5 shrink-0">{activityIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sentiment Trend Chart */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Tendência de Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.recentSentiments.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.recentSentiments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Area type="monotone" dataKey="bullish" stackId="1" stroke="hsl(160, 84%, 39%)" fill="hsl(160, 84%, 39%)" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="bearish" stackId="1" stroke="hsl(0, 84%, 60%)" fill="hsl(0, 84%, 60%)" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke="hsl(45, 93%, 47%)" fill="hsl(45, 93%, 47%)" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <p>Analise documentos para ver a tendência de sentimento</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribution pie */}
      {pieData.length > 0 && (
        <Card className="glass max-w-md">
          <CardHeader>
            <CardTitle className="font-display">Distribuição de Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
