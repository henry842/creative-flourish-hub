import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Send, Plus, MessageSquare, Bot, User, BookOpen, Trash2, Check, X, FileText, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

interface Document {
  id: string;
  name: string;
  ticker: string | null;
  status: string;
  extracted_text: string | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

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

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Document context
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete state
  const [deletingConv, setDeletingConv] = useState<Conversation | null>(null);

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations(data || []);
    setLoadingConvs(false);
  }, [user]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("id, name, ticker, status, extracted_text")
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
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data || []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
  }, []);

  const createConversation = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((prev) => [data, ...prev]);
    setActiveConv(data.id);
    setMessages([]);
  };

  const handleRenameConv = async (convId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const { error } = await supabase.from("conversations").update({ title: renameValue.trim() }).eq("id", convId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: renameValue.trim() } : c)));
      toast({ title: "Conversa renomeada ✅" });
    }
    setRenamingId(null);
  };

  const handleDeleteConv = async (conv: Conversation) => {
    await supabase.from("messages").delete().eq("conversation_id", conv.id);
    const { error } = await supabase.from("conversations").delete().eq("id", conv.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (activeConv === conv.id) {
        setActiveConv(null);
        setMessages([]);
      }
      toast({ title: "Conversa removida" });
    }
    setDeletingConv(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || !user || isStreaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    await supabase.from("messages").insert({
      conversation_id: activeConv,
      role: "user",
      content: userMsg.content,
    });

    if (messages.length === 0) {
      const title = userMsg.content.slice(0, 60);
      await supabase.from("conversations").update({ title }).eq("id", activeConv);
      setConversations((prev) => prev.map((c) => (c.id === activeConv ? { ...c, title } : c)));
    }

    let assistantContent = "";
    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      
      // Build document context to send to the edge function
      let documentContext: string | undefined;
      if (selectedDoc?.extracted_text) {
        documentContext = `[DOCUMENTO SELECIONADO: "${selectedDoc.name}"${selectedDoc.ticker ? ` (Ticker: ${selectedDoc.ticker})` : ""}]\n\n${selectedDoc.extracted_text.slice(0, 12000)}`;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, documentContext }),
      });

      if (resp.status === 429) {
        toast({ title: "Limite atingido", description: "Tente novamente em alguns instantes.", variant: "destructive" });
        setIsStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: "Créditos insuficientes", description: "Adicione créditos ao workspace.", variant: "destructive" });
        setIsStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Falha na conexão com IA");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
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
                if (last?.role === "assistant" && !last.id) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (assistantContent) {
        await supabase.from("messages").insert({
          conversation_id: activeConv,
          role: "assistant",
          content: assistantContent,
        });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setIsStreaming(false);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar conversations */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col gap-2">
        <div className="flex gap-2">
          <Button onClick={createConversation} className="flex-1 gap-2">
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
                <DialogTitle className="font-display flex items-center gap-2">📖 Glossário Financeiro</DialogTitle>
                <DialogDescription>Os 10 termos mais importantes usados no app</DialogDescription>
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
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {loadingConvs ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)
            ) : (
              conversations.map((conv) => (
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
                    <button
                      onClick={() => loadMessages(conv.id)}
                      onDoubleClick={() => { setRenamingId(conv.id); setRenameValue(conv.title); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors pr-14 ${
                        activeConv === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                      }`}
                      title="Duplo clique para renomear"
                    >
                      <MessageSquare className="h-3 w-3 inline mr-2" />
                      {conv.title}
                    </button>
                  )}
                  {renamingId !== conv.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeletingConv(conv); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete conversation dialog */}
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
                <Bot className="h-16 w-16 mx-auto text-primary/50" />
                <h2 className="font-display text-xl font-semibold">FinSight AI Chat</h2>
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
                      O principal risco é a alta dependência do segmento de data centers, que representa 83% da receita...
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button onClick={createConversation} className="gap-2">
                    <Plus className="h-4 w-4" /> Nova conversa
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2 lg:hidden">
                        <BookOpen className="h-4 w-4" /> Glossário
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-2">📖 Glossário Financeiro</DialogTitle>
                        <DialogDescription>Os 10 termos mais importantes usados no app</DialogDescription>
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
              </div>
            </div>
          ) : (
            <>
              {/* Document selector bar */}
              <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={selectedDocId || "none"}
                  onValueChange={(v) => setSelectedDocId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs flex-1 max-w-sm">
                    <SelectValue placeholder="Nenhum documento selecionado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sem documento (conversa livre)</span>
                    </SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <span className="flex items-center gap-2">
                          {doc.name}
                          {doc.ticker && (
                            <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {doc.ticker}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDoc && (
                  <Badge variant="outline" className="text-[10px] shrink-0 gap-1 border-primary/30 text-primary">
                    <FileText className="h-3 w-3" />
                    Contexto ativo
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4 pb-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
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

              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {[
                    "Qual o maior risco desse documento?",
                    "Como estão as margens da empresa?",
                    "Vale a pena investir?",
                    "Quais são os red flags?",
                    "Resuma os principais números",
                  ].map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setInput(q); }}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-border/50">
                <Input
                  placeholder={selectedDoc ? `Pergunte sobre "${selectedDoc.name}"...` : "Pergunte sobre seus documentos financeiros..."}
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
  );
}
