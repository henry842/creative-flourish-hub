import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Wordmark } from "@/components/Brand";
import { Mail, Lock, User, ArrowLeft, Check } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`,
        });
        if (error) throw error;
        toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada." });
        setIsForgot(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        // "Salvar meus dados": if the visitor is browsing anonymously, upgrade that same
        // session to a permanent account so the data they created is preserved.
        const { data: { user: current } } = await supabase.auth.getUser();
        if (current?.is_anonymous) {
          const { error } = await supabase.auth.updateUser({
            email,
            password,
            data: { display_name: displayName },
          });
          if (error) throw error;
          toast({ title: "Dados salvos!", description: "Confirme pelo link enviado ao seu email." });
          navigate("/dashboard");
        } else {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: displayName },
              emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            },
          });
          if (error) throw error;
          toast({ title: "Conta criada!", description: "Verifique seu email para confirmar." });
        }
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title = isForgot ? "Recuperar senha" : isLogin ? "Entrar na sua conta" : "Criar sua conta";
  const subtitle = isForgot
    ? "Enviaremos um link para redefinir sua senha."
    : isLogin
    ? "Bom te ver de novo."
    : "Crie uma conta para salvar seus dados entre dispositivos.";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-brand text-brand-foreground p-12 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(var(--brand-foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--brand-foreground))_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="relative text-brand-foreground">
          <Wordmark
            markClassName="h-8 w-8"
            squareClass="fill-brand-foreground"
            tickClass="stroke-brand"
            dotClass="fill-accent"
          />
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight text-balance">
            Um relatório de 50 páginas vira um veredito claro em segundos.
          </p>
          <ul className="mt-8 space-y-3 text-brand-foreground/80">
            {[
              "Health Score de 0 a 100 com cinco subcategorias",
              "Red flags derivadas dos números do documento",
              "Chat, comparação, ranking e briefing diário",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid place-items-center h-5 w-5 rounded-full bg-accent/20 text-accent shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-foreground/50">
          Ferramenta de análise — não constitui recomendação de investimento.
        </p>
      </div>

      {/* form panel */}
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Início
          </button>
          <div className="lg:hidden text-foreground">
            <Wordmark markClassName="h-6 w-6" />
          </div>
        </div>

        <div className="flex-1 grid place-items-center">
          <div className="w-full max-w-sm py-10">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

            <form onSubmit={handleAuth} className="mt-8 space-y-4">
              {!isLogin && !isForgot && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              {!isForgot && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setIsForgot(true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Esqueceu?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Aguarde…" : isForgot ? "Enviar link" : isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-6 text-sm text-muted-foreground">
              {isForgot ? (
                <button
                  type="button"
                  onClick={() => setIsForgot(false)}
                  className="text-foreground font-medium hover:underline"
                >
                  Voltar ao login
                </button>
              ) : (
                <span>
                  {isLogin ? "Ainda não tem conta? " : "Já tem uma conta? "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setIsForgot(false);
                    }}
                    className="text-foreground font-medium hover:underline"
                  >
                    {isLogin ? "Criar conta" : "Entrar"}
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
