import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DAILY_LIMIT = 14400;

export function GroqCreditCounter() {
  const { user } = useAuth();
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchUsage = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("groq_usage")
        .select("request_count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setUsed(data?.request_count ?? 0);
      setLoading(false);
    };

    fetchUsage();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("groq-usage-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "groq_usage",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (newRecord) {
            const today = new Date().toISOString().split("T")[0];
            if (newRecord.date === today) {
              setUsed(newRecord.request_count);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading || !user) return null;

  const remaining = Math.max(0, DAILY_LIMIT - used);
  const percentage = (remaining / DAILY_LIMIT) * 100;
  const isLow = remaining < 1000;
  const isCritical = remaining < 200;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 cursor-default">
          <Zap className={`h-4 w-4 shrink-0 ${isCritical ? "text-destructive" : isLow ? "text-yellow-500" : "text-primary"}`} />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-bold tabular-nums ${isCritical ? "text-destructive" : isLow ? "text-yellow-500" : "text-foreground"}`}>
                {remaining.toLocaleString("pt-BR")}
              </span>
              <span className="text-[10px] text-muted-foreground">/ {DAILY_LIMIT.toLocaleString("pt-BR")}</span>
            </div>
            <Progress
              value={percentage}
              className="h-1 w-20"
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Créditos Groq restantes hoje</p>
        <p className="text-xs text-muted-foreground">Resetam à meia-noite UTC</p>
      </TooltipContent>
    </Tooltip>
  );
}
