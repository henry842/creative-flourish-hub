import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, TrendingUp, TrendingDown, Minus, Medal, FileText, Zap,
  ChevronDown, ChevronUp, Swords, Brain, Download, ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface HealthScoreRow {
  ticker: string;
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: string;
  created_at: string;
  red_flags: Json | null;
  asset_id: string | null;
}

interface RankedCompany {
  ticker: string;
  overall_score: number;
  prevScore: number | null;
  sentiment: string;
  count: number;
  lastDate: string;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  red_flags: string[];
  assetType: string;
}

const SUB_CATEGORIES = [
  { key: "revenue_growth" as const, label: "Crescimento" },
  { key: "net_margin" as const, label: "Margem" },
  { key: "debt_level" as const, label: "Endividamento" },
  { key: "earnings_quality" as const, label: "Qualidade" },
  { key: "regulatory_risk" as const, label: "Risco" },
];

const CHART_COLORS = [
  "hsl(246 44% 42%)", "hsl(16 74% 54%)", "hsl(152 44% 40%)",
  "hsl(38 78% 50%)", "hsl(268 42% 55%)", "hsl(194 52% 42%)",
  "hsl(330, 70%, 55%)", "hsl(100, 60%, 45%)",
];

function parseRedFlags(flags: Json | null): string[] {
  if (!flags || !Array.isArray(flags)) return [];
  return flags.map((f) =>
    typeof f === "string" ? f : typeof f === "object" && f !== null && "text" in f ? String((f as any).text) : JSON.stringify(f)
  );
}

function scoreColor(s: number) { return s >= 80 ? "text-bullish" : s >= 60 ? "text-neutral" : "text-bearish"; }
function scoreBg(s: number) { return s >= 80 ? "bg-bullish" : s >= 60 ? "bg-neutral" : "bg-bearish"; }
// Inverted: low = good (green), high = bad (red) — for regulatory_risk
function scoreColorInv(s: number) { return s <= 30 ? "text-bullish" : s <= 60 ? "text-neutral" : "text-bearish"; }
function scoreBgInv(s: number) { return s <= 30 ? "bg-bullish" : s <= 60 ? "bg-neutral" : "bg-bearish"; }

const INVERTED_KEYS = new Set(["regulatory_risk"]);

function inferAssetType(ticker: string): string {
  const t = ticker.toUpperCase();
  if (/^\d+$/.test(t.slice(-2)) && t.length >= 5) return "fii";
  if (["BTC", "ETH", "SOL", "ADA", "DOGE", "XRP", "DOT", "AVAX", "MATIC", "LINK"].some((c) => t.includes(c))) return "cripto";
  return "acao";
}

