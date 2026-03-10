import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Send, Plus, MessageSquare, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: activeConv,
      role: "user",
      content: userMsg.content,
    });

    // Update conversation title if first message
    if (messages.length === 0) {
      const title = userMsg.content.slice(0, 60);
      await supabase.from("conversations").update({ title }).eq("id", activeConv);
      setConversations((prev) => prev.map((c) => (c.id === activeConv ? { ...c, title } : c)));
    }

    // Stream AI response
    let assistantContent = "";
    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
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

      // Save assistant message
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
        <Button onClick={createConversation} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {loadingConvs ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                    activeConv === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 inline mr-2" />
                  {conv.title}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <Card className="flex-1 glass flex flex-col">
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Bot className="h-16 w-16 mx-auto text-primary/50" />
                <h2 className="font-display text-xl font-semibold">FinSight AI Chat</h2>
                <p className="text-muted-foreground max-w-md">
                  Faça perguntas sobre seus documentos financeiros, analise relatórios e obtenha insights de mercado.
                </p>
                <Button onClick={createConversation} className="gap-2 lg:hidden">
                  <Plus className="h-4 w-4" /> Nova conversa
                </Button>
              </div>
            </div>
          ) : (
            <>
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

              {/* Suggested questions */}
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
                  placeholder="Pergunte sobre seus documentos financeiros..."
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
