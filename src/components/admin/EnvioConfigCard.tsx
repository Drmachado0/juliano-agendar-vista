import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle, ShieldAlert, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useConfiguracoesEnvio,
  useInvalidateConfiguracoesEnvio,
} from "@/hooks/useConfiguracoesEnvio";
import {
  atualizarConfiguracoesEnvio,
  StatusGlobalEnvio,
} from "@/services/configuracoesEnvio";

export default function EnvioConfigCard() {
  const { cfg, isLoading, isError } = useConfiguracoesEnvio();
  const invalidate = useInvalidateConfiguracoesEnvio();

  const [limiteSessao, setLimiteSessao] = useState<number>(40);
  const [limiteDiario, setLimiteDiario] = useState<number>(100);
  const [janelaInicio, setJanelaInicio] = useState<string>("09:00");
  const [janelaFim, setJanelaFim] = useState<string>("18:00");
  const [statusGlobal, setStatusGlobal] = useState<StatusGlobalEnvio>("pausado");
  const [motivoBloqueio, setMotivoBloqueio] = useState<string>("");
  const [blackoutInput, setBlackoutInput] = useState<string>("");
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    setLimiteSessao(cfg.limite_sessao);
    setLimiteDiario(cfg.limite_diario);
    setJanelaInicio((cfg.janela_inicio || "09:00").slice(0, 5));
    setJanelaFim((cfg.janela_fim || "18:00").slice(0, 5));
    setStatusGlobal(cfg.status_global);
    setMotivoBloqueio(cfg.motivo_bloqueio ?? "");
    setBlackoutDates(cfg.blackout_dates ?? []);
  }, [cfg?.updated_at]);

  function adicionarBlackout() {
    if (!blackoutInput) return;
    if (blackoutDates.includes(blackoutInput)) {
      toast.warning("Data já está na lista");
      return;
    }
    setBlackoutDates([...blackoutDates, blackoutInput].sort());
    setBlackoutInput("");
  }

  function removerBlackout(d: string) {
    setBlackoutDates(blackoutDates.filter((x) => x !== d));
  }

  async function handleSalvar() {
    if (limiteSessao <= 0 || limiteDiario <= 0) {
      toast.error("Limites devem ser maiores que zero");
      return;
    }
    if (janelaInicio >= janelaFim) {
      toast.error("Janela início deve ser menor que janela fim");
      return;
    }
    if (statusGlobal === "bloqueado" && !motivoBloqueio.trim()) {
      toast.error("Motivo é obrigatório quando status = bloqueado");
      return;
    }
    setSalvando(true);
    const { success, error } = await atualizarConfiguracoesEnvio({
      limite_sessao: limiteSessao,
      limite_diario: limiteDiario,
      janela_inicio: janelaInicio + ":00",
      janela_fim: janelaFim + ":00",
      status_global: statusGlobal,
      motivo_bloqueio: statusGlobal === "bloqueado" ? motivoBloqueio.trim() : null,
      blackout_dates: blackoutDates,
    });
    setSalvando(false);
    if (success) {
      toast.success("Configurações salvas");
      invalidate();
    } else {
      toast.error(error || "Erro ao salvar");
    }
  }

  const statusBadge =
    statusGlobal === "ativo" ? (
      <Badge className="bg-green-600 hover:bg-green-600">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
      </Badge>
    ) : statusGlobal === "pausado" ? (
      <Badge variant="secondary">
        <AlertTriangle className="h-3 w-3 mr-1" /> Pausado
      </Badge>
    ) : (
      <Badge variant="destructive">
        <ShieldAlert className="h-3 w-3 mr-1" /> Bloqueado
      </Badge>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>Envio de Lembretes Anuais</CardTitle>
            <CardDescription>
              Limites globais, janela horária, blackout dates e status do agente
              externo (lembretes-runner). Aplica-se a envios manuais e automáticos.
            </CardDescription>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração...
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Falha ao carregar a configuração. Por segurança, o sistema assume{" "}
              <strong>pausado</strong> até a leitura voltar a funcionar.
            </AlertDescription>
          </Alert>
        )}

        {statusGlobal === "ativo" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Envios automáticos liberados. Confirme janela e blackout_dates antes
              de sair desta tela.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Limite por sessão</Label>
            <Input
              type="number"
              min={1}
              value={limiteSessao}
              onChange={(e) => setLimiteSessao(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <div className="space-y-2">
            <Label>Limite diário</Label>
            <Input
              type="number"
              min={1}
              value={limiteDiario}
              onChange={(e) => setLimiteDiario(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <div className="space-y-2">
            <Label>Janela início</Label>
            <Input
              type="time"
              value={janelaInicio}
              onChange={(e) => setJanelaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Janela fim</Label>
            <Input
              type="time"
              value={janelaFim}
              onChange={(e) => setJanelaFim(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status global</Label>
          <Select value={statusGlobal} onValueChange={(v) => setStatusGlobal(v as StatusGlobalEnvio)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo — envios liberados</SelectItem>
              <SelectItem value="pausado">Pausado — sem envios</SelectItem>
              <SelectItem value="bloqueado">Bloqueado — exige motivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {statusGlobal === "bloqueado" && (
          <div className="space-y-2">
            <Label>Motivo do bloqueio (obrigatório)</Label>
            <Textarea
              value={motivoBloqueio}
              onChange={(e) => setMotivoBloqueio(e.target.value)}
              placeholder="Ex: Investigação de bloqueio do número WhatsApp"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Blackout dates (datas sem envio)</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={blackoutInput}
              onChange={(e) => setBlackoutInput(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={adicionarBlackout}>
              Adicionar
            </Button>
          </div>
          {blackoutDates.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {blackoutDates.map((d) => (
                <Badge key={d} variant="secondary" className="gap-1">
                  {d}
                  <button
                    type="button"
                    onClick={() => removerBlackout(d)}
                    className="hover:text-destructive"
                    aria-label={`remover ${d}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
