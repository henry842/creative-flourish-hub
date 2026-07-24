import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { maskEmail } from "@/lib/security";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserCircle, Save, KeyRound, Trash2, Sparkles, BarChart3, Zap, FileText, Bell, AlertTriangle } from "lucide-react";

const PROMPT_EXAMPLES = [
  "Sou investidor focado em FIIs de papel e tijolo",
  "Sou médico e preciso analisar laudos e estudos clínicos",
  "Sou estudante de direito e analiso contratos e legislação",
  "Sou analista financeiro focado em ações brasileiras",
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [groqUsageToday, setGroqUsageToday] = useState(0);
  const [groqUsageMonth, setGroqUsageMonth] = useState(0);
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [totalBriefings, setTotalBriefings] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Profile data
    supabase
      .from("profiles")
      .select("display_name, custom_prompt")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if ((data as any)?.custom_prompt) setCustomPrompt((data as any).custom_prompt);
      });

    // Usage stats
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Groq usage today
    supabase
      .from("groq_usage")
      .select("request_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => setGroqUsageToday(data?.request_count || 0));

    // Groq usage this month
    supabase
      .from("groq_usage")
      .select("request_count")
      .eq("user_id", user.id)
      .gte("date", monthStart.toISOString().split("T")[0])
      .then(({ data }) => {
        const total = (data || []).reduce((sum: number, d: any) => sum + (d.request_count || 0), 0);
        setGroqUsageMonth(total);
      });

    // Total analyses (health_scores count)
    supabase
      .from("health_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setTotalAnalyses(count || 0));

    // Total briefings
    supabase
      .from("daily_briefs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setTotalBriefings(count || 0));
  }, [user]);

  const GROQ_DAILY_LIMIT = 14400;
  const groqPercent = Math.min((groqUsageToday / GROQ_DAILY_LIMIT) * 100, 100);
  const groqWarning = groqPercent >= 80;

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nome atualizado" });
    }
    setSaving(false);
  };

  const handleSavePrompt = async () => {
    if (!user) return;
    setSavingPrompt(true);
    const { error } = await supabase
      .from("profiles")
      .update({ custom_prompt: customPrompt.trim() || null } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Prompt personalizado salvo" });
    }
    setSavingPrompt(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não coincidem", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao deletar conta");
      }
      toast({ title: "Conta deletada. Até logo!" });
      await signOut();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setDeletingAccount(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta</p>
      </div>

      {/* Display name */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5" /> Informações pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ? maskEmail(user.email) : ""} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome..." />
          </div>
          <Button onClick={handleSaveName} disabled={saving || !displayName.trim()} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Custom prompt */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Meu Assistente Personalizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descreva quem você é e como quer que a IA se comporte. Esse contexto será usado em todas as análises e conversas.
          </p>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ex: Sou investidor focado em FIIs de papel e tijolo, busco rendimento mensal acima do CDI..."
            className="min-h-[100px] resize-y"
            maxLength={1000}
          />
          <div className="flex flex-wrap gap-2">
            {PROMPT_EXAMPLES.map((example) => (
              <Badge
                key={example}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setCustomPrompt(example)}
              >
                {example}
              </Badge>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{customPrompt.length}/1000 caracteres</span>
            <Button onClick={handleSavePrompt} disabled={savingPrompt} className="gap-2">
              <Save className="h-4 w-4" /> {savingPrompt ? "Salvando..." : "Salvar prompt"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline" className="gap-2">
            <KeyRound className="h-4 w-4" /> {changingPassword ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      {/* AI Usage Panel */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Uso de IA este mês
          </CardTitle>
          <CardDescription>Monitoramento de consumo dos serviços de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Groq daily usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Groq (hoje)</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {groqUsageToday.toLocaleString()} / {GROQ_DAILY_LIMIT.toLocaleString()}
              </span>
            </div>
            <Progress value={groqPercent} className="h-2" />
            {groqWarning && (
              <div className="flex items-center gap-2 text-xs text-neutral">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Uso acima de 80% do limite diário! Considere reduzir operações.</span>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-display font-bold">{totalAnalyses}</p>
              <p className="text-xs text-muted-foreground">Análises (Groq)</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Bell className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-display font-bold">{totalBriefings}</p>
              <p className="text-xs text-muted-foreground">Briefings gerados</p>
            </div>
          </div>

          {/* Monthly Groq */}
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Groq este mês</span>
              <span className="font-medium">{groqUsageMonth.toLocaleString()} requisições</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Briefings, análises de documentos e chat rodam no Groq. A extração de texto de
            PDFs escaneados usa OCR por visão computacional (Gemini Vision).
          </p>
        </CardContent>
      </Card>

      {/* Delete account */}
      <Card className="glass border-destructive/20">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deletar sua conta removerá permanentemente todos os seus dados, documentos, conversas e análises. Esta ação é irreversível.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" /> Deletar minha conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todos os seus dados serão deletados permanentemente.
                  Digite <span className="font-bold text-destructive">DELETE</span> abaixo para confirmar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Digite "DELETE" para confirmar'
                className="mt-2"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "DELETE" || deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? "Deletando..." : "Deletar permanentemente"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
