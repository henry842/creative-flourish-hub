import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { RedFlagsList } from "@/components/RedFlagsList";
import { EventTimeline } from "@/components/EventTimeline";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Upload, FileText, Zap, Trash2, Clock, CheckCircle, AlertCircle,
  Send, Bot, User, Plus, MessageSquare, RefreshCw, Copy,
} from "lucide-react";

interface Asset {
  id: string;
  name: string;
  description: string | null;
  ticker: string | null;
  asset_type: string;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  ticker: string | null;
  created_at: string;
  extracted_text: string | null;
}

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
  created_at: string;
  document_id: string | null;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export default function AssetDetail() {
  const { id: assetId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [healthScores, setHealthScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user || !assetId) return;

    const [assetRes, docsRes, scoresRes, convsRes] = await Promise.all([
      supabase.from("assets").select("*").eq("id", assetId).eq("user_id", user.id).single(),
      supabase.from("documents").select("*").eq("asset_id", assetId).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("health_scores").select("*").eq("asset_id", assetId).eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("conversations").select("*").eq("asset_id", assetId).eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);

    if (!assetRes.data) { navigate("/assets"); return; }
    setAsset(assetRes.data as any);
    setDocuments((docsRes.data || []) as Document[]);
    setHealthScores((scoresRes.data || []).map((s: any) => ({
      ...s,
      red_flags: (s.red_flags as string[]) || [],
      timeline_events: (s.timeline_events as { date: string; event: string }[]) || [],
    })));
    setConversations((convsRes.data || []) as Conversation[]);
    setLoading(false);
  }, [user, assetId, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !assetId) return;
    if (!file.name.endsWith(".pdf")) {
      toast({ title: "Apenas PDF", variant: "destructive" });
      return;
    }
    setUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(filePath, file);
    if (upErr) { toast({ title: "Erro", description: upErr.message, variant: "destructive" }); setUploading(false); return; }

    const { error: dbErr } = await supabase.from("documents").insert({
      user_id: user.id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      ticker: asset?.ticker || null,
      asset_id: assetId,
      status: "pending",
    } as any);
    if (dbErr) toast({ title: "Erro", description: dbErr.message, variant: "destructive" });
    else { toast({ title: "Upload concluído!" }); fetchData(); }
    setUploading(false);
  };

  // Analyze
  const handleAnalyze = async (doc: Document) => {
    setAnalyzing(doc.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ document_id: doc.id, ticker: doc.ticker || asset?.ticker, asset_id: assetId }),
      });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.error || "Erro"); }
      toast({ title: "Análise concluída!" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setAnalyzing(null);
  };

  const handleDeleteDoc = async (doc: Document) => {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast({ title: "Documento removido" });
    setDeletingDoc(null);
    fetchData();
  };

  // Chat
  const createConversation = async () => {
    if (!user || !assetId) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: `Chat - ${asset?.name || "Ativo"}`, asset_id: assetId } as any)
      .select()
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setConversations((prev) => [data as Conversation, ...prev]);
    setActiveConv(data.id);
    setMessages([]);
  };

  const loadMessages = async (convId: string) => {
    setActiveConv(convId);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    setMessages((data || []).map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || !user || isStreaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    await supabase.from("messages").insert({ conversation_id: activeConv, role: "user", content: userMsg.content });

    if (messages.length === 0) {
      const title = userMsg.content.slice(0, 60);
      await supabase.from("conversations").update({ title }).eq("id", activeConv);
      setConversations((prev) => prev.map((c) => (c.id === activeConv ? { ...c, title } : c)));
    }

    // Build document context from ALL docs of this asset
    const allTexts = documents
      .filter((d) => d.extracted_text && d.extracted_text.trim().length > 100)
      .map((d) => `[DOCUMENTO: "${d.name}"${d.ticker ? ` (${d.ticker})` : ""}]\n${d.extracted_text!.slice(0, 8000)}`)
      .join("\n\n---\n\n");

    const documentContext = allTexts
      ? `[ATIVO: ${asset?.name}${asset?.ticker ? ` (${asset.ticker})` : ""}]\n\nVocê tem acesso a TODOS os documentos deste ativo. Baseie suas respostas neles.\n\n${allTexts.slice(0, 30000)}`
      : undefined;

    let assistantContent = "";
    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages, documentContext }),
      });

      if (!resp.ok || !resp.body) throw new Error("Falha na conexão");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.id)
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      if (assistantContent) {
        await supabase.from("messages").insert({ conversation_id: activeConv, role: "assistant", content: assistantContent });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsStreaming(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "processed": case "analyzed": return <CheckCircle className="h-4 w-4 text-bullish" />;
      case "error": return <AlertCircle className="h-4 w-4 text-bearish" />;
      default: return <Clock className="h-4 w-4 text-neutral animate-pulse" />;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[400px]" />
    </div>
  );

  if (!asset) return null;

  const typeLabel: Record<string, string> = { fii: "FII", acao: "Ação", cripto: "Cripto", outro: "Outro" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-3">
            {asset.name}
            {asset.ticker && <Badge variant="secondary" className="font-mono">{asset.ticker}</Badge>}
            <Badge variant="outline">{typeLabel[asset.asset_type] || asset.asset_type}</Badge>
          </h1>
          {asset.description && <p className="text-sm text-muted-foreground mt-1">{asset.description}</p>}
        </div>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" /> Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="analyses" className="gap-2"><Zap className="h-4 w-4" /> Análises ({healthScores.length})</TabsTrigger>
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-4 w-4" /> Chat</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card className="glass">
            <CardContent className="py-4">
              <Label htmlFor="asset-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Upload de PDF"}
                </div>
              </Label>
              <input id="asset-upload" type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </CardContent>
          </Card>

          {documents.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhum documento. Faça upload do primeiro PDF deste ativo.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id} className="glass">
                  <CardContent className="py-3 flex items-center gap-4">
                    <FileText className="h-6 w-6 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatSize(doc.file_size)}</span>
                        <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusIcon(doc.status)}
                      <Button size="sm" onClick={() => handleAnalyze(doc)} disabled={analyzing === doc.id} className="gap-1">
                        {analyzing === doc.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        {analyzing === doc.id ? "..." : "Analisar"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeletingDoc(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Analyses Tab */}
        <TabsContent value="analyses" className="space-y-4">
          {healthScores.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Nenhuma análise ainda. Analise um documento na aba Documentos.</p>
              </CardContent>
            </Card>
          ) : (
            healthScores.map((score) => (
              <Card key={score.id} className="glass">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                      <Badge className={`${score.overall_score >= 80 ? "bg-bullish/10 text-bullish" : score.overall_score >= 60 ? "bg-neutral/10 text-neutral" : "bg-bearish/10 text-bearish"} border-0 font-mono`}>
                        {score.overall_score}/100
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(score.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </CardTitle>
                    {score.sentiment && (
                      <Badge variant="outline" className="text-xs">
                        {score.sentiment === "bullish" ? "Bullish" : score.sentiment === "bearish" ? "Bearish" : "Neutro"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {score.summary && <p className="text-sm text-muted-foreground">{score.summary}</p>}
                  <HealthScoreCard score={score} />
                  {score.red_flags.length > 0 && <RedFlagsList flags={score.red_flags} />}
                  {score.timeline_events.length > 0 && <EventTimeline events={score.timeline_events} />}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <div className="flex gap-4 h-[calc(100vh-20rem)]">
            {/* Conversations sidebar */}
            <div className="w-48 shrink-0 hidden md:flex flex-col gap-2">
              <Button onClick={createConversation} size="sm" className="gap-1 w-full">
                <Plus className="h-3 w-3" /> Nova conversa
              </Button>
              <ScrollArea className="flex-1">
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadMessages(conv.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                        activeConv === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      {conv.title}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat area */}
            <Card className="flex-1 glass flex flex-col">
              <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                {!activeConv ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4 max-w-sm">
                      <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageSquare className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-display text-lg font-semibold flex items-center justify-center gap-2">
                        Chat — {asset.ticker || asset.name}
                      </h3>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                        <p className="text-xs text-primary font-medium flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          Este chat tem acesso automático a todos os {documents.filter((d) => d.extracted_text).length} documentos de {asset.ticker || asset.name}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Converse com a IA tendo como contexto <strong>todos os relatórios</strong> deste ativo.
                      </p>
                      <Button onClick={createConversation} className="gap-2">
                        <Plus className="h-4 w-4" /> Iniciar conversa
                      </Button>

                      {/* Asset-specific suggestions preview */}
                      <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                        {[
                          "Como evoluiu o Health Score?",
                          "Compare os relatórios disponíveis",
                          asset.asset_type === "fii" ? "Qual o DY atual?" : "Como estão as margens?",
                        ].map((q) => (
                          <Badge key={q} variant="outline" className="text-[10px] text-muted-foreground">{q}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Specialized header */}
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border/50">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Chat — {asset.ticker || asset.name}</span>
                      <div className="flex-1" />
                      <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                        <FileText className="h-3 w-3" />
                        {documents.filter((d) => d.extracted_text).length} docs
                      </Badge>
                    </div>

                    {/* Blue context banner */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 mb-2">
                      <p className="text-[11px] text-primary flex items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0" />
                        Acesso automático a {documents.filter((d) => d.extracted_text).length} documentos de {asset.ticker || asset.name}
                      </p>
                    </div>

                    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                      <div className="space-y-4 pb-4">
                        {messages.map((msg, i) => (
                          <div key={i} className={`group/msg flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            {msg.role === "assistant" && (
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                              </div>
                            )}
                            <div className="relative max-w-[80%]">
                              <div className={`rounded-xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                {msg.role === "assistant" ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                  </div>
                                ) : (
                                  <p className="text-sm">{msg.content}</p>
                                )}
                              </div>
                              {msg.role === "assistant" && msg.content && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="absolute -bottom-3 right-2 h-6 w-6 bg-background shadow-sm opacity-0 group-hover/msg:opacity-100 transition-opacity"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    toast({ title: "Copiado!" });
                                  }}
                                  title="Copiar"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {msg.role === "user" && (
                              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                                <User className="h-3.5 w-3.5 text-secondary-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                          <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
                            </div>
                            <div className="bg-muted rounded-xl px-4 py-3">
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Asset-specific suggestions */}
                    {messages.length === 0 && !isStreaming && (
                      <div className="flex flex-wrap gap-2 pb-2">
                        {[
                          "Como evoluiu o Health Score?",
                          "Compare os relatórios disponíveis",
                          asset.asset_type === "fii" ? "Qual o Dividend Yield?" : "Qual o EBITDA?",
                          asset.asset_type === "fii" ? "Como está a vacância?" : "Como estão as margens?",
                          "Quais os principais riscos?",
                        ].map((q) => (
                          <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => setInput(q)}>
                            {q}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-border/50">
                      <Input
                        placeholder={`Pergunte sobre ${asset.ticker || asset.name}...`}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        disabled={isStreaming}
                      />
                      <Button onClick={sendMessage} disabled={isStreaming || !input.trim()} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete doc dialog */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar documento?</AlertDialogTitle>
            <AlertDialogDescription>"{deletingDoc?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDoc && handleDeleteDoc(deletingDoc)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
