import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Download, Trash2, Search, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Preview {
  telefone_mascarado: string;
  agendamentos: number;
  mensagens: number;
  hermes_drafts: number;
  intents: number;
  audit_logs: number;
}

export default function LGPD() {
  const [telefone, setTelefone] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const handlePreview = async () => {
    if (!telefone.trim()) {
      toast.error("Informe um telefone");
      return;
    }
    setLoading(true);
    setPreview(null);
    const { data, error } = await supabase.rpc("preview_dados_paciente", { p_telefone: telefone });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPreview(data as unknown as Preview);
  };

  const handleExportar = async () => {
    setActing(true);
    const { data, error } = await supabase.rpc("exportar_dados_paciente", { p_telefone: telefone });
    setActing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lgpd-export-${telefone.replace(/\D/g, "")}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados");
  };

  const handleApagar = async () => {
    setActing(true);
    const { data, error } = await supabase.rpc("apagar_dados_paciente", {
      p_telefone: telefone,
      p_confirmar: true,
    });
    setActing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Dados anonimizados com sucesso");
    console.log("Anonimização:", data);
    setPreview(null);
    setTelefone("");
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">LGPD · Privacidade de Dados</h1>
            <p className="text-sm text-muted-foreground">
              Exportar (portabilidade) ou anonimizar (direito ao esquecimento) dados de um paciente.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar paciente por telefone</CardTitle>
            <CardDescription>
              Informe o número (com ou sem DDI). A busca usa os últimos 8 dígitos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="(91) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePreview()}
              />
              <Button onClick={handlePreview} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            {preview && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="text-sm">
                  Telefone: <span className="font-mono">{preview.telefone_mascarado}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                  <Stat label="Agendamentos" value={preview.agendamentos} />
                  <Stat label="Mensagens" value={preview.mensagens} />
                  <Stat label="Drafts Hermes" value={preview.hermes_drafts} />
                  <Stat label="Intents" value={preview.intents} />
                  <Stat label="Audit Logs" value={preview.audit_logs} />
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button onClick={handleExportar} disabled={acting} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar JSON
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={acting}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Anonimizar / Apagar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Confirmar anonimização?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2">
                            <p>Esta ação é <strong>irreversível</strong>. Serão anonimizados:</p>
                            <ul className="list-disc list-inside text-sm">
                              <li>{preview.agendamentos} agendamento(s)</li>
                              <li>{preview.mensagens} mensagem(ns) WhatsApp</li>
                              <li>{preview.hermes_drafts} draft(s) Hermes</li>
                              <li>{preview.intents} intent(s) de conversa</li>
                            </ul>
                            <p className="text-xs text-muted-foreground pt-2">
                              Recomenda-se exportar antes. A ação será registrada nos logs.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApagar} className="bg-destructive hover:bg-destructive/90">
                          Sim, anonimizar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Política de retenção automática</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• Logs nível <strong>info</strong>: apagados após 30 dias.</p>
            <p>• Logs nível <strong>warn/error/critical</strong>: apagados após 90 dias.</p>
            <p>• Mensagens WhatsApp: apagadas após 180 dias.</p>
            <p>• Cron diário às 03h aplica a política. Limite de 20 ações sensíveis/hora por admin.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border rounded p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
