import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { streamChat } from "@/lib/ai";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, Trophy, Crown, Brain, Download, Clock, ShieldAlert, Plus, X } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

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
  red_flags: Json | null;
}

interface BattleHistory {
  tickers: string[];
  winner: string;
  score: string;
  date: string;
}

const categories = [
  { key: "overall_score" as const, label: "Score Geral", short: "Score" },
  { key: "revenue_growth" as const, label: "Crescimento de Receita", short: "Crescimento" },
  { key: "net_margin" as const, label: "Margem Líquida", short: "Margem" },
  { key: "debt_level" as const, label: "Endividamento", short: "Dívida" },
  { key: "earnings_quality" as const, label: "Qualidade dos Lucros", short: "Qualidade" },
  { key: "regulatory_risk" as const, label: "Risco Regulatório", short: "Risco" },
];

const COLORS = ["hsl(246 44% 42%)", "hsl(16 74% 54%)", "hsl(152 44% 40%)"];

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

// Inverted: low = good (green), high = bad (red) — for regulatory_risk
function scoreColorInv(s: number) { return s <= 30 ? "text-bullish" : s <= 60 ? "text-neutral" : "text-bearish"; }
function scoreBgInv(s: number) { return s <= 30 ? "bg-bullish" : s <= 60 ? "bg-neutral" : "bg-bearish"; }

const INVERTED_KEYS = new Set(["regulatory_risk"]);

function parseRedFlags(flags: Json | null): string[] {
  if (!flags) return [];
  if (Array.isArray(flags)) return flags.map((f) => (typeof f === "string" ? f : typeof f === "object" && f !== null && "text" in f ? String((f as any).text) : JSON.stringify(f)));
  return [];
}

