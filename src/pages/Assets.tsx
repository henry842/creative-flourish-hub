import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FolderOpen, FileText, Activity, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  description: string | null;
  ticker: string | null;
  asset_type: string;
  created_at: string;
  doc_count?: number;
  last_sentiment?: string | null;
  last_score?: number | null;
}

export default function Assets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [newType, setNewType] = useState("fii");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    const { data: assetsData } = await supabase
      .from("assets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!assetsData) { setLoading(false); return; }

    // Get doc counts and latest scores per asset
    const { data: docs } = await supabase
      .from("documents")
      .select("asset_id")
      .eq("user_id", user.id)
      .not("asset_id", "is", null);

    const { data: scores } = await supabase
      .from("health_scores")
      .select("asset_id, overall_score, sentiment, created_at")
      .eq("user_id", user.id)
      .not("asset_id", "is", null)
      .order("created_at", { ascending: false });

    const docCounts: Record<string, number> = {};
    (docs || []).forEach((d: any) => {
      docCounts[d.asset_id] = (docCounts[d.asset_id] || 0) + 1;
    });

    const latestScore: Record<string, { score: number; sentiment: string }> = {};
    (scores || []).forEach((s: any) => {
      if (s.asset_id && !latestScore[s.asset_id]) {
        latestScore[s.asset_id] = { score: s.overall_score, sentiment: s.sentiment || "neutral" };
      }
    });

    setAssets(assetsData.map((a: any) => ({
      ...a,
      doc_count: docCounts[a.id] || 0,
      last_sentiment: latestScore[a.id]?.sentiment || null,
      last_score: latestScore[a.id]?.score || null,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("assets").insert({
      user_id: user.id,
      name: newName.trim(),
      ticker: newTicker.trim().toUpperCase() || null,
      asset_type: newType,
      description: newDesc.trim() || null,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ativo criado ✅" });
      setShowCreate(false);
      setNewName(""); setNewTicker(""); setNewType("fii"); setNewDesc("");
      fetchAssets();
    }
    setCreating(false);
  };

  const handleDelete = async (asset: Asset) => {
    const { error } = await supabase.from("assets").delete().eq("id", asset.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ativo removido" });
      fetchAssets();
    }
    setDeletingAsset(null);
  };

  const sentimentBorder = (sentiment: string | null) => {
    switch (sentiment) {
      case "bullish": return "border-l-4 border-l-bullish";
      case "bearish": return "border-l-4 border-l-bearish";
      case "neutral": return "border-l-4 border-l-neutral";
      default: return "border-l-4 border-l-border";
    }
  };

  const sentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case "bullish": return <TrendingUp className="h-4 w-4 text-bullish" />;
      case "bearish": return <TrendingDown className="h-4 w-4 text-bearish" />;
      case "neutral": return <Minus className="h-4 w-4 text-neutral" />;
      default: return null;
    }
  };

  const typeLabel: Record<string, string> = {
    fii: "FII", acao: "Ação", cripto: "Cripto", outro: "Outro",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Meus Ativos</h1>
          <p className="text-muted-foreground mt-1">Organize seus investimentos e documentos</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Ativo
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : assets.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Nenhum ativo criado</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Crie seu primeiro ativo para organizar documentos, análises e conversas em um só lugar.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar meu primeiro ativo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className={`glass hover:shadow-lg transition-all cursor-pointer group ${sentimentBorder(asset.last_sentiment)}`}
              onClick={() => navigate(`/assets/${asset.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="font-display text-lg truncate">{asset.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {asset.ticker && <Badge variant="secondary" className="font-mono text-xs">{asset.ticker}</Badge>}
                      <Badge variant="outline" className="text-xs">{typeLabel[asset.asset_type] || asset.asset_type}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeletingAsset(asset); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {asset.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> {asset.doc_count} docs
                    </span>
                    {asset.last_score !== null && (
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        <span className={`font-mono font-bold ${
                          (asset.last_score || 0) >= 80 ? "text-bullish" : (asset.last_score || 0) >= 60 ? "text-neutral" : "text-bearish"
                        }`}>
                          {asset.last_score}
                        </span>
                      </span>
                    )}
                  </div>
                  {sentimentIcon(asset.last_sentiment)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Asset Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Novo Ativo</DialogTitle>
            <DialogDescription>Crie um ativo para organizar documentos e análises relacionadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Maxi Renda FII" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ticker</Label>
                <Input placeholder="Ex: MXRF11" value={newTicker} onChange={(e) => setNewTicker(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fii">FII</SelectItem>
                    <SelectItem value="acao">Ação</SelectItem>
                    <SelectItem value="cripto">Cripto</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Breve descrição do ativo..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Criando..." : "Criar Ativo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingAsset} onOpenChange={(open) => !open && setDeletingAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar ativo?</AlertDialogTitle>
            <AlertDialogDescription>
              O ativo "{deletingAsset?.name}" será removido. Documentos e análises vinculados não serão deletados, apenas desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAsset && handleDelete(deletingAsset)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
