import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Send, Plus, MessageSquare, Bot, User, BookOpen, Trash2, Check, X,
  FileText, Copy, RefreshCw, Download, Search, Menu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer, DrawerContent, DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { streamChat } from "@/lib/ai";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  ticker: string | null;
  status: string;
  extracted_text: string | null;
  doc_type: string | null;
}

const MAX_CONTEXT_CHARS = 12000;

const GLOSSARY = [
  { term: "P/E Ratio", desc: "Preço da ação dividido pelo lucro por ação — indica se está cara ou barata" },
  { term: "EBITDA", desc: "Lucro antes de juros, impostos, depreciação e amortização — mostra o resultado operacional" },
  { term: "ROE", desc: "Retorno sobre patrimônio líquido — quanto de lucro a empresa gera com o dinheiro dos acionistas" },
  { term: "Margem Líquida", desc: "Percentual de lucro que sobra de cada real de receita após todos os custos" },
  { term: "EPS", desc: "Lucro por ação — quanto cada ação gerou de lucro no período" },
  { term: "Market Cap", desc: "Valor de mercado total da empresa — preço da ação × número de ações" },
  { term: "Dividend Yield", desc: "Percentual de dividendos pagos em relação ao preço da ação" },
  { term: "Free Cash Flow", desc: "Caixa livre gerado pela operação após investimentos — dinheiro real disponível" },
  { term: "ROIC", desc: "Retorno sobre capital investido — eficiência na geração de lucro com todo capital empregado" },
  { term: "Alavancagem", desc: "Proporção de dívida usada para financiar a empresa — maior = mais risco" },
];

const FII_SUGGESTIONS = [
  "Qual o Dividend Yield atual?",
  "Como está a vacância?",
  "Qual a distribuição por m²?",
  "Quais os principais locatários?",
  "Resuma os riscos do fundo",
];

const STOCK_SUGGESTIONS = [
  "Qual o EBITDA atual?",
  "Como estão as margens?",
  "Qual o nível de endividamento?",
  "Resuma os pontos fortes",
  "Quais os riscos regulatórios?",
];

