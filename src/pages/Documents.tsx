import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Trash2, Clock, CheckCircle, AlertCircle, Zap, Printer, Star, RefreshCw, Search, Pencil } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { RedFlagsList } from "@/components/RedFlagsList";
import { EventTimeline } from "@/components/EventTimeline";

type Document = Tables<"documents">;

interface HealthScore {
  id: string;
  overall_score: number;
  revenue_growth: number;
  net_margin: number;
  debt_level: number;
  earnings_quality: number;
  regulatory_risk: number;
  sentiment: string;
  confidence: number;
  summary: string | null;
  ticker: string | null;
  red_flags: string[];
  timeline_events: { date: string; event: string }[];
  price_target_low?: number | null;
  price_target_high?: number | null;
  price_target_rationale?: string | null;
}

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [healthScores, setHealthScores] = useState<Record<string, HealthScore>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [docType, setDocType] = useState("other");
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set());

  // Edit doc modal state
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editName, setEditName] = useState("");
  const [editTicker, setEditTicker] = useState("");
  const [saving, setSaving] = useState(false);

  const getFlowStep = () => {
    if (documents.length === 0) return 0;
    const hasProcessed = documents.some((d) => healthScores[d.id]);
    const hasExpanded = expandedDoc !== null;
    if (hasExpanded && hasProcessed) return 3;
    if (hasProcessed) return 2;
    return 1;
  };

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    const [docsRes, scoresRes, watchRes] = await Promise.all([
      supabase.from("documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_scores").select("*").eq("user_id", user.id),
      supabase.from("watchlist").select("ticker").eq("user_id", user.id),
    ]);
    setDocuments(docsRes.data || []);

    const scoreMap: Record<string, HealthScore> = {};
    (scoresRes.data || []).forEach((s: any) => {
      scoreMap[s.document_id] = {
        ...s,
        red_flags: (s.red_flags as string[]) || [],
        timeline_events: (s.timeline_events as { date: string; event: string }[]) || [],
      };
    });
    setHealthScores(scoreMap);
    setWatchlistTickers(new Set((watchRes.data || []).map((w: any) => w.ticker)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.name.endsWith(".pdf")) {
      toast({ title: "Erro", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      ticker: ticker || null,
      doc_type: docType,
      status: "pending",
    });

    if (dbError) {
      toast({ title: "Erro", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "Upload concluído!", description: file.name });
      setTicker("");
      fetchDocs();
    }
    setUploading(false);
  };

  const handleAnalyze = async (doc: Document) => {
    setAnalyzing(doc.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          document_id: doc.id,
          ticker: doc.ticker,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro na análise");
      }

      toast({ title: "Análise concluída! ✅", description: `Health Score gerado para ${doc.name}` });
      fetchDocs();
    } catch (err: any) {
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    }
    setAnalyzing(null);
  };

  const handleDelete = async (doc: Document) => {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast({ title: "Documento removido" });
    fetchDocs();
  };

  const handleEditDoc = (doc: Document) => {
    setEditingDoc(doc);
    setEditName(doc.name);
    setEditTicker(doc.ticker || "");
  };

  const handleSaveEdit = async () => {
    if (!editingDoc || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("documents")
      .update({ name: editName.trim(), ticker: editTicker.trim().toUpperCase() || null })
      .eq("id", editingDoc.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Documento atualizado ✅" });
      setEditingDoc(null);
      fetchDocs();
    }
    setSaving(false);
  };

  const handleDeleteHealthScore = async (docId: string) => {
    const { error } = await supabase.from("health_scores").delete().eq("document_id", docId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Análise removida", description: "Você pode re-analisar este documento." });
      fetchDocs();
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "processed": return <CheckCircle className="h-4 w-4 text-bullish" />;
      case "error": return <AlertCircle className="h-4 w-4 text-bearish" />;
      default: return <Clock className="h-4 w-4 text-neutral animate-pulse-glow" />;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const flowStep = getFlowStep();
  const steps = [
    { label: "Upload", icon: Upload },
    { label: "Analisar", icon: Zap },
    { label: "Explorar", icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus relatórios financeiros</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = flowStep > i;
          const isCurrent = flowStep === i;
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? "bg-bullish text-primary-foreground" : isCurrent ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {isActive ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-bullish" : isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 mb-5 transition-colors ${flowStep > i + 1 ? "bg-bullish" : flowStep > i ? "bg-primary/40" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg">Upload de PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Ticker (opcional)</Label>
              <Input placeholder="AAPL, PETR4..." value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10-K">10-K</SelectItem>
                  <SelectItem value="10-Q">10-Q</SelectItem>
                  <SelectItem value="earnings">Earnings Call</SelectItem>
                  <SelectItem value="news">Notícia</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Selecionar PDF"}
                </div>
              </Label>
              <input id="file-upload" type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)
        ) : documents.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/40 mb-6" />
              <h3 className="font-display text-xl font-semibold mb-6">Nenhum documento ainda</h3>
              <div className="max-w-sm mx-auto space-y-4">
                <div className="flex items-start gap-3 text-left">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">1</span>
                  <div>
                    <p className="font-medium text-sm">Escolha um PDF financeiro</p>
                    <p className="text-xs text-muted-foreground">10-K, 10-Q, earnings calls ou relatórios</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">2</span>
                  <div>
                    <p className="font-medium text-sm">Digite o ticker da empresa</p>
                    <p className="text-xs text-muted-foreground">Ex: AAPL, PETR4, NVDA</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">3</span>
                  <div>
                    <p className="font-medium text-sm">Clique em Analisar</p>
                    <p className="text-xs text-muted-foreground">A IA gera Health Score, Red Flags e Price Target</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          documents.map((doc) => {
            const score = healthScores[doc.id];
            const isExpanded = expandedDoc === doc.id;
            return (
              <div key={doc.id} className="space-y-3">
                <Card className="glass hover:shadow-md transition-shadow">
                  <CardContent className="py-4 flex items-center gap-4">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                        {doc.ticker && <Badge variant="secondary">{doc.ticker}</Badge>}
                        <Badge variant="outline">{doc.doc_type}</Badge>
                        <span>{formatSize(doc.file_size)}</span>
                        <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.ticker && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleWatchlist(doc.ticker!)}
                          className="print-hide"
                          title={watchlistTickers.has(doc.ticker) ? "Remover da watchlist" : "Adicionar à watchlist"}
                        >
                          <Star className={`h-4 w-4 ${watchlistTickers.has(doc.ticker) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                        </Button>
                      )}
                      {statusIcon(doc.status)}
                      {!score && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAnalyze(doc)}
                          disabled={analyzing === doc.id}
                          className="gap-1"
                        >
                          <Zap className="h-3 w-3" />
                          {analyzing === doc.id ? "Analisando..." : "Analisar"}
                        </Button>
                      )}
                      {score && (
                        <>
                          <Badge className={`${score.overall_score >= 80 ? "bg-bullish/10 text-bullish" : score.overall_score >= 60 ? "bg-neutral/10 text-neutral" : "bg-bearish/10 text-bearish"} border-0 font-mono cursor-pointer`} onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                            {score.overall_score}/100
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyze(doc)}
                            disabled={analyzing === doc.id}
                            className="gap-1 print-hide"
                          >
                            <RefreshCw className={`h-3 w-3 ${analyzing === doc.id ? "animate-spin" : ""}`} />
                            {analyzing === doc.id ? "Re-analisando..." : "Re-analisar"}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => window.print()} className="print-hide">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEditDoc(doc)} className="print-hide" title="Editar documento">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:text-destructive print-hide">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deletar documento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação é irreversível. O documento "{doc.name}" e sua análise serão removidos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(doc)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Deletar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>

                {isExpanded && score && (
                  <div className="ml-4 print-section space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <HealthScoreCard score={score} />
                      <div className="space-y-4">
                        <RedFlagsList flags={score.red_flags} />
                        <EventTimeline events={score.timeline_events} />
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                          <Trash2 className="h-3 w-3 mr-1" /> Deletar análise (permite re-análise limpa)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar análise?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O Health Score deste documento será removido. Você poderá re-analisar do zero.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteHealthScore(doc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Deletar análise
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit document modal */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>Altere o nome e o ticker do documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input value={editTicker} onChange={(e) => setEditTicker(e.target.value.toUpperCase())} placeholder="AAPL, PETR4..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
