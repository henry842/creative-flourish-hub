import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

interface TimelineEvent {
  date: string;
  event: string;
}

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Timeline de Eventos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-border" />
          <ul className="space-y-4">
            {events.map((ev, i) => (
              <li key={i} className="relative">
                <div className="absolute -left-[1.125rem] top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <p className="text-xs font-medium text-primary">{ev.date}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{ev.event}</p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
