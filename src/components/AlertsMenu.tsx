import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, computeAlerts, getSeen, markSeen } from "@/lib/alerts";
import { Bell, TrendingDown, TrendingUp, ShieldAlert, AlertTriangle, ArrowLeftRight } from "lucide-react";

const ICONS = {
  score_drop: TrendingDown,
  score_rise: TrendingUp,
  sentiment_flip: ArrowLeftRight,
  new_red_flag: AlertTriangle,
  high_risk: ShieldAlert,
} as const;

const TONE = {
  critical: "text-bearish bg-bearish/10",
  warning: "text-neutral bg-neutral/10",
  info: "text-primary bg-primary/10",
} as const;

function when(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function AlertsMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => getSeen());
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setAlerts(await computeAlerts(user.id));
    } catch {
      setAlerts([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sync = () => setSeen(getSeen());
    window.addEventListener("finsight-alerts", sync);
    return () => window.removeEventListener("finsight-alerts", sync);
  }, []);

  const unread = alerts.filter((a) => !seen.has(a.id));

  const handleOpen = (next: boolean) => {
    setOpen(next);
    // Opening the panel is the acknowledgement; keep the badge honest.
    if (next && unread.length) {
      markSeen(unread.map((a) => a.id));
      setSeen(getSeen());
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={unread.length ? `${unread.length} alertas não lidos` : "Alertas"}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold grid place-items-center">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-display font-semibold text-sm">Alertas</p>
          <span className="text-xs text-muted-foreground">
            {alerts.length ? `${alerts.length} no total` : "nenhum"}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum alerta ainda. Eles aparecem quando um ativo muda de score, de sentimento
              ou ganha um novo ponto de atenção.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[380px]">
            <ul className="divide-y divide-border">
              {alerts.map((a) => {
                const Icon = ICONS[a.kind];
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate(a.assetId ? `/assets/${a.assetId}` : "/ranking");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex gap-3"
                    >
                      <span className={`grid place-items-center h-8 w-8 rounded-lg shrink-0 ${TONE[a.severity]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium truncate">{a.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{when(a.at)}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {a.detail}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="px-3 py-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => { setOpen(false); navigate("/ranking"); }}
          >
            Ver todos os ativos
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
