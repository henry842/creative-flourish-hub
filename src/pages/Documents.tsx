import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Document = Tables<"documents">;

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [ticker, setTicker] = useState("");
  const [docType, setDocType] = useState("other");

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.name.endsWith(".pdf")) {
      toast({ title: "Erro", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      name: file.name,
      file_path: filePath,
      file_size: file.size,
      ticker: ticker || null,
      doc_type: docType,
      status: "pending",
    });

    if (dbError) {
      toast({ title: "Erro", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: "Upload concluído!", description: file.name });
      setTicker("");
      fetchDocs();
    }
    setUploading(false);
  };

  const handleDelete = async (doc: Document) => {
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast({ title: "Documento removido" });
    fetchDocs();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "processed": return <CheckCircle className="h-4 w-4 text-bullish" />;
      case "error": return <AlertCircle className="h-4 w-4 text-bearish" />;
      default: return <Clock className="h-4 w-4 text-neutral animate-pulse-glow" />;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Documentos</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus relatórios financeiros</p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg">Upload de PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Ticker (opcional)</Label>
              <Input placeholder="AAPL, PETR4..." value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10-K">10-K</SelectItem>
                  <SelectItem value="10-Q">10-Q</SelectItem>
                  <SelectItem value="earnings">Earnings Call</SelectItem>
                  <SelectItem value="news">Notícia</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Selecionar PDF"}
                </div>
              </Label>
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)
        ) : documents.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum documento enviado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} className="glass hover:shadow-md transition-shadow">
              <CardContent className="py-4 flex items-center gap-4">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    {doc.ticker && <Badge variant="secondary">{doc.ticker}</Badge>}
                    <Badge variant="outline">{doc.doc_type}</Badge>
                    <span>{formatSize(doc.file_size)}</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {statusIcon(doc.status)}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)} className="hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
