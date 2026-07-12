import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, RefreshCw, Link2, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

interface SaudeRow {
  mensagens_orfas: number;
  pacientes_aguardando_resposta: number;
  intents_24h: number;
  net_2xx_24h: number;
  net_4xx_24h: number;
  net_5xx_24h: number;
  net_timeouts_24h: number;
  net_ultimo_erro_at: string | null;
  net_ultimo_erro_status: number | null;
  gerado_em: string;
}

interface DryRunResult {
  dry_run: boolean;
  candidatas: number;
  vinculadas: number;
  ambiguas: number;
  sem_match: number;
}

export default function SaudeIntegracoes() {
  const [saude, setSaude] = useState<SaudeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<"dry" | "apply" | null>(null);
  const [lastRun, setLastRun] = useState<DryRunResult | null>(null);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_saude_integracoes")
      .select("*")
      .maybeSingle();
    if (error) {
      toast.error("Falha ao carregar saúde das integrações", { description: error.message });
    } else {
      setSaude(data as SaudeRow);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function executarVinculacao(dryRun: boolean) {
    setRunning(dryRun ? "dry" : "apply");
    const { data, error } = await supabase.rpc("vincular_mensagens_orfas", {
      p_dry_run: dryRun,
    });
    setRunning(null);
    if (error) {
      toast.error("Falha na vinculação", { description: error.message });
      return;
    }
    setLastRun(data as unknown as DryRunResult);
    toast.success(dryRun ? "Simulação concluída" : "Vinculação aplicada");
    if (!dryRun) carregar();
  }

  const cards = [
    {
      label: "Mensagens IN órfãs",
      value: saude?.mensagens_orfas ?? "—",
      hint: "Sem paciente associado",
      danger: (saude?.mensagens_orfas ?? 0) > 0,
      icon: AlertTriangle,
    },
    {
      label: "Pacientes aguardando resposta",
      value: saude?.pacientes_aguardando_resposta ?? "—",
      hint: "Última mensagem IN sem OUT posterior (48h)",
      danger: (saude?.pacientes_aguardando_resposta ?? 0) > 5,
      icon: Activity,
    },
    {
      label: "Intents processadas (24h)",
      value: saude?.intents_24h ?? "—",
      hint: "conversation_intents gravadas",
      danger: (saude?.intents_24h ?? 0) === 0,
      icon: Link2,
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Saúde de integrações</h1>
            <p className="text-sm text-muted-foreground">
              Diagnóstico do fluxo n8n ↔ WhatsApp ↔ CRM. Última verificação:{" "}
              {saude?.gerado_em ? new Date(saude.gerado_em).toLocaleString("pt-BR") : "—"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                <c.icon className={`h-4 w-4 ${c.danger ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${c.danger ? "text-destructive" : ""}`}>{c.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recuperar mensagens órfãs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Analisa até 5.000 mensagens sem paciente associado e as vincula quando encontra
              exatamente um agendamento ativo com o mesmo telefone canônico. Mensagens ambíguas
              (mais de um match) não são vinculadas automaticamente — precisam de revisão manual.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => executarVinculacao(true)}
                disabled={running !== null}
              >
                {running === "dry" ? "Simulando…" : "Simular (dry-run)"}
              </Button>
              <Button
                onClick={() => executarVinculacao(false)}
                disabled={running !== null || (lastRun?.vinculadas ?? 0) === 0}
              >
                {running === "apply" ? "Aplicando…" : "Aplicar vinculação"}
              </Button>
            </div>
            {lastRun && (
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={lastRun.dry_run ? "outline" : "default"}>
                    {lastRun.dry_run ? "Simulação" : "Aplicado"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {lastRun.candidatas} candidatas analisadas
                  </span>
                </div>
                <ul className="grid grid-cols-3 gap-2 text-xs">
                  <li>
                    <span className="text-muted-foreground">Vinculadas:</span>{" "}
                    <strong>{lastRun.vinculadas}</strong>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Ambíguas:</span>{" "}
                    <strong>{lastRun.ambiguas}</strong>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Sem match:</span>{" "}
                    <strong>{lastRun.sem_match}</strong>
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
