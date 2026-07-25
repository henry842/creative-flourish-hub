import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { aiReady } from "@/lib/ai";
import { Sparkles, X } from "lucide-react";

/**
 * Appears only once the app knows the AI has nowhere to run: no server function and no
 * key in this browser. Silent while either path is viable, so it never becomes noise.
 */
export function AIStatusBanner() {
  const [ready, setReady] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const sync = () => setReady(aiReady());
    sync();
    window.addEventListener("finsight-ai-config", sync);
    return () => window.removeEventListener("finsight-ai-config", sync);
  }, []);

  if (ready || dismissed || pathname === "/profile") return null;

  return (
    <div className="border-b border-neutral/30 bg-neutral/10">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-2.5 flex items-center gap-3 text-sm">
        <Sparkles className="h-4 w-4 text-neutral shrink-0" />
        <p className="flex-1 min-w-0 text-foreground/90">
          Ative a inteligência artificial para analisar documentos, conversar e gerar briefings.
        </p>
        <Button size="sm" onClick={() => navigate("/profile")} className="shrink-0">
          Ativar agora
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Dispensar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