export default function Ranking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allScores, setAllScores] = useState<HealthScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("latest");
  const [typeFilter, setTypeFilter] = useState("all");
  const [battleTarget, setBattleTarget] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("health_scores")
      .select("ticker, overall_score, revenue_growth, net_margin, debt_level, earnings_quality, regulatory_risk, sentiment, created_at, red_flags, asset_id")
      .eq("user_id", user.id)
      .not("ticker", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAllScores((data as HealthScoreRow[]) || []);
        setLoading(false);
      });
  }, [user]);

  const companies = useMemo(() => {
    const byTicker: Record<string, HealthScoreRow[]> = {};
    allScores.forEach((d) => {
      const t = d.ticker!;
      if (!byTicker[t]) byTicker[t] = [];
      byTicker[t].push(d);
    });

    const now = Date.now();
    return Object.entries(byTicker)
      .map(([ticker, rows]) => {
        // Apply period filter
        let filtered = rows;
        if (periodFilter === "30d") {
          filtered = rows.filter((r) => now - new Date(r.created_at).getTime() < 30 * 86400000);
        }
        if (filtered.length === 0) return null;

        const latest = filtered[0];
        const prev = filtered.length > 1 ? filtered[1] : null;

        return {
          ticker,
          overall_score: latest.overall_score,
          prevScore: prev ? prev.overall_score : null,
          sentiment: latest.sentiment || "neutral",
          count: filtered.length,
          lastDate: latest.created_at,
          revenue_growth: latest.revenue_growth,
          net_margin: latest.net_margin,
          debt_level: latest.debt_level,
          earnings_quality: latest.earnings_quality,
          regulatory_risk: latest.regulatory_risk,
          red_flags: parseRedFlags(latest.red_flags),
          assetType: inferAssetType(ticker),
        } as RankedCompany;
      })
      .filter(Boolean) as RankedCompany[];
  }, [allScores, periodFilter]);

  const filteredCompanies = useMemo(() => {
    let list = [...companies];
    if (sentimentFilter !== "all") list = list.filter((c) => c.sentiment === sentimentFilter);
    if (typeFilter !== "all") list = list.filter((c) => c.assetType === typeFilter);
    return list.sort((a, b) => b.overall_score - a.overall_score);
  }, [companies, sentimentFilter, typeFilter]);

  const tickers = useMemo(() => filteredCompanies.map((c) => c.ticker), [filteredCompanies]);

  // Ranking evolution data
  const evolutionData = useMemo(() => {
    if (companies.length < 2) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    const tickerSet = new Set(companies.slice(0, 8).map((c) => c.ticker));

    allScores
      .filter((s) => tickerSet.has(s.ticker!))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((s) => {
        const date = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (!dateMap[date]) dateMap[date] = {};
        dateMap[date][s.ticker!] = s.overall_score;
      });

    // Convert scores to positions per date
    return Object.entries(dateMap).map(([date, scores]) => {
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const row: any = { date };
      sorted.forEach(([t], idx) => { row[t] = idx + 1; });
      return row;
    });
  }, [companies, allScores]);

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

  const exportCSV = () => {
    const headers = "Posição,Ticker,Score,Variação,Sentimento,Crescimento,Margem,Endividamento,Qualidade,Risco,Red Flags,Última Análise\n";
    const rows = filteredCompanies.map((c, i) => {
      const variation = c.prevScore !== null ? c.overall_score - c.prevScore : "N/A";
      return `${i + 1},${c.ticker},${c.overall_score},${variation},${c.sentiment},${c.revenue_growth},${c.net_margin},${c.debt_level},${c.earnings_quality},${c.regulatory_risk},"${c.red_flags.join("; ")}",${new Date(c.lastDate).toLocaleDateString("pt-BR")}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateAI = async () => {
    setAiLoading(true);
    setAiSummary("");
    try {
      const top = filteredCompanies.slice(0, 10);
      const prompt = `Analise a carteira de investimentos abaixo e gere um resumo conciso em português (máximo 3 parágrafos). Destaque quais ativos lideram, quais pioraram, a distribuição de sentimentos e recomendações gerais.

Ranking atual:
${top.map((c, i) => `${i + 1}. ${c.ticker} — Score: ${c.overall_score}, Sentimento: ${c.sentiment}, Variação: ${c.prevScore !== null ? c.overall_score - c.prevScore : "primeira análise"}, Red Flags: ${c.red_flags.length}`).join("\n")}`;

      const resp = await supabase.functions.invoke("chat", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (resp.error) throw resp.error;

      const reader = resp.data instanceof ReadableStream ? resp.data.getReader() : new Response(resp.data).body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setAiSummary(full); }
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar análise da IA");
    } finally {
      setAiLoading(false);
    }
  };

  const goToBattle = (t1: string, t2: string) => {
    navigate(`/compare?t1=${encodeURIComponent(t1)}&t2=${encodeURIComponent(t2)}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={Trophy}
        title="Ranking de empresas"
        subtitle="Suas empresas analisadas, ordenadas por Health Score"
        action={
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2" disabled={filteredCompanies.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {[
            { value: "all", label: "Todos" },
            { value: "bullish", label: "Bullish" },
            { value: "bearish", label: "Bearish" },
            { value: "neutral", label: "Neutro" },
          ].map((f) => (
            <Button
              key={f.value}
              variant={sentimentFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSentimentFilter(f.value)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Última análise</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Sempre</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="fii">FII</SelectItem>
            <SelectItem value="acao">Ação</SelectItem>
            <SelectItem value="cripto">Cripto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ranking Evolution Chart */}
      {evolutionData.length > 1 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Evolução das Posições</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolutionData}>
                <XAxis dataKey="date" stroke="hsl(220, 14%, 50%)" fontSize={11} />
                <YAxis reversed domain={[1, "auto"]} stroke="hsl(220, 14%, 50%)" fontSize={11} allowDecimals={false} label={{ value: "Posição", angle: -90, position: "insideLeft", style: { fill: "hsl(220, 14%, 50%)", fontSize: 11 } }} />
                <Tooltip contentStyle={{ background: "hsl(222, 20%, 12%)", border: "1px solid hsl(220, 20%, 25%)", borderRadius: 8, color: "hsl(220, 14%, 92%)" }} />
                <Legend />
                {companies.slice(0, 8).map((c, i) => (
                  <Line key={c.ticker} type="monotone" dataKey={c.ticker} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      <Card className="glass">
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Análise da Carteira</span>
            </div>
            <Button size="sm" onClick={generateAI} disabled={aiLoading || filteredCompanies.length === 0} className="gap-2">
              {aiLoading ? "Analisando..." : "Gerar Análise da Carteira"}
            </Button>
          </div>
          {aiSummary ? (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic">Clique para gerar um resumo inteligente da sua carteira.</p>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : filteredCompanies.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground/40 mb-6" />
            <h3 className="font-display text-xl font-semibold mb-2">Nenhuma empresa no ranking ainda</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Analise pelo menos 2 empresas diferentes para comparar e ver quem lidera o ranking.
            </p>
            <div className="max-w-xs mx-auto space-y-3">
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><FileText className="h-3.5 w-3.5 text-primary" /></div>
                <p className="text-sm text-muted-foreground">Vá em <span className="font-medium text-foreground">Documentos</span> e faça upload de PDFs</p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Zap className="h-3.5 w-3.5 text-primary" /></div>
                <p className="text-sm text-muted-foreground">Analise pelo menos <span className="font-medium text-foreground">2 tickers diferentes</span></p>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Trophy className="h-3.5 w-3.5 text-primary" /></div>
                <p className="text-sm text-muted-foreground">Volte aqui para ver o <span className="font-medium text-foreground">ranking automático</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCompanies.map((company, i) => {
            const cfg = sentimentConfig[company.sentiment] || sentimentConfig.neutral;
            const Icon = cfg.icon;
            const isExpanded = expandedTicker === company.ticker;
            const variation = company.prevScore !== null ? company.overall_score - company.prevScore : null;
            const lastDateStr = new Date(company.lastDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

            return (
              <Card key={company.ticker} className="glass hover:shadow-lg transition-all">
                <CardContent className="py-4">
                  {/* Main row */}
                  <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedTicker(isExpanded ? null : company.ticker)}
                  >
                    {/* Position */}
                    <div className="flex items-center justify-center w-12 h-12 shrink-0">
                      {i < 3 ? (
                        <Medal className={`h-8 w-8 ${getMedalColor(i)}`} />
                      ) : (
                        <span className="text-2xl font-display font-bold text-muted-foreground">{i + 1}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-xl font-bold">{company.ticker}</span>
                        <Badge variant="outline" className={cfg.color}>
                          <Icon className="h-3 w-3 mr-1" />{cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {company.assetType === "fii" ? "FII" : company.assetType === "cripto" ? "Cripto" : "Ação"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{company.count} análise{company.count > 1 ? "s" : ""} · {lastDateStr}</span>
                      </div>
                      {/* Mini sub-category bars */}
                      <div className="flex gap-1.5 mt-2">
                        {SUB_CATEGORIES.map(({ key, label }) => (
                          <div key={key} className="flex-1" title={`${label}: ${company[key]}`}>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${INVERTED_KEYS.has(key) ? scoreBgInv(company[key]) : scoreBg(company[key])}`} style={{ width: `${company[key]}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score + variation */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:block w-28">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${scoreBg(company.overall_score)}`} style={{ width: `${company.overall_score}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-display font-bold ${scoreColor(company.overall_score)}`}>
                          {company.overall_score}
                        </span>
                        <div className="text-xs mt-0.5">
                          {variation === null ? (
                            <span className="text-primary font-medium">Novo</span>
                          ) : variation > 0 ? (
                            <span className="text-bullish font-medium">↑ +{variation}</span>
                          ) : variation < 0 ? (
                            <span className="text-bearish font-medium">↓ {variation}</span>
                          ) : (
                            <span className="text-muted-foreground">=</span>
                          )}
                        </div>
                      </div>
                      {/* Battle button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Batalhar"
                        onClick={(e) => { e.stopPropagation(); setBattleTarget(battleTarget === company.ticker ? null : company.ticker); }}
                      >
                        <Swords className="h-4 w-4" />
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Battle mini-select */}
                  {battleTarget === company.ticker && (
                    <div className="mt-3 flex items-center gap-2 pl-16" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground">Batalhar contra:</span>
                      <Select onValueChange={(t2) => { setBattleTarget(null); goToBattle(company.ticker, t2); }}>
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue placeholder="Escolher..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tickers.filter((t) => t !== company.ticker).map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4 pl-16">
                      {/* Sub-categories with full bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {SUB_CATEGORIES.map(({ key, label }) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className={`font-medium ${INVERTED_KEYS.has(key) ? scoreColorInv(company[key]) : scoreColor(company[key])}`}>{company[key]}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${INVERTED_KEYS.has(key) ? scoreBgInv(company[key]) : scoreBg(company[key])}`} style={{ width: `${company[key]}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Red Flags */}
                      {company.red_flags.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="h-4 w-4 text-bearish" />
                            <span className="text-sm font-medium">Red Flags ({company.red_flags.length})</span>
                          </div>
                          <ul className="space-y-1.5">
                            {company.red_flags.map((f, fi) => (
                              <li key={fi} className="text-xs text-bearish/80 bg-bearish/10 rounded px-3 py-2 leading-relaxed">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Battle link */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => navigate(`/compare?t1=${encodeURIComponent(company.ticker)}`)}
                      >
                        <Swords className="h-4 w-4" /> Ver no Modo Batalha
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
