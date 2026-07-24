/*
  Landing — Persuade. Direction contract (see DESIGN.md).
  THESIS: FinSight grades a financial PDF like an exam. Prove it in the first screen by
    showing a real report becoming a scored read. Refuses the AI-SaaS hero (centered
    headline + gradient + "Powered by AI" + symmetric feature-card grid) and the
    AI-editorial cream+serif look.
  OWN-WORLD: warm porcelain canvas; deep indigo owns the hero + closing band; Bricolage
    display; terracotta spark on the single primary action and the score.
  STORY: investor sees "drop a PDF → graded read in seconds", watches it happen, reads
    honest pricing, signs up.
  FIRST VIEWPORT: light nav → indigo hero band, split: left headline + primary action;
    right an authentic analysis card (Health Score dial, sub-scores, one red flag).
  FORM: editorial product-demo landing; #2 on the ordered list, chosen (brief-pinned world).
*/
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Wordmark } from "@/components/Brand";
import {
  ArrowRight,
  Check,
  FileText,
  MessageSquare,
  Scale,
  Trophy,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";

function useCountUp(target: number, run: boolean, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

/* ── demo analysis (illustrative example, not live data) ── */
const subScores = [
  { label: "Crescimento de receita", value: 82 },
  { label: "Margem líquida", value: 74 },
  { label: "Nível de endividamento", value: 88 },
  { label: "Qualidade dos resultados", value: 71 },
  { label: "Risco regulatório", value: 90 },
];

function scoreColor(v: number) {
  return v >= 80 ? "text-bullish" : v >= 60 ? "text-neutral" : "text-bearish";
}
function scoreStroke(v: number) {
  return v >= 80 ? "hsl(var(--bullish))" : v >= 60 ? "hsl(var(--neutral))" : "hsl(var(--bearish))";
}

function AnalysisCard() {
  const [run, setRun] = useState(false);
  const score = useCountUp(78, run);
  useEffect(() => {
    const t = setTimeout(() => setRun(true), 250);
    return () => clearTimeout(t);
  }, []);
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="surface rounded-2xl p-5 sm:p-6 w-full max-w-md">
      {/* document header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Relatório Gerencial</p>
            <p className="text-xs text-muted-foreground">
              <span className="data">MXRF11</span> · Maio 2025 · 32 páginas
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">
          Exemplo
        </span>
      </div>

      {/* score + verdict */}
      <div className="flex items-center gap-5 py-5">
        <div className="relative grid place-items-center shrink-0">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={scoreStroke(78)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / 100)}
              style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <div className="absolute text-center">
            <div className={`data text-3xl font-semibold leading-none ${scoreColor(78)}`}>{score}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Health Score</div>
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral/10 text-neutral text-xs font-medium px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral" /> Sentimento neutro
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Preço-alvo estimado <span className="data text-foreground font-medium">R$ 10,40</span>
          </p>
          <p className="text-xs text-muted-foreground">Derivado dos números do próprio relatório.</p>
        </div>
      </div>

      {/* sub-scores */}
      <div className="space-y-2.5">
        {subScores.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-40 shrink-0">{s.label}</span>
            <span className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <span
                className="block h-full rounded-full bg-primary/80 origin-left"
                style={{
                  width: `${s.value}%`,
                  transform: run ? "scaleX(1)" : "scaleX(0)",
                  transition: `transform 0.9s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.08}s`,
                }}
              />
            </span>
            <span className={`data text-xs font-medium w-7 text-right ${scoreColor(s.value)}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* red flag */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-bearish/8 border border-bearish/20 p-3">
        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-bearish shrink-0" />
        <p className="text-xs text-foreground/80">
          <span className="font-medium text-bearish">Red flag</span> · vacância física subiu de{" "}
          <span className="data">4%</span> para <span className="data">7%</span> no trimestre.
        </p>
      </div>
    </div>
  );
}

/* ── capability snippets ── */
function ChatSnippet() {
  return (
    <div className="surface rounded-xl p-4 space-y-3">
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand text-brand-foreground text-sm px-3.5 py-2">
          Qual foi a vacância física no último trimestre e como ela evoluiu?
        </p>
      </div>
      <div className="flex gap-2.5">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-accent/15 text-accent shrink-0">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted text-sm px-3.5 py-2 text-foreground/90">
          A vacância física fechou o trimestre em <span className="data">7%</span>, ante{" "}
          <span className="data">4%</span> no anterior — alta de 3 p.p., concentrada em dois ativos
          logísticos. <span className="text-muted-foreground">(pág. 14)</span>
        </p>
      </div>
    </div>
  );
}

const battle = [
  { label: "Health Score", a: 78, b: 64 },
  { label: "Margem líquida", a: 74, b: 69 },
  { label: "Endividamento", a: 88, b: 55 },
];
function CompareSnippet() {
  return (
    <div className="surface rounded-xl p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3 border-b border-border">
        <span className="data text-sm font-semibold text-right">MXRF11</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">vs</span>
        <span className="data text-sm font-semibold">HGLG11</span>
      </div>
      <div className="space-y-3 pt-3">
        {battle.map((m) => (
          <div key={m.label}>
            <p className="text-[11px] text-muted-foreground text-center mb-1">{m.label}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-end">
                <span className="h-1.5 rounded-full bg-primary" style={{ width: `${m.a}%` }} />
              </div>
              <div>
                <span className="h-1.5 block rounded-full bg-muted-foreground/40" style={{ width: `${m.b}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground mt-3 pt-3 border-t border-border">
        Vantagem para <span className="data text-foreground font-medium">MXRF11</span> em 3 de 3 métricas
      </p>
    </div>
  );
}

const ranking = [
  { pos: 1, t: "HSML11", s: 84 },
  { pos: 2, t: "MXRF11", s: 78 },
  { pos: 3, t: "XPML11", s: 71 },
  { pos: 4, t: "VISC11", s: 63 },
];
function RankingSnippet() {
  return (
    <div className="surface rounded-xl p-4 space-y-1.5">
      {ranking.map((r) => (
        <div key={r.t} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
          <span className="data text-xs text-muted-foreground w-4">{r.pos}</span>
          <span className="data text-sm font-medium flex-1">{r.t}</span>
          <span className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <span className="block h-full rounded-full bg-primary/80" style={{ width: `${r.s}%` }} />
          </span>
          <span className={`data text-sm font-semibold w-7 text-right ${scoreColor(r.s)}`}>{r.s}</span>
        </div>
      ))}
    </div>
  );
}

function BriefingSnippet() {
  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
        <p className="text-sm font-semibold">Briefing diário</p>
        <span className="text-xs text-muted-foreground">Seg, 08:00</span>
      </div>
      <ul className="space-y-2 text-sm text-foreground/90">
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-bullish shrink-0" />
          <span><span className="data">HSML11</span> subiu 2 pontos após novo relatório gerencial.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral shrink-0" />
          <span><span className="data">MXRF11</span> distribuiu rendimento em linha com o histórico.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-bearish shrink-0" />
          <span>Alerta de vacância em um ativo da sua watchlist.</span>
        </li>
      </ul>
    </div>
  );
}

const capabilities = [
  {
    icon: MessageSquare,
    kicker: "Converse com os documentos",
    title: "Pergunte, em vez de procurar",
    desc: "Faça perguntas em português e receba respostas com a página de origem. O contexto cruza vários relatórios ao mesmo tempo.",
    points: ["Citações com número de página", "Contexto entre múltiplos PDFs", "Sem jargão desnecessário"],
    snippet: <ChatSnippet />,
  },
  {
    icon: Scale,
    kicker: "Modo Batalha",
    title: "Dois ativos, lado a lado",
    desc: "Compare métricas equivalentes e veja onde cada um ganha. O histórico fica salvo para você revisitar a decisão depois.",
    points: ["Comparação métrica a métrica", "Gráfico radar e veredito", "Histórico de comparações"],
    snippet: <CompareSnippet />,
  },
  {
    icon: Trophy,
    kicker: "Ranking da carteira",
    title: "Sua carteira, ordenada por qualidade",
    desc: "Todos os ativos analisados em uma única lista, do melhor ao pior score — com a variação ao longo do tempo.",
    points: ["Ordenação por Health Score", "Evolução semana a semana", "Do portfólio inteiro"],
    snippet: <RankingSnippet />,
  },
  {
    icon: CalendarClock,
    kicker: "Briefing diário",
    title: "O resumo chega até você",
    desc: "Escolha os ativos e o horário. Todo dia, um resumo com variações de score, rendimentos e alertas da sua watchlist.",
    points: ["Agendamento por horário", "Notícias e variações de score", "Só o que mudou"],
    snippet: <BriefingSnippet />,
  },
];

const docTypes = [
  "Relatórios de FII",
  "10-K americanos",
  "Releases de resultados",
  "Informes CVM",
  "Relatórios gerenciais",
  "Balanços patrimoniais",
];

const faqs = [
  {
    q: "Funciona com qualquer PDF financeiro?",
    a: "Sim. O FinSight lê relatórios de FII, 10-Ks americanos, releases de resultados, informes CVM, balanços e relatórios gerenciais. Se o documento tem dados financeiros, ele extrai e organiza — inclusive PDFs escaneados, via OCR.",
  },
  {
    q: "De onde vêm os scores e as red flags?",
    a: "Sempre dos números do próprio documento que você enviou. O Health Score e as red flags são derivados dos dados do relatório, não de estimativas genéricas. O objetivo é acelerar sua leitura, não substituir seu julgamento.",
  },
  {
    q: "Preciso entender de finanças para usar?",
    a: "Não. O Health Score resume métricas complexas em um número de 0 a 100, os termos técnicos são explicados no contexto e o chat responde em linguagem simples. Quem já entende de finanças ganha tempo; quem está começando ganha clareza.",
  },
  {
    q: "Meus documentos ficam seguros?",
    a: "Seus arquivos são privados e acessíveis apenas pela sua conta. Cada registro é isolado por usuário no banco de dados, e nada é compartilhado com terceiros.",
  },
  {
    q: "Isso é recomendação de investimento?",
    a: "Não. O FinSight é uma ferramenta de análise e organização de informação. Ele não recomenda comprar ou vender nada — a decisão, e a responsabilidade por ela, continuam sendo suas.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, sem fidelidade e sem multa. Você cancela nas configurações da conta e continua com acesso até o fim do período já pago.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-colors ${
          scrolled ? "bg-background/90 backdrop-blur border-b border-border" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/landing")} className="text-foreground" aria-label="FinSight — início">
            <Wordmark />
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#produto" className="hover:text-foreground transition-colors">Produto</a>
            <a href="#duvidas" className="hover:text-foreground transition-colors">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="hidden sm:inline-flex">
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate("/")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* HERO — indigo committed field */}
      <section className="relative bg-brand text-brand-foreground overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(var(--brand-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--brand-foreground))_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-sm text-brand-foreground/70 mb-6">
                <span className="h-px w-6 bg-accent" /> Análise de documentos financeiros
              </p>
              <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl font-bold tracking-tight text-balance">
                Leia qualquer relatório
                <br className="hidden sm:block" /> em <span className="text-accent">segundos</span>, não em horas.
              </h1>
              <p className="mt-6 text-lg text-brand-foreground/75 max-w-xl leading-relaxed text-pretty">
                Envie um PDF e o FinSight devolve um Health Score de 0 a 100, as red flags que
                passam despercebidas e um preço-alvo — tudo a partir dos números do próprio documento.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate("/")}
                  className="h-12 px-7 text-base bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                >
                  Analisar meu primeiro PDF <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-12 px-7 text-base bg-transparent border-brand-foreground/25 text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground"
                >
                  Ver como funciona
                </Button>
              </div>
              <p className="mt-5 text-sm text-brand-foreground/55">
                Grátis para começar · não pede cartão · em português.
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <AnalysisCard />
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS — connected sequence (numbers carry the order of the process) */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
        <div className="grid md:grid-cols-3 gap-x-8 gap-y-10 relative">
          <span className="hidden md:block absolute top-5 left-[16.66%] right-[16.66%] h-px bg-border" />
          {[
            { n: "1", t: "Envie o PDF", d: "Arraste um relatório de FII, 10-K, release de resultados ou informe CVM. Escaneado também vale." },
            { n: "2", t: "O FinSight lê e pontua", d: "Extrai os dados, calcula o Health Score e suas cinco subcategorias, detecta red flags e o sentimento." },
            { n: "3", t: "Você decide melhor", d: "Leia o veredito, converse com o documento e compare com outros ativos da sua carteira." },
          ].map((step) => (
            <div key={step.n} className="relative">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-brand text-brand-foreground data text-sm font-semibold ring-8 ring-background">
                {step.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CAPABILITIES — alternating, real snippets (not a symmetric card grid) */}
      <section id="produto" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
              Uma leitura completa, não só um número
            </h2>
            <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
              O score é o começo. A partir dele, você conversa com o documento, compara ativos,
              ordena a carteira e recebe o que mudou — sem sair da plataforma.
            </p>
          </div>

          <div className="mt-14 space-y-16 sm:space-y-24">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              const flip = i % 2 === 1;
              return (
                <div key={cap.title} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                  <div className={flip ? "lg:order-2" : ""}>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
                      <Icon className="h-4 w-4" /> {cap.kicker}
                    </span>
                    <h3 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight">{cap.title}</h3>
                    <p className="mt-3 text-muted-foreground leading-relaxed">{cap.desc}</p>
                    <ul className="mt-5 space-y-2.5">
                      {cap.points.map((p) => (
                        <li key={p} className="flex items-center gap-2.5 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={flip ? "lg:order-1" : ""}>{cap.snippet}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DOC TYPES — inline row, not icon cards */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="lg:w-1/3">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              Entende o formato de cada relatório
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              O mesmo motor de leitura reconhece a estrutura de documentos bem diferentes entre si.
            </p>
          </div>
          <div className="lg:w-2/3 flex flex-wrap gap-2.5">
            {docTypes.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="mx-auto max-w-3xl px-5 sm:px-6 py-16 sm:py-24">
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="mt-10 divide-y divide-border border-y border-border">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-none">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed text-[0.95rem] pb-5">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CLOSING CTA — indigo band bookend */}
      <section className="bg-brand text-brand-foreground">
        <div className="mx-auto max-w-4xl px-5 sm:px-6 py-20 sm:py-24 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-balance">
            O próximo relatório não precisa tomar sua tarde
          </h2>
          <p className="mt-5 text-lg text-brand-foreground/75 max-w-xl mx-auto">
            Crie sua conta e analise o primeiro documento em menos de um minuto.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="mt-9 h-12 px-8 text-base bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
          >
            Começar grátis <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-sm">
              <Wordmark />
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Leitura clara de documentos financeiros, a partir dos dados reais do relatório.
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#produto" className="hover:text-foreground transition-colors">Produto</a>
              <a href="#duvidas" className="hover:text-foreground transition-colors">Dúvidas</a>
              <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Entrar</button>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} FinSight. Todos os direitos reservados.
            </p>
            <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5 max-w-lg">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Ferramenta de análise — não constitui recomendação de investimento.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
