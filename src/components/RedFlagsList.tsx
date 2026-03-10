import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function RedFlagsList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="glass border-bearish/30">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2 text-bearish">
            <AlertTriangle className="h-5 w-5" />
            Red Flags Detectadas 🚩
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                Riscos críticos detectados automaticamente pela IA na análise do documento
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-bearish font-bold mt-0.5">!</span>
                <span className="text-foreground">{flag}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
