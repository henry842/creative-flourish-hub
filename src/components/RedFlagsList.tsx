import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function RedFlagsList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="glass border-neutral/30">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2 text-neutral">
            <AlertTriangle className="h-5 w-5" />
            Pontos de atenção
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                Riscos e observações relevantes detectados no documento — nem todos são negativos, alguns são pontos de atenção contextual
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <Info className="h-4 w-4 text-neutral mt-0.5 shrink-0" />
                <span className="text-foreground">{flag}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
