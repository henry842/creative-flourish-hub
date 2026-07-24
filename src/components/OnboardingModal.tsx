import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, MessageSquare, Shield } from "lucide-react";

const steps = [
  {
    icon: FileText,
    title: "1. Envie um PDF financeiro",
    description: "Faça upload de relatórios 10-K, 10-Q, earnings calls ou qualquer documento financeiro em PDF.",
  },
  {
    icon: MessageSquare,
    title: "2. Pergunte ao FinSight no Chat",
    description: "Use o chat com IA para fazer perguntas sobre métricas, riscos e oportunidades do documento.",
  },
  {
    icon: Shield,
    title: "3. Veja o Health Score e Sentimento",
    description: "Receba um score de 0-100 com 5 subcategorias, red flags e timeline de eventos automaticamente.",
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(() => {
    return !localStorage.getItem("finsight_onboarding_done");
  });
  const [step, setStep] = useState(0);

  const handleClose = () => {
    localStorage.setItem("finsight_onboarding_done", "true");
    setOpen(false);
  };

  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Bem-vindo ao FinSight
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg">{current.title}</h3>
          <p className="text-sm text-muted-foreground">{current.description}</p>

          {/* Step dots */}
          <div className="flex justify-center gap-2 pt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={handleClose}>Pular</Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Próximo</Button>
          ) : (
            <Button onClick={handleClose}>Começar!</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
