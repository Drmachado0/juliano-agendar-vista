import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings2,
  ChevronUp,
  ChevronDown,
  Clock,
  Coffee,
  Shuffle,
} from "lucide-react";
import { useEnvioLoteConfig } from "@/hooks/useEnvioLoteConfig";

interface Props {
  /** Mostrar a seção de variação automática de mensagens (default: true) */
  showVariacao?: boolean;
  /** Aberto por padrão (default: false) */
  defaultOpen?: boolean;
}

/**
 * Painel reutilizável de Configurações Avançadas de Envio.
 * Usa o hook compartilhado useEnvioLoteConfig (persiste no localStorage),
 * portanto qualquer alteração aqui reflete em todos os módulos de envio em lote.
 */
export default function ConfiguracoesAvancadasEnvio({
  showVariacao = true,
  defaultOpen = false,
}: Props) {
  const [aberto, setAberto] = useState(defaultOpen);
  const {
    intervaloMin,
    setIntervaloMin,
    intervaloMax,
    setIntervaloMax,
    pausarAposEnvios,
    setPausarAposEnvios,
    pausaMinMin,
    setPausaMinMin,
    pausaMaxMin,
    setPausaMaxMin,
    variacaoTextoAtiva,
    setVariacaoTextoAtiva,
    modoEnvioSemRestricao,
    setModoEnvioSemRestricao,
    horarioInicio,
    setHorarioInicio,
    horarioFim,
    setHorarioFim,
  } = useEnvioLoteConfig();

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configurações Avançadas de Envio
          </span>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-6">
        {/* Intervalos */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Intervalos Aleatórios entre Mensagens
          </h4>
          <p className="text-xs text-muted-foreground">
            O sistema sorteia um delay aleatório entre esses valores para simular comportamento humano
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Mínimo (segundos)</Label>
              <Input
                type="number"
                value={intervaloMin}
                onChange={(e) => setIntervaloMin(Number(e.target.value))}
                min={30}
                max={300}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Máximo (segundos)</Label>
              <Input
                type="number"
                value={intervaloMax}
                onChange={(e) =>
                  setIntervaloMax(Math.max(intervaloMin + 1, Math.min(300, Number(e.target.value))))
                }
                min={intervaloMin + 1}
                max={300}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Pausas */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Coffee className="h-4 w-4 text-muted-foreground" />
            Pausas Estratégicas
          </h4>
          <p className="text-xs text-muted-foreground">
            A cada X mensagens, o sistema faz uma pausa maior para evitar detecção
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Pausar após (msgs)</Label>
              <Input
                type="number"
                value={pausarAposEnvios}
                onChange={(e) => setPausarAposEnvios(Number(e.target.value))}
                min={5}
                max={20}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pausa mín. (min)</Label>
              <Input
                type="number"
                value={pausaMinMin}
                onChange={(e) => setPausaMinMin(Number(e.target.value))}
                min={1}
                max={30}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pausa máx. (min)</Label>
              <Input
                type="number"
                value={pausaMaxMin}
                onChange={(e) => setPausaMaxMin(Number(e.target.value))}
                min={1}
                max={30}
              />
            </div>
          </div>
        </div>

        {showVariacao && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Shuffle className="h-4 w-4 text-muted-foreground" />
                    Variação Automática de Mensagens
                    <Badge variant={variacaoTextoAtiva ? "default" : "secondary"} className="text-xs">
                      {variacaoTextoAtiva ? "Ativa" : "Inativa"}
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gera mensagens únicas combinando diferentes saudações, textos e emojis. Nenhuma mensagem
                    será igual à anterior.
                  </p>
                </div>
                <Switch checked={variacaoTextoAtiva} onCheckedChange={setVariacaoTextoAtiva} />
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Restrição de Horário */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Restrição de Horário de Envio
              </h4>
              <p className="text-xs text-muted-foreground">
                {modoEnvioSemRestricao
                  ? "⚡ Modo livre: envios permitidos a qualquer horário (use com cautela)"
                  : `Envios apenas entre ${horarioInicio}h e ${horarioFim}h`}
              </p>
            </div>
            <Switch
              checked={!modoEnvioSemRestricao}
              onCheckedChange={(checked) => setModoEnvioSemRestricao(!checked)}
            />
          </div>

          {!modoEnvioSemRestricao && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Início (hora)</Label>
                <Input
                  type="number"
                  value={horarioInicio}
                  onChange={(e) =>
                    setHorarioInicio(Math.max(0, Math.min(horarioFim - 1, Number(e.target.value))))
                  }
                  min={0}
                  max={horarioFim - 1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim (hora)</Label>
                <Input
                  type="number"
                  value={horarioFim}
                  onChange={(e) =>
                    setHorarioFim(Math.max(horarioInicio + 1, Math.min(24, Number(e.target.value))))
                  }
                  min={horarioInicio + 1}
                  max={24}
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
