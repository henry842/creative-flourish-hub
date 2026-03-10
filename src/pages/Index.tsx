import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, MessageSquare, TrendingUp, TrendingDown, Minus, Activity, Star, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "@/hooks/use-toast";

interface Stats {
  totalDocs: number;
  totalConversations: number;
  sentimentCounts: { bullish: number; bearish: number; neutral: number };
  recentSentiments: { date: string; bullish: number; bearish: number; neutral: number }[];
}

interface WatchlistItem {
  id: string;
  ticker: string;
  lastScore?: number;
  lastSentiment?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    const [docsRes, convsRes, sentRes, watchRes, scoresRes] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("sentiment_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("watchlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_scores").select("ticker, overall_score, sentiment, created_at").eq("user_id", user.id).not("ticker", "is", null).order("created_at", { ascending: false }),
    ]);

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

    const scores = scoresRes.data || [];
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
    setStats({
      totalDocs: docsRes.count || 0,
      totalConversations: convsRes.count || 0,
      sentimentCounts: counts,
      recentSentiments: Object.entries(byDate).map(([date, v]) => ({ date, ...v })).reverse(),
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const removeFromWatchlist = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    toast({ title: "Removido da watchlist" });
  };

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

  const pieData = stats ? [
    { name: "Bullish", value: stats.sentimentCounts.bullish, color: "hsl(160, 84%, 39%)" },
    { name: "Bearish", value: stats.sentimentCounts.bearish, color: "hsl(0, 84%, 60%)" },
    { name: "Neutral", value: stats.sentimentCounts.neutral, color: "hsl(45, 93%, 47%)" },
  ].filter(d => d.value > 0) : [];

  const total = (stats?.sentimentCounts.bullish || 0) + (stats?.sentimentCounts.bearish || 0) + (stats?.sentimentCounts.neutral || 0);

  const scoreColor = (s: number) => s >= 80 ? "text-bullish" : s >= 60 ? "text-neutral" : "text-bearish";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da sua inteligência financeira</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats?.totalDocs || 0}</div>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{stats?.totalConversations || 0}</div>
          </CardContent>
        </Card>

        <Card className="glass hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Análises</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{total}</div>
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
          </CardContent>
        </Card>
      </div>

      {/* Watchlist Widget */}
      {watchlist.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" /> Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {watchlist.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <div>
                    <span className="font-display font-bold">{w.ticker}</span>
                    {w.lastScore !== undefined && (
                      <span className={`ml-2 text-sm font-medium ${scoreColor(w.lastScore)}`}>
                        {w.lastScore}
                      </span>
                    )}
                    {w.lastSentiment && (
                      <Badge variant="outline" className="ml-2 text-xs">
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Tendência de Sentimento</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.recentSentiments.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
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
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <p>Nenhuma análise ainda. Envie documentos e use o chat para começar!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display">Distribuição</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Minus className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Sem dados</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
