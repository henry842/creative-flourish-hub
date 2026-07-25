import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { enableLocalBackend, LOCAL_USER_ID } from "@/lib/localdb";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Fallback identity so the app always opens, even when Supabase anonymous sign-in is
// unavailable (disabled or project asleep). Read-only: RLS blocks writes without a
// real session, but every screen stays navigable.
const GUEST_USER = {
  // Matches LOCAL_USER_ID so rows created locally belong to this identity.
  id: LOCAL_USER_ID,
  aud: "guest",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as unknown as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    // Keep the session in sync (token refresh, sign-out, etc.). Don't flip `loading`
    // here — the bootstrap below owns that so we never render the app before a
    // session exists.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // No login: if the session ever ends, start a fresh anonymous one so the app stays usable.
      if (event === "SIGNED_OUT") {
        supabase.auth.signInAnonymously().catch(() => {});
      }
    });

    // No login screen: if there's no session, transparently create an anonymous one
    // so the app "just works" the moment someone opens it. Every feature still runs
    // against a real user id (RLS + edge functions are unchanged).
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data?.session) {
          console.warn("Login anônimo indisponível — usando o backend local.", error?.message ?? "");
          // Keep the product fully usable: data is served from this browser instead.
          await enableLocalBackend().catch(() => {});
          setGuest(true);
        } else {
          setSession(data.session);
        }
      }
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? (guest ? GUEST_USER : null), loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
