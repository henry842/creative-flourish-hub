import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, Zap, ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ScheduledBrief {
  id: string;
  schedule_time: string;
  is_active: boolean;
  include_news: boolean;
  include_macro: boolean;
  notify_email: boolean;
}

interface Asset {
  id: string;
  name: string;
  ticker: string | null;
}

interface DailyBrief {
  id: string;
  content: string;
  tickers: string[];
  created_at: string;
}

const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = (i + 6).toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

export default function Briefing() {
  const { user } = useAuth();
  const [config, setConfig] = useState<ScheduledBrief | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [briefs, setBriefs] = useState<DailyBrief[]>([]);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);

    const [configRes, assetsRes, briefsRes] = await Promise.all([
      supabase.from("scheduled_briefs").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("assets").select("id, name, ticker").eq("user_id", user.id).order("name"),
      supabase.from("daily_briefs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);

    setAssets(assetsRes.data || []);
    setBriefs(briefsRes.data || []);

    if (configRes.data) {
      setConfig(configRes.data as ScheduledBrief);
      // Fetch linked assets
      const { data: linkedAssets } = await supabase
        .from("scheduled_brief_assets")
        .select("asset_id")
        .eq("scheduled_brief_id", configRes.data.id);
      setSelectedAssetIds(new Set((linkedAssets || []).map((la: any) => la.asset_id)));
    }

    setLoading(false);
  };

  const saveConfig = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let briefId: string;

      if (config) {
        // Update existing
        const { error } = await supabase
          .from("scheduled_briefs")
          .update({
            schedule_time: config.schedule_time,
            is_active: config.is_active,
            include_news: config.include_news,
            include_macro: config.include_macro,
            notify_email: config.notify_email,
          })
          .eq("id", config.id);
        if (error) throw error;
        briefId = config.id;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("scheduled_briefs")
          .insert({ user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        briefId = data.id;
        setConfig(data as ScheduledBrief);
      }

      // Sync assets: delete all, then insert selected
      await supabase.from("scheduled_brief_assets").delete().eq("scheduled_brief_id", briefId);

      if (selectedAssetIds.size > 0) {
        const inserts = Array.from(selectedAssetIds).map((assetId) => ({
          scheduled_brief_id: briefId,
          asset_id: assetId,
        }));
        const { error: assetError } = await supabase.from("scheduled_brief_assets").insert(inserts);
        if (assetError) throw assetError;
      }

      toast({ title: "Configuração salva!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateNow = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      // Ensure config is saved first
      await saveConfig();

      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { user_id: user.id },
      });

      if (error) throw error;

      toast({ title: "Briefing gerado com sucesso!" });
      // Refresh briefs list
      const { data: newBriefs } = await supabase
        .from("daily_briefs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setBriefs(newBriefs || []);
    } catch (err: any) {
      const msg = err.message || "Erro desconhecido";
      if (msg.includes("429") || msg.includes("Rate limit")) {
        toast({ title: "Limite de requisições", description: "Tente novamente em alguns minutos.", variant: "destructive" });
      } else if (msg.includes("402") || msg.includes("Payment")) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos ao seu workspace.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao gerar briefing", description: msg, variant: "destructive" });
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const deleteBrief = async (briefId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from("daily_briefs").delete().eq("id", briefId);
      if (error) throw error;
      setBriefs((prev) => prev.filter((b) => b.id !== briefId));
      if (expandedBriefId === briefId) setExpandedBriefId(null);
      toast({ title: "Briefing removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" /> Briefing Diário
        </h1>
        <p className="text-muted-foreground mt-1">
          Receba um resumo financeiro personalizado todos os dias com notícias reais e dados dos seus ativos.
        </p>
      </div>

      {/* Configuration Section */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Clock className="h-5 w-5" /> Configuração
          </CardTitle>
          <CardDescription>Defina como e quando receber seu briefing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="active" className="text-base font-medium">Briefing ativo</Label>
            <Switch
              id="active"
              checked={config?.is_active ?? true}
              onCheckedChange={(checked) =>
                setConfig((prev) => prev ? { ...prev, is_active: checked } : {
                  id: "", schedule_time: "08:00", is_active: checked,
                  include_news: true, include_macro: true, notify_email: false,
                } as ScheduledBrief)
              }
            />
          </div>

          {/* Schedule time */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Horário do briefing</Label>
            <Select
              value={config?.schedule_time?.substring(0, 5) || "08:00"}
              onValueChange={(v) =>
                setConfig((prev) => prev ? { ...prev, schedule_time: v } : {
                  id: "", schedule_time: v, is_active: true,
                  include_news: true, include_macro: true, notify_email: false,
                } as ScheduledBrief)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content options */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Incluir no briefing</Label>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="news"
                  checked={config?.include_news ?? true}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => prev ? { ...prev, include_news: !!checked } : null)
                  }
                />
                <Label htmlFor="news">Notícias dos ativos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="macro"
                  checked={config?.include_macro ?? true}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => prev ? { ...prev, include_macro: !!checked } : null)
                  }
                />
                <Label htmlFor="macro">Indicadores macro (Selic, IPCA, IFIX)</Label>
              </div>
            </div>
          </div>

          {/* Asset selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Ativos para monitorar</Label>
            {assets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedAssetIds.has(asset.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleAsset(asset.id)}
                  >
                    <Checkbox checked={selectedAssetIds.has(asset.id)} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{asset.name}</p>
                      {asset.ticker && (
                        <p className="text-xs text-muted-foreground">{asset.ticker}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum ativo cadastrado. Vá em "Meus Ativos" para adicionar.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Configuração
            </Button>
            <Button variant="secondary" onClick={generateNow} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Gerar Briefing Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Section */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold">Histórico de Briefings</h2>

        {briefs.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum briefing gerado ainda. Clique em "Gerar Briefing Agora" para começar!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {briefs.map((brief) => {
              const isExpanded = expandedBriefId === brief.id;
              const preview = brief.content.split("\n").slice(0, 3).join(" ").substring(0, 150);

              return (
                <Card
                  key={brief.id}
                  className="glass cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedBriefId(isExpanded ? null : brief.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {formatDate(brief.created_at)}
                        </Badge>
                        {brief.tickers?.length > 0 && (
                          <div className="flex gap-1">
                            {brief.tickers.slice(0, 3).map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">
                                {t}
                              </Badge>
                            ))}
                            {brief.tickers.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{brief.tickers.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover briefing?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O briefing será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={(e) => deleteBrief(brief.id, e)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none mt-3">
                        <ReactMarkdown>{brief.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground line-clamp-2">{preview}...</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
