import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CalendarRange, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listarJanelasMes,
  upsertJanela,
  excluirJanela,
  type JanelaAtendimento,
} from "@/services/janelasAtendimento";

interface Props {
  ano: number;
  mes1a12: number; // 1..12
  onChange?: (janelas: JanelaAtendimento[]) => void;
}

interface FormState {
  data_inicio: string;
  data_fim: string;
  data_envio_sugerida: string;
  observacao: string;
}

const empty: FormState = { data_inicio: "", data_fim: "", data_envio_sugerida: "", observacao: "" };

const JanelasAtendimentoCard = ({ ano, mes1a12, onChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState<number | null>(null);
  const [janelas, setJanelas] = useState<JanelaAtendimento[]>([]);
  const [forms, setForms] = useState<Record<number, FormState>>({ 1: { ...empty }, 2: { ...empty } });

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await listarJanelasMes(ano, mes1a12);
      setJanelas(data);
      onChange?.(data);
      const novoForms: Record<number, FormState> = { 1: { ...empty }, 2: { ...empty } };
      for (const j of data) {
        novoForms[j.numero_janela] = {
          data_inicio: j.data_inicio,
          data_fim: j.data_fim,
          data_envio_sugerida: j.data_envio_sugerida,
          observacao: j.observacao || "",
        };
      }
      setForms(novoForms);
    } catch (e: any) {
      toast({ title: "Erro ao carregar janelas", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes1a12]);

  const salvar = async (numero: 1 | 2) => {
    const f = forms[numero];
    if (!f.data_inicio || !f.data_fim || !f.data_envio_sugerida) {
      toast({ title: "Preencha todas as datas", variant: "destructive" });
      return;
    }
    setSalvando(numero);
    try {
      await upsertJanela({
        ano_referencia: ano,
        mes_referencia: mes1a12,
        numero_janela: numero,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim,
        data_envio_sugerida: f.data_envio_sugerida,
        observacao: f.observacao || null,
      });
      toast({ title: `Janela ${numero} salva` });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSalvando(null);
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir esta janela?")) return;
    try {
      await excluirJanela(id);
      toast({ title: "Janela removida" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const semJanelas = !loading && janelas.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          Janelas de atendimento do mês
        </CardTitle>
        <CardDescription>
          Cadastre as 2 janelas reais de atendimento do Dr. Juliano. Os pacientes elegíveis serão divididos entre elas
          (ordem: data do próximo lembrete → criação → nome).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {semJanelas && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma janela cadastrada para este mês. O envio automático fica desativado até cadastrar pelo menos uma.
            </AlertDescription>
          </Alert>
        )}

        {([1, 2] as const).map((num) => {
          const existente = janelas.find((j) => j.numero_janela === num);
          const f = forms[num];
          return (
            <div key={num} className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">#{num}</Badge>
                  <span className="font-medium">Janela {num}</span>
                  {existente && (
                    <Badge variant="secondary" className="text-xs">cadastrada</Badge>
                  )}
                </div>
                {existente && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remover(existente.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={f.data_inicio}
                    onChange={(e) =>
                      setForms((s) => ({ ...s, [num]: { ...s[num], data_inicio: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="date"
                    value={f.data_fim}
                    onChange={(e) =>
                      setForms((s) => ({ ...s, [num]: { ...s[num], data_fim: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de envio sugerida</Label>
                  <Input
                    type="date"
                    value={f.data_envio_sugerida}
                    onChange={(e) =>
                      setForms((s) => ({
                        ...s,
                        [num]: { ...s[num], data_envio_sugerida: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input
                  value={f.observacao}
                  onChange={(e) =>
                    setForms((s) => ({ ...s, [num]: { ...s[num], observacao: e.target.value } }))
                  }
                  placeholder="Ex.: clinicor manhã"
                />
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => salvar(num)} disabled={salvando === num}>
                  {salvando === num ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {existente ? "Atualizar" : "Salvar"} janela {num}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default JanelasAtendimentoCard;
