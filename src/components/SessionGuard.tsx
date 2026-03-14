import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 5 * 60 * 1000; // 5 minute warning before logout

export function SessionGuard() {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetTimers = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(logoutTimer.current);
    setShowWarning(false);

    if (!user) return;

    inactivityTimer.current = setTimeout(() => {
      setShowWarning(true);
      logoutTimer.current = setTimeout(() => {
        signOut();
      }, WARNING_MS);
    }, INACTIVITY_MS);
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => {
      if (!showWarning) resetTimers();
    };

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearTimeout(inactivityTimer.current);
      clearTimeout(logoutTimer.current);
    };
  }, [user, resetTimers, showWarning]);

  if (!user) return null;

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sessão inativa</AlertDialogTitle>
          <AlertDialogDescription>
            Sua sessão expira em 5 minutos por inatividade. Deseja continuar conectado?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={resetTimers}>
            Continuar conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
