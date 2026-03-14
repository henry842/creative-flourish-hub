import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  MessageSquare,
  Swords,
  TrendingUp,
  FileText,
  Zap,
  Clock,
  FileWarning,
  BarChart3,
  Target,
  Brain,
  FolderOpen,
  Bell,
  Bot,
  BookOpen,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Radar,
  Trophy,
  History,
  Star,
  Calendar,
  Newspaper,
  ChevronRight,
  ArrowRight,
  Eye,
  Github,
  Twitter,
  Linkedin,
  Mail,
  Check,
  X,
} from "lucide-react";

/* ─── scroll-reveal hook ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("opacity-100", "translate-y-0");
          el.classList.remove("opacity-0", "translate-y-8");
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}>
      {children}
    </div>
  );
}

/* ─── section wrapper ─── */
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-20 md:py-28 ${className}`}>
      <div className="max-w-6xl mx-auto px-6">{children}</div>
    </section>
  );
}

function SectionTitle({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <Reveal className="text-center mb-14">
      {badge && <Badge variant="secondary" className="mb-4 text-xs font-medium tracking-wide uppercase">{badge}</Badge>}
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">{title}</h2>
      {subtitle && <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{subtitle}</p>}
    </Reveal>
  );
}

/* ─── data ─── */
const painPoints = [
  { icon: FileWarning, title: "Relatórios de 50+ páginas", desc: "Você não tem tempo para ler cada detalhe de um relatório trimestral ou prospecto." },
  { icon: BarChart3, title: "Dados difíceis de comparar", desc: "Comparar métricas entre ativos exige planilhas intermináveis e horas de trabalho." },
  { icon: Clock, title: "Sem tempo para monitorar", desc: "O mercado muda rápido e você descobre as notícias tarde demais." },
];

const featureCategories = [
  {
    emoji: "📊",
    title: "Análise com IA",
    color: "from-primary/20 to-primary/5",
    features: [
      { icon: Shield, name: "Health Score 0-100", desc: "Score automático com 5 subcategorias de saúde financeira" },
      { icon: AlertTriangle, name: "Red Flags por IA", desc: "Detecta riscos ocultos que passam despercebidos" },
      { icon: Target, name: "Price Target", desc: "Preço-alvo calculado com base nos dados reais do documento" },
      { icon: TrendingUp, name: "Sentimento", desc: "Classifica automaticamente: Bullish, Bearish ou Neutro" },
      { icon: FileText, name: "Qualquer PDF", desc: "Analisa relatórios de FII, 10-K, earnings, CVM e mais" },
    ],
  },
  {
    emoji: "⚔️",
    title: "Comparação",
    color: "from-bearish/20 to-bearish/5",
    features: [
      { icon: Swords, name: "Modo Batalha", desc: "Compare dois ativos lado a lado com IA" },
      { icon: Radar, name: "Gráfico Radar", desc: "Visualize pontos fortes e fracos de cada ativo" },
      { icon: Trophy, name: "Ranking", desc: "Classifique suas empresas do melhor ao pior score" },
      { icon: History, name: "Histórico", desc: "Todas as batalhas salvas para consulta futura" },
    ],
  },
  {
    emoji: "📁",
    title: "Portfólio Inteligente",
    color: "from-accent/20 to-accent/5",
    features: [
      { icon: FolderOpen, name: "Pastas por Ativo", desc: "Organize documentos, análises e chats por empresa" },
      { icon: MessageSquare, name: "Chat Dedicado", desc: "Converse com a IA focada em um ativo específico" },
      { icon: Eye, name: "Histórico de Análises", desc: "Acompanhe a evolução do score ao longo do tempo" },
      { icon: Star, name: "Watchlist", desc: "Monitore tickers que te interessam" },
    ],
  },
  {
    emoji: "🤖",
    title: "Automação",
    color: "from-neutral/20 to-neutral/5",
    features: [
      { icon: Newspaper, name: "Briefing Diário", desc: "Resumo automático das notícias dos seus ativos" },
      { icon: Bell, name: "Alertas", desc: "Notificação quando o score de um ativo muda" },
      { icon: Calendar, name: "Agendamento", desc: "Configure horário e ativos do briefing automático" },
      { icon: Zap, name: "Tempo Real", desc: "Dados processados em segundos, não horas" },
    ],
  },
  {
    emoji: "💬",
    title: "Chat Inteligente",
    color: "from-primary/20 to-accent/5",
    features: [
      { icon: Brain, name: "Converse com Docs", desc: "Pergunte qualquer coisa sobre seus documentos" },
      { icon: BookOpen, name: "Multi-documento", desc: "Contexto cruzado entre vários relatórios" },
      { icon: Sparkles, name: "Sugestões", desc: "A IA sugere perguntas relevantes automaticamente" },
      { icon: Bot, name: "Glossário", desc: "Explica termos financeiros quando necessário" },
    ],
  },
];

const steps = [
  { icon: Upload, title: "Faça upload do PDF", desc: "Arraste qualquer relatório financeiro — FII, 10-K, earnings ou CVM." },
  { icon: Brain, title: "IA analisa em segundos", desc: "Extração de dados, Health Score, Red Flags e sentimento calculados automaticamente." },
  { icon: CheckCircle2, title: "Tome decisões melhores", desc: "Visualize tudo em dashboards intuitivos e converse com a IA sobre os resultados." },
];

const useCases = [
  { title: "Analisamos o MXRF11 em 30 segundos", desc: "Upload do relatório gerencial → Health Score 72/100, 2 Red Flags detectadas, sentimento Neutro. Tudo automático.", tag: "Análise" },
  { title: "Comparamos BBRC11 vs MXRF11", desc: "Modo Batalha revelou que BBRC11 tem margem líquida superior mas dívida mais alta. Gráfico radar com comparação visual.", tag: "Batalha" },
  { title: "Briefing diário às 8h", desc: "Agendamento configurado: às 8h recebe resumo com notícias, variações de score e alertas dos ativos da watchlist.", tag: "Automação" },
];

const metrics = [
  { value: "32", label: "páginas analisadas", suffix: "em 30 segundos" },
  { value: "88", label: "Health Score", suffix: "gerado automaticamente" },
  { value: "3", label: "Red Flags detectadas", suffix: "que você não viu" },
  { value: "100%", label: "baseado nos dados", suffix: "reais do documento" },
];

const docTypes = [
  "Relatórios de FII", "10-K americanos", "Earnings Releases",
  "Informes CVM", "Relatórios Gerenciais", "Balanços Patrimoniais",
];

const plans = [
  {
    name: "Free",
    price: "R$0",
    period: "/mês",
    desc: "Para explorar o produto",
    popular: false,
    features: [
      { text: "3 análises por mês", included: true },
      { text: "Chat com IA (limitado)", included: true },
      { text: "Health Score básico", included: true },
      { text: "1 ativo no portfólio", included: true },
      { text: "Modo Batalha", included: false },
      { text: "Briefing diário", included: false },
      { text: "Alertas automáticos", included: false },
    ],
  },
  {
    name: "Pro",
    price: "R$49",
    period: "/mês",
    desc: "Para investidores ativos",
    popular: true,
    features: [
      { text: "Análises ilimitadas", included: true },
      { text: "Chat com IA ilimitado", included: true },
      { text: "Health Score completo", included: true },
      { text: "Ativos ilimitados", included: true },
      { text: "Modo Batalha + Ranking", included: true },
      { text: "Briefing diário automático", included: true },
      { text: "Alertas automáticos", included: false },
    ],
  },
  {
    name: "Enterprise",
    price: "R$199",
    period: "/mês",
    desc: "Para times e gestoras",
    popular: false,
    features: [
      { text: "Tudo do Pro", included: true },
      { text: "API de integração", included: true },
      { text: "Multi-usuários", included: true },
      { text: "Alertas avançados", included: true },
      { text: "Suporte prioritário", included: true },
      { text: "Relatórios customizados", included: true },
      { text: "SLA garantido", included: true },
    ],
  },
];

const faqs = [
  { q: "Funciona com qualquer PDF?", a: "Sim! O FinSight AI analisa qualquer PDF financeiro — relatórios de FII, 10-K americanos, earnings releases, informes CVM, balanços patrimoniais e relatórios gerenciais. Se o documento contém dados financeiros, nossa IA consegue extrair e analisar." },
  { q: "Os dados são seguros?", a: "Absolutamente. Seus documentos são armazenados com criptografia e acessíveis apenas por você. Não compartilhamos dados com terceiros e seguimos as melhores práticas de segurança da indústria." },
  { q: "Preciso saber de finanças?", a: "Não! O FinSight AI foi projetado para ser acessível. O Health Score simplifica métricas complexas, a IA explica termos técnicos automaticamente e o chat responde qualquer dúvida em linguagem simples." },
  { q: "Como funciona o briefing diário?", a: "Você configura os ativos e o horário. Todo dia, a IA busca notícias relevantes, cruza com seus dados e gera um resumo personalizado. É como ter um analista trabalhando para você 24/7." },
  { q: "Qual IA é usada?", a: "Utilizamos modelos de última geração incluindo Llama 3.3 70B para análise de texto e Google Gemini para processamento de documentos visuais, garantindo máxima precisão na extração de dados." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Sem fidelidade, sem multa. Cancele a qualquer momento nas configurações da sua conta e continue usando até o final do período pago." },
];

/* ─── component ─── */
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold gradient-text">FinSight AI</span>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Login</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="font-display">Começar Grátis</Button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <header className="relative pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <Sparkles className="h-3 w-3" /> Powered by AI
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Sua Inteligência{" "}
              <span className="gradient-text">Financeira</span>{" "}
              com IA
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Transforme qualquer relatório financeiro em insights acionáveis em segundos.
              Health Score, Red Flags, Chat com IA e muito mais — tudo automático.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="font-display text-base px-8 h-12 gap-2">
                Começar Grátis <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }} className="font-display text-base px-8 h-12">
                Ver Demo
              </Button>
            </div>
          </div>

          {/* Dashboard mockup */}
          <Reveal className="mt-16">
            <div className="relative mx-auto max-w-4xl">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-2xl" />
              <div className="relative rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                  <div className="w-3 h-3 rounded-full bg-bearish/60" />
                  <div className="w-3 h-3 rounded-full bg-neutral/60" />
                  <div className="w-3 h-3 rounded-full bg-accent/60" />
                  <span className="ml-2 text-xs text-muted-foreground font-mono">finsight.ai/dashboard</span>
                </div>
                <div className="p-6 grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-4">
                    <div className="flex gap-3">
                      {[
                        { label: "Health Score", value: "88/100", color: "text-accent" },
                        { label: "Sentimento", value: "Bullish", color: "text-accent" },
                        { label: "Red Flags", value: "2", color: "text-bearish" },
                      ].map((m) => (
                        <div key={m.label} className="flex-1 rounded-lg bg-muted/50 p-3 border border-border/30">
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className={`font-display font-bold text-lg ${m.color}`}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border/30 p-4 h-32 flex items-end gap-1">
                      {[40, 55, 45, 70, 65, 80, 75, 88, 82, 90, 85, 88].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-primary/80 to-primary/30 rounded-sm" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted/50 border border-border/30 p-3">
                      <p className="text-xs text-muted-foreground mb-2">Subcategorias</p>
                      {["Revenue Growth", "Net Margin", "Debt Level", "Earnings Quality", "Regulatory"].map((s, i) => (
                        <div key={s} className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">{s}</span>
                          <span className="font-display font-semibold text-foreground">{[85, 78, 92, 88, 95][i]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-bearish/10 border border-bearish/20 p-3">
                      <p className="text-xs font-medium text-bearish flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Red Flag</p>
                      <p className="text-xs text-muted-foreground mt-1">Aumento de 40% na dívida de curto prazo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      {/* ═══ LOGO BAR ═══ */}
      <div className="border-y border-border/40 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-6">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {["Groq", "Google Gemini", "Supabase", "XP Asset", "B3"].map((name) => (
              <span key={name} className="font-display text-lg md:text-xl font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ PROBLEM ═══ */}
      <Section>
        <SectionTitle
          badge="O Problema"
          title="⏰ Você perde horas lendo relatórios financeiros?"
          subtitle="Investidores gastam em média 4 horas por semana apenas lendo relatórios. E mesmo assim, perdem detalhes críticos."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {painPoints.map((p, i) => (
            <Reveal key={i} className={`delay-${i * 100}`}>
              <Card className="h-full border-border/50 bg-card/50 hover:border-bearish/30 transition-colors group">
                <CardContent className="pt-8 pb-6 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-bearish/10 flex items-center justify-center group-hover:bg-bearish/20 transition-colors">
                    <p.icon className="h-7 w-7 text-bearish" />
                  </div>
                  <h3 className="font-display font-semibold text-lg">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ FEATURES ═══ */}
      <Section id="features" className="bg-muted/20">
        <SectionTitle
          badge="Features"
          title="Tudo que você precisa para analisar investimentos"
          subtitle="Uma plataforma completa que substitui planilhas, relatórios e horas de pesquisa."
        />
        <div className="space-y-12">
          {featureCategories.map((cat, ci) => (
            <Reveal key={ci}>
              <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
                <div className={`px-6 py-4 bg-gradient-to-r ${cat.color} border-b border-border/30`}>
                  <h3 className="font-display font-bold text-lg">{cat.emoji} {cat.title}</h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.features.map((f, fi) => (
                    <div key={fi} className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="shrink-0 mt-0.5">
                        <f.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-display font-semibold text-sm">{f.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ HOW IT WORKS ═══ */}
      <Section>
        <SectionTitle
          badge="Como funciona"
          title="3 passos. 30 segundos. Zero complicação."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <Reveal key={i}>
              <div className="text-center space-y-4 relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-border/50" />
                )}
                <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <s.icon className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="font-display text-xs text-muted-foreground">Passo {i + 1}</div>
                <h3 className="font-display font-bold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ USE CASES ═══ */}
      <Section className="bg-muted/20">
        <SectionTitle
          badge="Casos de uso"
          title="Veja o FinSight AI em ação"
          subtitle="Exemplos reais de como investidores usam a plataforma no dia a dia."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {useCases.map((uc, i) => (
            <Reveal key={i}>
              <Card className="h-full border-border/50 overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="h-40 bg-gradient-to-br from-primary/10 via-muted/50 to-accent/10 flex items-center justify-center border-b border-border/30">
                  <div className="text-center">
                    <Badge variant="outline" className="mb-2">{uc.tag}</Badge>
                    <div className="font-display font-bold text-primary text-sm">Screenshot</div>
                  </div>
                </div>
                <CardContent className="pt-5 pb-6 space-y-2">
                  <h3 className="font-display font-semibold">{uc.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{uc.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ METRICS ═══ */}
      <Section>
        <SectionTitle
          badge="Resultados"
          title="Números que impressionam"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {metrics.map((m, i) => (
            <Reveal key={i}>
              <div className="text-center space-y-1">
                <p className="font-display text-4xl md:text-5xl font-bold gradient-text">{m.value}</p>
                <p className="font-display font-semibold text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.suffix}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ DOC TYPES ═══ */}
      <Section className="bg-muted/20">
        <SectionTitle
          badge="Compatibilidade"
          title="Funciona com qualquer documento financeiro"
          subtitle="Nosso motor de IA entende a estrutura de diversos tipos de relatórios."
        />
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {docTypes.map((d) => (
              <div key={d} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-4 hover:border-primary/30 transition-colors">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium">{d}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* ═══ PRICING ═══ */}
      <Section id="pricing">
        <SectionTitle
          badge="Planos"
          title="Escolha o plano ideal para você"
          subtitle="Comece grátis e evolua conforme sua necessidade."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <Reveal key={i}>
              <Card className={`h-full relative overflow-hidden ${plan.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border/50"}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">Mais Popular</Badge>
                  </div>
                )}
                <CardContent className="pt-8 pb-6 space-y-6">
                  <div>
                    <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.desc}</p>
                  </div>
                  <div>
                    <span className="font-display text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <Button
                    className={`w-full font-display ${plan.popular ? "" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/auth")}
                  >
                    {plan.price === "R$0" ? "Começar Grátis" : "Assinar Agora"}
                  </Button>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-sm">
                        {f.included ? (
                          <Check className="h-4 w-4 text-accent shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={f.included ? "" : "text-muted-foreground/50"}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ FAQ ═══ */}
      <Section id="faq" className="bg-muted/20">
        <SectionTitle
          badge="FAQ"
          title="Perguntas frequentes"
        />
        <Reveal>
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-lg px-4 bg-card/60">
                  <AccordionTrigger className="text-sm font-display font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Reveal>
      </Section>

      {/* ═══ CTA FINAL ═══ */}
      <Section>
        <Reveal>
          <div className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-accent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,transparent_0%,hsl(var(--background)/0.3)_100%)]" />
            <div className="relative py-16 md:py-20 px-8 text-center">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Comece a analisar seus investimentos com IA hoje
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
                Crie sua conta gratuita e analise seu primeiro documento em menos de 1 minuto.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="font-display text-base px-10 h-13 bg-background text-foreground hover:bg-background/90 gap-2"
              >
                Criar Conta Grátis <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border/40 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <span className="font-display font-bold text-lg gradient-text">FinSight AI</span>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Inteligência financeira para todos os investidores.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Recursos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => navigate("/auth")}>Dashboard</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => navigate("/auth")}>Chat com IA</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-pointer" onClick={() => navigate("/auth")}>Modo Batalha</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Contato</h4>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
                  <Twitter className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
                  <Linkedin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/40 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} FinSight AI. Todos os direitos reservados.</p>
            <p className="text-xs text-muted-foreground/60 max-w-lg text-center md:text-right">
              Disclaimer: FinSight AI é uma ferramenta de análise e não constitui recomendação de investimento.
              Consulte um profissional certificado antes de tomar decisões financeiras.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
