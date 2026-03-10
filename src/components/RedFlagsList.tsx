import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function RedFlagsList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <Card className="glass border-bearish/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2 text-bearish">
          <AlertTriangle className="h-5 w-5" />
          Red Flags Detectadas 🚩
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
  );
}