export default function Compare() {
  const { user } = useAuth();
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker1, setTicker1] = useState("");
  const [ticker2, setTicker2] = useState("");
  const [ticker3, setTicker3] = useState("");
  const [showThird, setShowThird] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [battleHistory, setBattleHistory] = useState<BattleHistory[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();

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
        // Pre-fill from query params
        const t1 = searchParams.get("t1");
        const t2 = searchParams.get("t2");
        if (t1) setTicker1(t1);
        if (t2) setTicker2(t2);
      });
    // Load battle history from localStorage
    const saved = localStorage.getItem(`battle_history_${user.id}`);
    if (saved) setBattleHistory(JSON.parse(saved));
  }, [user]);

  const tickers = useMemo(() => [...new Set(scores.filter((s) => s.ticker).map((s) => s.ticker!))], [scores]);

  const selectedTickers = useMemo(() => {
    const t = [ticker1, ticker2];
    if (showThird && ticker3) t.push(ticker3);
    return t.filter(Boolean);
  }, [ticker1, ticker2, ticker3, showThird]);

  const selectedScores = useMemo(
    () => selectedTickers.map((t) => scores.find((s) => s.ticker === t)).filter(Boolean) as HealthScore[],
    [selectedTickers, scores]
  );

  const isReady = selectedScores.length >= 2;

  // Calculate wins
  const wins = useMemo(() => {
    if (!isReady) return {};
    const w: Record<string, number> = {};
    selectedTickers.forEach((t) => (w[t] = 0));
    categories.forEach(({ key }) => {
      let best = -1;
      let bestTicker = "";
      selectedScores.forEach((s, i) => {
        if (s[key] > best) {
          best = s[key];
          bestTicker = selectedTickers[i];
        }
      });
      // Check for ties
      const tied = selectedScores.filter((s) => s[key] === best).length;
      if (tied === 1) w[bestTicker]++;
    });
    return w;
  }, [isReady, selectedScores, selectedTickers]);

  const winner = useMemo(() => {
    if (!isReady) return null;
    let maxWins = 0;
    let w = "";
    Object.entries(wins).forEach(([t, count]) => {
      if (count > maxWins) { maxWins = count; w = t; }
    });
    // Check tie
    const tied = Object.values(wins).filter((c) => c === maxWins).length;
    return tied > 1 ? null : w;
  }, [wins, isReady]);

  // Save battle to history
  useEffect(() => {
    if (!isReady || !user) return;
    const winsStr = selectedTickers.map((t) => `${wins[t] || 0}`).join("×");
    const entry: BattleHistory = {
      tickers: [...selectedTickers],
      winner: winner || "Empate",
      score: winsStr,
      date: new Date().toISOString(),
    };
    setBattleHistory((prev) => {
      const next = [entry, ...prev.filter((b) => b.tickers.join(",") !== entry.tickers.join(",")).slice(0, 4)];
      localStorage.setItem(`battle_history_${user.id}`, JSON.stringify(next));
      return next;
    });
  }, [selectedTickers.join(","), isReady]);

  // Radar data
  const radarData = useMemo(() => {
    if (!isReady) return [];
    return categories.map(({ key, short }) => {
      const d: any = { dimension: short };
      selectedScores.forEach((s, i) => {
        d[selectedTickers[i]] = s[key];
      });
      return d;
    });
  }, [isReady, selectedScores, selectedTickers]);

  // Historical evolution data
  const historyData = useMemo(() => {
    if (!isReady) return [];
    const dateMap: Record<string, any> = {};
    selectedTickers.forEach((t) => {
      scores
        .filter((s) => s.ticker === t)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach((s) => {
          const date = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (!dateMap[date]) dateMap[date] = { date };
          dateMap[date][t] = s.overall_score;
        });
    });
    return Object.values(dateMap);
  }, [isReady, selectedTickers, scores]);

  // Red flags
  const redFlagsMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    selectedScores.forEach((s, i) => {
      m[selectedTickers[i]] = parseRedFlags(s.red_flags);
    });
    return m;
  }, [selectedScores, selectedTickers]);

  const minRedFlags = useMemo(() => {
    if (!isReady) return "";
    let min = Infinity;
    let best = "";
    Object.entries(redFlagsMap).forEach(([t, flags]) => {
      if (flags.length < min) { min = flags.length; best = t; }
    });
    const tied = Object.values(redFlagsMap).filter((f) => f.length === min).length;
    return tied > 1 ? "" : best;
  }, [redFlagsMap, isReady]);

  // AI Summary
  const generateAI = async () => {
    if (!isReady) return;
    setAiLoading(true);
    setAiSummary("");
    try {
      const prompt = `Compare as seguintes empresas com base nos Health Scores. Explique em português quem venceu e por quê, destacando pontos fortes e fracos de cada uma. Seja objetivo, máximo 3 parágrafos.

${selectedScores.map((s, i) => `${selectedTickers[i]}: Score Geral ${s.overall_score}, Crescimento ${s.revenue_growth}, Margem ${s.net_margin}, Endividamento ${s.debt_level}, Qualidade dos Lucros ${s.earnings_quality}, Risco Regulatório ${s.regulatory_risk}, Red Flags: ${parseRedFlags(s.red_flags).join(", ") || "Nenhuma"}`).join("\n")}

Vencedor: ${winner || "Empate"} (${Object.entries(wins).map(([t, c]) => `${t}: ${c}`).join(", ")})`;

      let full = "";
      await streamChat({
        messages: [{ role: "user", content: prompt }],
        onDelta: (delta) => {
          full += delta;
          setAiSummary(full);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao gerar análise da IA");
    } finally {
      setAiLoading(false);
    }
  };

  // Export PDF
  const exportPDF = () => {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Análise Comparativa - ${selectedTickers.join(" vs ")}</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 40px; }
        h1 { text-align: center; font-size: 24px; margin-bottom: 8px; }
        h2 { font-size: 18px; margin-top: 24px; border-bottom: 1px solid #333; padding-bottom: 8px; }
        .winner { text-align: center; font-size: 20px; color: #4ade80; margin: 16px 0; }
        .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #222; }
        .flags { margin-top: 16px; }
        .flag { background: #2a1a1a; padding: 4px 8px; margin: 4px; display: inline-block; border-radius: 4px; font-size: 12px; color: #f87171; }
        .summary { background: #1e1e3a; padding: 16px; border-radius: 8px; margin-top: 16px; line-height: 1.6; white-space: pre-wrap; }
        @media print { body { background: white; color: black; } .flag { background: #fee; color: #c00; } .summary { background: #f0f0ff; } .winner { color: #16a34a; } }
      </style></head><body>
      <h1>Análise Comparativa</h1>
      <p style="text-align:center;color:#888;">${selectedTickers.join(" vs ")} — ${new Date().toLocaleDateString("pt-BR")}</p>
      <div class="winner">${winner ? `${winner} vence ${Object.entries(wins).map(([t, c]) => `${t}: ${c}`).join(" × ")}` : "Empate!"}</div>
      <h2>Métricas por Categoria</h2>
      ${categories.map(({ key, label }) => `<div class="metric"><span>${label}</span><span>${selectedScores.map((s, i) => `${selectedTickers[i]}: ${s[key]}`).join(" | ")}</span></div>`).join("")}
      <h2>Red Flags</h2>
      ${selectedTickers.map((t) => `<div><strong>${t}</strong> (${redFlagsMap[t]?.length || 0}):<div class="flags">${(redFlagsMap[t] || []).map((f) => `<span class="flag">${f}</span>`).join("") || "<span style='color:#888'>Nenhuma</span>"}</div></div>`).join("")}
      ${aiSummary ? `<h2>Análise da IA</h2><div class="summary">${aiSummary}</div>` : ""}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const availableFor = (exclude: string[]) => tickers.filter((t) => !exclude.includes(t));

  return (
    <div className="space-y-6" ref={printRef}>
      <PageHeader
        icon={Swords}
        title="Modo Batalha"
        subtitle={`Compare ${showThird ? "até 3" : "duas"} empresas lado a lado`}
        action={
          isReady && (
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          )
        }
      />

      {/* Ticker selectors */}
      <div className={`grid gap-4 ${showThird ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
        <Card className="glass">
          <CardContent className="pt-6">
            <Select value={ticker1} onValueChange={setTicker1}>
              <SelectTrigger><SelectValue placeholder="Empresa 1" /></SelectTrigger>
              <SelectContent>
                {availableFor([ticker2, ticker3]).map((t) => (
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
                {availableFor([ticker1, ticker3]).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        {showThird ? (
          <Card className="glass relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => { setShowThird(false); setTicker3(""); }}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardContent className="pt-6">
              <Select value={ticker3} onValueChange={setTicker3}>
                <SelectTrigger><SelectValue placeholder="Empresa 3" /></SelectTrigger>
                <SelectContent>
                  {availableFor([ticker1, ticker2]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : (
          tickers.length >= 3 && (
            <Button variant="outline" className="h-auto gap-2" onClick={() => setShowThird(true)}>
              <Plus className="h-4 w-4" /> Adicionar 3º ativo
            </Button>
          )
        )}
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

      {isReady && (
        <>
          {/* Radar Chart */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg">Radar Comparativo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(220, 20%, 25%)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "hsl(220, 14%, 70%)", fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "hsl(220, 14%, 50%)", fontSize: 10 }} />
                  {selectedTickers.map((t, i) => (
                    <Radar
                      key={t}
                      name={t}
                      dataKey={t}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Winner banner */}
          <Card className="glass border-primary/50">
            <CardContent className="py-6 text-center">
              <Crown className="h-8 w-8 mx-auto text-neutral mb-2" />
              <p className="font-display text-xl font-bold">
                {winner ? (
                  <>
                    <span className="text-bullish">{winner}</span> vence{" "}
                    {Object.entries(wins).map(([t, c]) => c).join("×")}
                  </>
                ) : (
                  "Empate!"
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {Object.entries(wins).map(([t, c]) => `${t}: ${c}`).join(" · ")}
              </p>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card className="glass">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span className="font-medium">Análise da IA</span>
                </div>
                <Button size="sm" onClick={generateAI} disabled={aiLoading} className="gap-2">
                  {aiLoading ? "Analisando..." : "Gerar Análise IA"}
                </Button>
              </div>
              {aiSummary ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">Clique em "Gerar Análise IA" para obter um resumo comparativo.</p>
              )}
            </CardContent>
          </Card>

          {/* Category comparison */}
          <div className="space-y-3">
            {categories.map(({ key, label }) => {
              const values = selectedScores.map((s) => s[key]);
              const maxVal = Math.max(...values);
              const isTied = values.filter((v) => v === maxVal).length > 1;
              return (
                <Card key={key} className="glass">
                  <CardContent className="py-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3 text-center">{label}</p>
                    <div className={`grid gap-4 items-center ${selectedTickers.length === 3 ? "grid-cols-[1fr_auto_1fr_auto_1fr]" : "grid-cols-[1fr_auto_1fr]"}`}>
                      {selectedScores.map((s, i) => {
                        const v = s[key];
                        const inv = INVERTED_KEYS.has(key);
                        const isWinner = !isTied && v === maxVal;
                        return (
                          <div key={selectedTickers[i]} className={i === 0 ? "text-right" : ""}>
                            <div className={`flex items-center gap-2 ${i === 0 ? "justify-end" : ""}`}>
                              {isWinner && <Trophy className="h-4 w-4 text-neutral" />}
                              <span className={`text-2xl font-display font-bold ${inv ? scoreColorInv(v) : scoreColor(v)}`}>{v}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                              <div
                                className={`h-full rounded-full ${inv ? scoreBgInv(v) : scoreBg(v)} ${i === 0 ? "ml-auto" : ""}`}
                                style={{ width: `${v}%` }}
                              />
                            </div>
                            <p className={`text-xs text-muted-foreground mt-1 ${i === 0 ? "text-right" : ""}`}>{selectedTickers[i]}</p>
                          </div>
                        );
                      })}
                      {/* VS separators */}
                      {selectedTickers.length === 2 && <></>}
                    </div>
                    {/* Insert VS between items */}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Historical Evolution */}
          {historyData.length > 1 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Evolução do Health Score</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={historyData}>
                    <XAxis dataKey="date" stroke="hsl(220, 14%, 50%)" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="hsl(220, 14%, 50%)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(222, 20%, 12%)", border: "1px solid hsl(220, 20%, 25%)", borderRadius: 8, color: "hsl(220, 14%, 92%)" }} />
                    <Legend />
                    {selectedTickers.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Red Flags Comparison */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-bearish" />
                Comparação de Red Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-6 ${selectedTickers.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
                {selectedTickers.map((t) => {
                  const flags = redFlagsMap[t] || [];
                  return (
                    <div key={t}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-medium text-sm">{t}</span>
                        <Badge variant={flags.length === 0 ? "default" : "destructive"} className="text-xs">
                          {flags.length} flag{flags.length !== 1 ? "s" : ""}
                        </Badge>
                        {t === minRedFlags && (
                          <Badge className="bg-bullish/20 text-bullish text-xs">Menos Riscos</Badge>
                        )}
                      </div>
                      {flags.length > 0 ? (
                        <ul className="space-y-1.5">
                          {flags.map((f, i) => (
                            <li key={i} className="text-xs text-bearish/80 bg-bearish/10 rounded px-2 py-1.5">{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhuma red flag detectada</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Battle History */}
          {battleHistory.length > 0 && (
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Histórico de Batalhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {battleHistory.slice(0, 5).map((b, i) => {
                    const ago = Math.floor((Date.now() - new Date(b.date).getTime()) / 86400000);
                    const agoText = ago === 0 ? "hoje" : ago === 1 ? "ontem" : `há ${ago} dias`;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-4 py-2.5">
                        <span className="font-medium">{b.tickers.join(" vs ")}</span>
                        <span className="text-muted-foreground">
                          {b.winner === "Empate" ? "Empate" : `${b.winner} venceu`} {b.score} — {agoText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