const GENERIC_SUGGESTIONS = [
  "Qual o maior risco desse documento?",
  "Resuma os principais números",
  "Vale a pena investir?",
  "Quais são os red flags?",
  "Compare com o período anterior",
];

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Chat() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Multi-document context
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Rename/delete state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingConv, setDeletingConv] = useState<Conversation | null>(null);

  const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));

  // Context char count
  const contextChars = useMemo(() => {
    return selectedDocs.reduce((sum, d) => sum + (d.extracted_text?.length || 0), 0);
  }, [selectedDocs]);

  const truncatedContextChars = Math.min(contextChars, MAX_CONTEXT_CHARS);

  // Dynamic suggestions based on selected docs
  const suggestions = useMemo(() => {
    if (selectedDocs.length === 0) return GENERIC_SUGGESTIONS;
    const hasFII = selectedDocs.some((d) =>
      d.name.toLowerCase().includes("fii") ||
      d.ticker?.match(/\d{2}$/) ||
      d.doc_type === "fii"
    );
    return hasFII ? FII_SUGGESTIONS : STOCK_SUGGESTIONS;
  }, [selectedDocs]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const hasUsableDocContext = useCallback((doc: Document | null) => {
    if (!doc?.extracted_text) return false;
    const text = doc.extracted_text.trim();
    if (text.length < 500) return false;
    const lower = text.toLowerCase();
    const invalidMarkers = ["falha na extração", "não foi possível extrair", "texto extraído limitado", "use o botão editar para colar"];
    return !invalidMarkers.some((marker) => lower.includes(marker));
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .is("asset_id", null)
      .order("updated_at", { ascending: false });
    setConversations(data || []);
    setLoadingConvs(false);
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("id, name, ticker, status, extracted_text, doc_type")
      .eq("user_id", user.id)
      .in("status", ["analyzed", "processed"])
      .order("created_at", { ascending: false });
    setDocuments(data || []);
  }, [user]);

  useEffect(() => {
    fetchConversations();
    fetchDocuments();
  }, [fetchConversations, fetchDocuments]);

  const loadMessages = useCallback(async (convId: string) => {
    setActiveConv(convId);
    setDrawerOpen(false);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data || []).map((m) => ({
      id: m.id, role: m.role as "user" | "assistant", content: m.content, created_at: m.created_at,
    })));
  }, []);

  const createConversation = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select()
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setConversations((prev) => [data, ...prev]);
    setActiveConv(data.id);
    setMessages([]);
    setDrawerOpen(false);
  };

  const handleRenameConv = async (convId: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const { error } = await supabase.from("conversations").update({ title: renameValue.trim() }).eq("id", convId);
    if (!error) {
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: renameValue.trim() } : c)));
      toast({ title: "Conversa renomeada" });
    }
    setRenamingId(null);
  };

  const handleDeleteConv = async (conv: Conversation) => {
    await supabase.from("messages").delete().eq("conversation_id", conv.id);
    await supabase.from("conversations").delete().eq("id", conv.id);
    setConversations((prev) => prev.filter((c) => c.id !== conv.id));
    if (activeConv === conv.id) { setActiveConv(null); setMessages([]); }
    toast({ title: "Conversa removida" });
    setDeletingConv(null);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copiado!" });
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const conv = conversations.find((c) => c.id === activeConv);
    const text = messages.map((m) => `[${m.role === "user" ? "Você" : "IA"}]\n${m.content}`).join("\n\n---\n\n");
    const header = `Conversa: ${conv?.title || "Chat"}\nExportado em: ${new Date().toLocaleString("pt-BR")}\n\n${"=".repeat(50)}\n\n`;
    const blob = new Blob([header + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${conv?.title?.replace(/\s+/g, "-") || "export"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Conversa exportada!" });
  };

  const buildDocumentContext = useCallback(() => {
    if (selectedDocs.length === 0) return undefined;
    const usable = selectedDocs.filter((d) => hasUsableDocContext(d));
    if (usable.length === 0) return undefined;

    const perDoc = Math.floor(MAX_CONTEXT_CHARS / usable.length);
    const parts = usable.map((d) =>
      `[DOCUMENTO: "${d.name}"${d.ticker ? ` (Ticker: ${d.ticker})` : ""}]\n\n${d.extracted_text!.slice(0, perDoc)}`
    );
    return parts.join("\n\n---\n\n");
  }, [selectedDocs, hasUsableDocContext]);

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || input.trim();
    if (!content || !activeConv || !user || isStreaming) return;
    const userMsg: Message = { role: "user", content, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    if (!overrideContent) setInput("");
    setIsStreaming(true);

    await supabase.from("messages").insert({ conversation_id: activeConv, role: "user", content });

    if (messages.length === 0) {
      const title = content.slice(0, 60);
      await supabase.from("conversations").update({ title }).eq("id", activeConv);
      setConversations((prev) => prev.map((c) => (c.id === activeConv ? { ...c, title } : c)));
    }

    let assistantContent = "";
    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const documentContext = buildDocumentContext();

      await streamChat({
        messages: allMessages,
        documentContext,
        onDelta: (delta) => {
          assistantContent += delta;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.id)
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
            return [...prev, { role: "assistant", content: assistantContent, created_at: new Date().toISOString() }];
          });
        },
      });

      if (assistantContent) {
        await supabase.from("messages").insert({ conversation_id: activeConv, role: "assistant", content: assistantContent });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsStreaming(false);
  };

  const regenerateLastResponse = async () => {
    // Find last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const lastUserMsg = messages[messages.length - 1 - lastUserIdx];

    // Remove last assistant message from DB and state
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.id) {
      await supabase.from("messages").delete().eq("id", lastMsg.id);
    }
    setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1));

    // Re-send
    await sendMessage(lastUserMsg.content);
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Sidebar content (reused for desktop and mobile drawer)
  const sidebarContent = (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2">
        <Button onClick={createConversation} className="flex-1 gap-2" size={isMobile ? "default" : "default"}>
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" title="Glossário Financeiro">
              <BookOpen className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">Glossário Financeiro</DialogTitle>
              <DialogDescription>Os 10 termos mais importantes</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {GLOSSARY.map((item) => (
                <div key={item.term} className="rounded-lg bg-muted/50 p-3">
                  <p className="font-medium text-sm">{item.term}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar conversas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs pl-8"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 pr-2">
          {loadingConvs ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)
          ) : filteredConversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            </p>
          ) : (
            filteredConversations.map((conv) => (
              <div key={conv.id} className="group relative">
                {renamingId === conv.id ? (
                  <div className="flex items-center gap-1 px-1">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameConv(conv.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRenameConv(conv.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setRenamingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => loadMessages(conv.id)}
                      onDoubleClick={() => { setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className={`flex-1 min-w-0 text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                        activeConv === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                      }`}
                      title="Duplo clique para renomear"
                    >
                      <MessageSquare className="h-3 w-3 inline mr-2" />
                      {conv.title}
                    </button>
                    <button
                      className="flex-none w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeletingConv(conv); }}
                      title="Deletar conversa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Date separator logic
  const renderMessagesWithDateSeparators = () => {
    const elements: React.ReactNode[] = [];
    let lastDateLabel = "";

    messages.forEach((msg, i) => {
      const dateLabel = msg.created_at ? getDateLabel(msg.created_at) : "";
      if (dateLabel && dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel;
        elements.push(
          <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{dateLabel}</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
        );
      }

      const isLastAssistant = msg.role === "assistant" && (i === messages.length - 1 || messages[i + 1]?.role === "user");

      elements.push(
        <div key={i} className={`group/msg flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Bot className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="relative max-w-[80%]">
            <div className={`rounded-xl px-4 py-3 ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
            {/* Copy button on hover for assistant messages */}
            {msg.role === "assistant" && msg.content && (
              <div className="absolute -bottom-3 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 bg-background shadow-sm"
                  onClick={() => copyMessage(msg.content)}
                  title="Copiar"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {isLastAssistant && !isStreaming && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 bg-background shadow-sm"
                    onClick={regenerateLastResponse}
                    title="Regenerar"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {msg.role === "user" && (
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
              <User className="h-4 w-4 text-secondary-foreground" />
            </div>
          )}
        </div>
      );
    });

    return elements;
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Desktop sidebar */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col gap-2">
        {sidebarContent}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deletingConv} onOpenChange={(open) => !open && setDeletingConv(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa "{deletingConv?.title}" e todas as mensagens serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingConv && handleDeleteConv(deletingConv)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat area */}
      <Card className="flex-1 glass flex flex-col">
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-6 max-w-lg">
                {/* Mobile hamburger */}
                {isMobile && (
                  <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="outline" size="icon" className="absolute top-4 left-4">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="h-[80vh] px-4 pb-4">
                      {sidebarContent}
                    </DrawerContent>
                  </Drawer>
                )}

                <Bot className="h-16 w-16 mx-auto text-primary/50" />
                <h2 className="font-display text-xl font-semibold">FinSight Chat</h2>
                <p className="text-muted-foreground">
                  Faça perguntas sobre seus documentos financeiros, analise relatórios e obtenha insights de mercado.
                </p>

                <div className="text-left space-y-3 rounded-xl bg-muted/30 p-4 border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exemplo de conversa</p>
                  <div className="flex gap-2 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-sm max-w-[75%]">
                      Qual o maior risco do relatório da NVDA?
                    </div>
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-secondary-foreground" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="bg-muted rounded-xl px-3 py-2 text-sm max-w-[75%] text-muted-foreground">
                      O principal risco é a alta dependência do segmento de data centers...
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={createConversation} className="gap-2">
                    <Plus className="h-4 w-4" /> Nova conversa
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Top bar: mobile drawer + export + doc selector */}
              <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50 flex-wrap">
                {isMobile && (
                  <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="h-[80vh] px-4 pb-4">
                      {sidebarContent}
                    </DrawerContent>
                  </Drawer>
                )}

                {/* Multi-document selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                      <FileText className="h-3.5 w-3.5" />
                      {selectedDocIds.length === 0
                        ? "Selecionar documentos"
                        : `${selectedDocIds.length} doc${selectedDocIds.length > 1 ? "s" : ""}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3" align="start">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">Selecione documentos como contexto:</p>
                    <ScrollArea className="max-h-48">
                      <div className="space-y-1">
                        {documents.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Nenhum documento analisado</p>
                        ) : (
                          documents.map((doc) => (
                            <label
                              key={doc.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={selectedDocIds.includes(doc.id)}
                                onCheckedChange={() => toggleDocSelection(doc.id)}
                              />
                              <span className="truncate flex-1">{doc.name}</span>
                              {doc.ticker && (
                                <span className="text-[10px] font-mono bg-primary/10 text-primary px-1 rounded shrink-0">
                                  {doc.ticker}
                                </span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    {selectedDocIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-xs h-7"
                        onClick={() => setSelectedDocIds([])}
                      >
                        Limpar seleção
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Token counter */}
                {selectedDocIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {truncatedContextChars.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()} chars
                  </span>
                )}

                <div className="flex-1" />

                {/* Delete conversation */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const conv = conversations.find((c) => c.id === activeConv);
                    if (conv) setDeletingConv(conv);
                  }}
                  title="Deletar conversa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* Export */}
                {messages.length > 0 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportConversation} title="Exportar conversa">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Context banner */}
              {selectedDocs.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-3 py-2 mb-2 rounded-lg bg-primary/5 border border-primary/20">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium">Analisando:</span>
                  {selectedDocs.map((doc) => (
                    <Badge
                      key={doc.id}
                      variant="outline"
                      className="text-[10px] gap-1 border-primary/30 text-primary cursor-pointer hover:bg-primary/10"
                    >
                      {doc.ticker || doc.name.slice(0, 20)}
                      <X
                        className="h-2.5 w-2.5 ml-0.5"
                        onClick={() => toggleDocSelection(doc.id)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {renderMessagesWithDateSeparators()}
                  {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary animate-pulse" />
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

              {/* Dynamic suggestions */}
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {suggestions.map((q) => (
                    <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => setInput(q)}>
                      {q}
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-border/50">
                <Input
                  placeholder={
                    selectedDocs.length > 0
                      ? `Pergunte sobre ${selectedDocs.length} documento${selectedDocs.length > 1 ? "s" : ""}...`
                      : "Pergunte sobre seus documentos financeiros..."
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  disabled={isStreaming}
                />
                <Button onClick={() => sendMessage()} disabled={isStreaming || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
