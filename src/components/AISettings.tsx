import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  PROVIDERS, ProviderId, getAIConfig, saveAIConfig, clearAIConfig, testAIConnection,
} from "@/lib/ai";
import { Sparkles, Eye, EyeOff, ExternalLink, Check, Lock, Loader2 } from "lucide-react";

export function AISettings() {
  const existing = getAIConfig();
  const [provider, setProvider] = useState<ProviderId>(existing?.provider ?? "groq");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(!!existing);

  const p = PROVIDERS[provider];

  // Keep the model valid when the provider changes.
  useEffect(() => {
    if (model && !PROVIDERS[provider].models.includes(model)) setModel("");
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTestAndSave = async () => {
    const key = apiKey.trim();
    if (!key) {
      toast({ title: "Informe a chave", description: "Cole a chave do provedor escolhido.", variant: "destructive" });
      return;
    }
    setTesting(true);
    const cfg = { provider, apiKey: key, model: model || undefined };
    const result = await testAIConnection(cfg);
    setTesting(false);

    if (result.ok) {
      saveAIConfig(cfg);
      setConfigured(true);
      toast({ title: "IA ativada", description: result.message });
    } else {
      toast({ title: "Não foi possível conectar", description: result.message, variant: "destructive" });
    }
  };

  const handleRemove = () => {
    clearAIConfig();
    setApiKey("");
    setConfigured(false);
    toast({ title: "Chave removida deste navegador" });
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Inteligência artificial
          </CardTitle>
          {configured ? (
            <Badge className="bg-bullish/15 text-bullish hover:bg-bullish/15 gap-1.5 shrink-0">
              <Check className="h-3 w-3" /> Ativa
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground shrink-0">Não configurada</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Informe uma chave para ativar análise de documentos, chat, comparações e briefings.
          O <span className="font-medium text-foreground">Groq</span> oferece uma chave gratuita e é a opção recomendada.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
              <SelectTrigger id="ai-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PROVIDERS).map((prov) => (
                  <SelectItem key={prov.id} value={prov.id}>
                    {prov.label}
                    {prov.free ? " — tem plano gratuito" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Modelo</Label>
            <Select value={model || p.models[0]} onValueChange={setModel}>
              <SelectTrigger id="ai-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {p.models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-key">Chave de API</Label>
            <a
              href={p.keysUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Obter chave no {p.label} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              id="ai-key"
              type={show ? "text" : "password"}
              placeholder={p.keyHint}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Ocultar chave" : "Mostrar chave"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          A chave fica salva apenas neste navegador e é enviada somente ao provedor escolhido.
          Ela nunca passa pelos nossos servidores. Remova quando quiser.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleTestAndSave} disabled={testing} className="gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {testing ? "Testando…" : configured ? "Testar e atualizar" : "Testar e ativar"}
          </Button>
          {configured && (
            <Button variant="outline" onClick={handleRemove}>
              Remover chave
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
