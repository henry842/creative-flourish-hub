import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Building2 } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "R$0",
    period: "/mês",
    icon: Zap,
    desc: "Para começar a explorar",
    features: [
      "5 documentos por mês",
      "Chat com IA básico",
      "Health Score",
      "1 comparação por dia",
    ],
    cta: "Começar Grátis",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$49",
    period: "/mês",
    icon: Crown,
    desc: "Para investidores sérios",
    features: [
      "Documentos ilimitados",
      "Chat com IA avançado",
      "Health Score + Price Target",
      "Comparações ilimitadas",
      "Ranking de empresas",
      "Exportação PDF",
      "Watchlist com alertas",
    ],
    cta: "Assinar Pro",
    highlight: true,
    badge: "Mais Popular",
  },
  {
    name: "Enterprise",
    price: "R$199",
    period: "/mês",
    icon: Building2,
    desc: "Para times e empresas",
    features: [
      "Tudo do Pro",
      "Modo Equipe (até 10 membros)",
      "API de acesso",
      "Suporte prioritário",
      "Relatórios personalizados",
      "SSO / SAML",
    ],
    cta: "Falar com Vendas",
    highlight: false,
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <Button variant="ghost" onClick={() => navigate("/landing")} className="mb-8 text-muted-foreground">
            ← Voltar
          </Button>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Planos & Preços
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para seu nível de análise financeira.
          </p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`glass relative flex flex-col transition-shadow hover:shadow-xl ${
                plan.highlight ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" : ""
              }`}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4">
                  {plan.badge}
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <plan.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-display text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.desc}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <span className="text-4xl font-display font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-bullish shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    if (plan.name === "Free") {
                      navigate("/");
                    } else {
                      window.open("https://wa.me/5571992683093?text=" + encodeURIComponent(`Olá! Tenho interesse no plano ${plan.name} do FinSight.`), "_blank");
                    }
                  }}
                  className="w-full font-display"
                  variant={plan.highlight ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} FinSight. Inteligência financeira para todos.</p>
      </footer>
    </div>
  );
}
