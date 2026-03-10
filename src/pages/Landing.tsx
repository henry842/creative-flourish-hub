import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, MessageSquare, Swords, TrendingUp, FileText, Zap } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Health Score",
    desc: "Score de 0-100 com 5 subcategorias que avalia a saúde financeira completa de qualquer empresa.",
  },
  {
    icon: MessageSquare,
    title: "Chat com IA",
    desc: "Converse com um analista de IA especializado em finanças. Pergunte sobre métricas, riscos e oportunidades.",
  },
  {
    icon: Swords,
    title: "Modo Batalha",
    desc: "Compare duas empresas lado a lado e descubra o vencedor em cada categoria financeira.",
  },
];

const steps = [
  { icon: FileText, title: "Envie um PDF", desc: "Upload do relatório financeiro" },
  { icon: Zap, title: "IA Analisa", desc: "Score + Red Flags + Timeline automáticos" },
  { icon: TrendingUp, title: "Tome Decisões", desc: "Insights para investir com confiança" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">
            <span className="gradient-text">FinSight AI</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Análise financeira profissional com inteligência artificial.
            O que Bloomberg cobra milhares por mês, você faz de graça.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="font-display text-lg px-8">
              Comece Grátis 🚀
            </Button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-bold text-center mb-12">
          Tudo que você precisa para analisar empresas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="glass hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <f.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-center mb-12">Como funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg">
                  {i + 1}
                </div>
                <h3 className="font-display font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-bold mb-4">Pronto para começar?</h2>
        <p className="text-muted-foreground mb-8">Crie sua conta gratuita e analise seu primeiro documento agora.</p>
        <Button size="lg" onClick={() => navigate("/auth")} className="font-display text-lg px-8">
          Criar Conta Grátis
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} FinSight AI. Inteligência financeira para todos.</p>
      </footer>
    </div>
  );
}
