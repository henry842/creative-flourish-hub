import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, AreaChart, Area, ReferenceLine, Legend,
} from "recharts";

// Color palette for asset lines
const ASSET_COLORS = [
  "hsl(217, 91%, 60%)",  // primary blue
  "hsl(160, 84%, 39%)",  // bullish green
  "hsl(0, 84%, 60%)",    // bearish red
  "hsl(45, 93%, 47%)",   // neutral yellow
  "hsl(280, 70%, 55%)",  // purple
  "hsl(190, 80%, 45%)",  // teal
  "hsl(25, 90%, 55%)",   // orange
  "hsl(330, 70%, 55%)",  // pink
];

const TYPE_COLORS: Record<string, string> = {
  fii: "hsl(217, 91%, 60%)",
  ação: "hsl(160, 84%, 39%)",
  acao: "hsl(160, 84%, 39%)",
  cripto: "hsl(45, 93%, 47%)",
  outro: "hsl(var(--muted-foreground))",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  fontSize: 12,
};

interface ScoreHistoryItem {
  ticker: string | null;
  asset_id: string | null;
  overall_score: number;
  sentiment: string | null;
  created_at: string;
}

interface AssetInfo {
  id: string;
  name: string;
  ticker: string | null;
  asset_type?: string;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground text-center px-4">{message}</p>
    </div>
  );
}

// ─── Chart 1: Health Score Evolution (multi-line per asset) ───
function ScoreEvolutionChart({ scores, assets }: { scores: ScoreHistoryItem[]; assets: AssetInfo[] }) {
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  
  // Group scores by date, with one key per asset
  const byDate: Record<string, Record<string, number>> = {};
  const assetIds = new Set<string>();
  
  // Process scores chronologically
  const sorted = [...scores].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  sorted.forEach((s) => {
    if (!s.asset_id) return;
    const date = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (!byDate[date]) byDate[date] = {};
    byDate[date][s.asset_id] = s.overall_score;
    assetIds.add(s.asset_id);
  });

  const dataPoints = Object.entries(byDate).map(([date, vals]) => ({ date, ...vals }));
  const uniqueAssets = Array.from(assetIds);

  if (dataPoints.length < 1 || uniqueAssets.length === 0) {
    return <EmptyChart message="Analise mais ativos para ver a evolução dos scores" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={dataPoints}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => {
          const asset = assetMap.get(name);
          return [value, asset?.ticker || asset?.name || name];
        }} />
        <Legend formatter={(value: string) => {
          const asset = assetMap.get(value);
          return asset?.ticker || asset?.name || value;
        }} />
        {uniqueAssets.map((assetId, i) => (
          <Line
            key={assetId}
            type="monotone"
            dataKey={assetId}
            stroke={ASSET_COLORS[i % ASSET_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Chart 2: Asset Comparison (horizontal bars) ───
function AssetComparisonChart({ assets, latestScores }: {
  assets: AssetInfo[];
  latestScores: Record<string, { score: number; sentiment: string }>;
}) {
  const data = assets
    .filter((a) => latestScores[a.id])
    .map((a) => ({
      name: a.ticker || a.name,
      score: latestScores[a.id].score,
      sentiment: latestScores[a.id].sentiment,
    }))
    .sort((a, b) => b.score - a.score);

  if (data.length === 0) {
    return <EmptyChart message="Analise mais ativos para ver este gráfico" />;
  }

  const sentimentColor = (s: string) =>
    s === "bullish" ? "hsl(160, 84%, 39%)" : s === "bearish" ? "hsl(0, 84%, 60%)" : "hsl(45, 93%, 47%)";

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis type="category" dataKey="name" width={70} stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}/100`, "Health Score"]} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((entry, i) => (
            <Cell key={i} fill={sentimentColor(entry.sentiment)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Chart 3: Portfolio Distribution by Type (donut) ───
function PortfolioDistributionChart({ assets }: { assets: AssetInfo[] }) {
  const typeCounts: Record<string, number> = {};
  assets.forEach((a) => {
    const type = (a.asset_type || "outro").toLowerCase();
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const data = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    color: TYPE_COLORS[type] || "hsl(var(--muted-foreground))",
  }));

  if (data.length === 0) {
    return <EmptyChart message="Adicione ativos para ver a distribuição da carteira" />;
  }

  const totalAssets = assets.length;

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} ativo${value !== 1 ? "s" : ""}`, "Quantidade"]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.name} ({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart 4: Cumulative Average Score (area with reference line) ───
function CumulativeScoreChart({ scores, assets }: { scores: ScoreHistoryItem[]; assets: AssetInfo[] }) {
  // Build avg score per date across all assets
  const sorted = [...scores].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  const byDate: Record<string, number[]> = {};
  sorted.forEach((s) => {
    if (!s.asset_id) return;
    const date = new Date(s.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(s.overall_score);
  });

  const data = Object.entries(byDate).map(([date, vals]) => ({
    date,
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  }));

  if (data.length < 1) {
    return <EmptyChart message="Analise mais ativos para ver a evolução da carteira" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}/100`, "Score Médio"]} />
        <ReferenceLine
          y={70}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="6 4"
          strokeOpacity={0.5}
          label={{ value: "Zona Saudável", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="avg"
          stroke="hsl(160, 84%, 39%)"
          strokeWidth={2}
          fill="url(#avgGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Main Export ───
export function PortfolioCharts({
  scores,
  assets,
  latestScores,
}: {
  scores: ScoreHistoryItem[];
  assets: AssetInfo[];
  latestScores: Record<string, { score: number; sentiment: string }>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" /> Análise da Carteira
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" /> Evolução do Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreEvolutionChart scores={scores} assets={assets} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Comparação entre Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssetComparisonChart assets={assets} latestScores={latestScores} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" /> Distribuição por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioDistributionChart assets={assets} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Score Médio da Carteira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CumulativeScoreChart scores={scores} assets={assets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
