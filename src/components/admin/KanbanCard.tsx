import { useState } from "react";
import { Agendamento } from "@/services/agendamentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, Phone, MessageCircle, Eye, Bell, Check, Zap, AlertTriangle, CheckCircle2, UserPlus, Timer, Send, XCircle, Loader2, FlaskConical, CheckCheck, Eye as EyeIcon, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoasVindasInfo } from "@/hooks/useBoasVindasStatus";
import HistoricoConversaModal from "./HistoricoConversaModal";

interface KanbanCardProps {
  agendamento: Agendamento;
  onViewDetails: (agendamento: Agendamento) => void;
  onSendWhatsApp: (agendamento: Agendamento) => void;
  onTriggerAutomation: (agendamento: Agendamento) => void;
  onToggleSandbox?: (agendamento: Agendamento) => void;
  isDragging?: boolean;
  boasVindas?: BoasVindasInfo;
}

// Verifica se é um lead incompleto (sem data/hora de agendamento)
const isLeadIncompleto = (agendamento: Agendamento) => {
  return (agendamento as any).status_funil === 'lead' || !agendamento.data_agendamento || !agendamento.hora_agendamento;
};

// Verifica se está na coluna ATENDIDO
const isAtendido = (agendamento: Agendamento) => {
  return agendamento.status_crm === 'ATENDIDO';
};

const localBadgeColors: Record<string, string> = {
  "Clinicor – Paragominas": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "Hospital Geral de Paragominas": "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  "Belém (IOB / Vitria)": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

const KanbanCard = ({
  agendamento,
  onViewDetails,
  onSendWhatsApp,
  onTriggerAutomation,
  onToggleSandbox,
  isDragging,
  boasVindas,
}: KanbanCardProps) => {
  const isLead = isLeadIncompleto(agendamento);
  const atendido = isAtendido(agendamento);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  // Calcula tempo desde criação e tempo na fase atual
  const createdDate = new Date(agendamento.created_at);
  const updatedDate = agendamento.updated_at ? new Date(agendamento.updated_at) : createdDate;
  const diasDesdeCriacao = differenceInDays(new Date(), createdDate);
  const diasNaFase = differenceInDays(new Date(), updatedDate);

  // Cor de urgência baseada em dias parado na fase (não aplicada para ATENDIDO)
  const urgenciaColor = atendido
    ? "border-l-muted-foreground/40"
    : diasNaFase > 7
    ? "border-l-red-500"
    : diasNaFase > 2
    ? "border-l-yellow-500"
    : "border-l-emerald-500";

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={cn(
        "relative bg-card border border-border/70 rounded-xl p-3 space-y-2 shadow-sm hover:shadow-md hover:border-border transition-all cursor-grab active:cursor-grabbing border-l-4",
        urgenciaColor,
        isDragging && "shadow-lg ring-2 ring-primary/50 opacity-90",
        atendido && "opacity-75",
        agendamento.is_sandbox && "ring-1 ring-orange-400/50"
      )}
    >
      {/* Selo TESTE / Sandbox - canto superior direito */}
      {agendamento.is_sandbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-orange-500 text-white px-1.5 py-0.5 rounded-md shadow">
              <FlaskConical className="h-2.5 w-2.5" />
              <span>Teste</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs max-w-xs">
              {agendamento.sandbox_reason || "Contato marcado como teste — não entra nas métricas reais."}
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Header - Name + telefone */}
      <div className="space-y-0.5">
        <div className="font-semibold text-sm text-foreground truncate leading-tight">
          {agendamento.nome_completo}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{agendamento.telefone_whatsapp}</span>
        </div>
      </div>

      {/* Bloco data/hora consulta - destacado quando existir */}
      {!isLead && agendamento.data_agendamento && agendamento.hora_agendamento ? (
        <div className="flex items-center gap-3 text-xs bg-primary/5 border border-primary/20 rounded-md px-2 py-1.5">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Calendar className="h-3 w-3 text-primary" />
            {format(new Date(agendamento.data_agendamento + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Clock className="h-3 w-3 text-primary" />
            {agendamento.hora_agendamento.slice(0, 5)}
          </span>
        </div>
      ) : isLead ? (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
          <AlertTriangle className="h-3 w-3" />
          <span>Aguardando agendamento</span>
        </div>
      ) : null}

      {atendido && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
          <CheckCircle2 className="h-3 w-3" />
          <span>Atendido</span>
        </div>
      )}

      {/* Badges: unidade + tipo + convênio */}
      <div className="flex flex-wrap gap-1">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 border",
            localBadgeColors[agendamento.local_atendimento] ||
              "bg-muted text-muted-foreground border-border"
          )}
        >
          <MapPin className="h-2.5 w-2.5 mr-1" />
          {agendamento.local_atendimento.split(" – ")[0]}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 bg-muted/50 text-muted-foreground border-border/60">
          {agendamento.tipo_atendimento}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 bg-muted/50 text-muted-foreground border-border/60">
          {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
        </Badge>
      </div>

      {/* Meta info: contato + indicadores em uma linha */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1">
            <span className="flex items-center gap-1">
              <UserPlus className="h-2.5 w-2.5" />
              {format(createdDate, "dd/MM/yy", { locale: ptBR })}
            </span>
            <span className={cn(
              "flex items-center gap-0.5 font-medium tabular-nums",
              diasDesdeCriacao > 7 ? "text-red-500" :
              diasDesdeCriacao > 2 ? "text-yellow-500" :
              "text-emerald-500"
            )}>
              <Timer className="h-2.5 w-2.5" />
              {diasDesdeCriacao === 0 ? "hoje" : `${diasDesdeCriacao}d`}
            </span>
            <div className="flex items-center gap-1">
              {agendamento.aceita_primeiro_horario && (
                <Check className="h-2.5 w-2.5 text-emerald-500" />
              )}
              {agendamento.aceita_contato_whatsapp_email && (
                <Bell className="h-2.5 w-2.5 text-blue-500" />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>Criado em: {format(createdDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
            <div>Última atualização: {formatDistanceToNow(updatedDate, { locale: ptBR, addSuffix: true })}</div>
            {!atendido && diasNaFase > 2 && (
              <div className="font-medium text-yellow-500">⚠ Parado nesta fase há {diasNaFase} dia(s)</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Boas-vindas status (compacto) */}
      {boasVindas && (() => {
        const s = boasVindas.status;
        const labels: Record<string, string> = {
          enviado: "Enviada",
          entregue: "Entregue",
          lido: "Lida",
          pendente: "Pendente",
          erro: "Erro",
        };
        const colorClass =
          s === "lido"
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
            : s === "entregue"
            ? "text-teal-600 dark:text-teal-400 bg-teal-500/10"
            : s === "enviado"
            ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
            : s === "pendente"
            ? "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
            : "text-red-600 dark:text-red-400 bg-red-500/10";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded w-fit", colorClass)}>
                {s === "lido" && <EyeIcon className="h-2.5 w-2.5" />}
                {s === "entregue" && <CheckCheck className="h-2.5 w-2.5" />}
                {s === "enviado" && <Send className="h-2.5 w-2.5" />}
                {s === "pendente" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {s === "erro" && <XCircle className="h-2.5 w-2.5" />}
                <span>BV · {labels[s]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs space-y-1">
                <div><strong>Status:</strong> {s}{boasVindas.statusRaw && boasVindas.statusRaw.toLowerCase() !== s ? ` (${boasVindas.statusRaw})` : ""}</div>
                <div>
                  <strong>Quando:</strong>{" "}
                  {format(new Date(boasVindas.data), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                </div>
                <div className="opacity-80">
                  {formatDistanceToNow(new Date(boasVindas.data), { locale: ptBR, addSuffix: true })}
                </div>
                {s === "erro" && boasVindas.motivoErro && (
                  <div className="pt-1 mt-1 border-t border-border/50">
                    <strong>Motivo:</strong> {boasVindas.motivoErro}
                  </div>
                )}
                {s === "pendente" && (
                  <div className="pt-1 mt-1 border-t border-border/50 opacity-80">
                    Aguardando confirmação de entrega da Evolution API.
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })()}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-accent text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendWhatsApp(agendamento);
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-accent text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setHistoricoOpen(true);
                }}
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Histórico de conversas</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-accent text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerAutomation(agendamento);
                }}
              >
                <Zap className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disparar automação n8n</TooltipContent>
          </Tooltip>
          {onToggleSandbox && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 hover:bg-accent",
                    agendamento.is_sandbox
                      ? "text-orange-500 hover:text-orange-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSandbox(agendamento);
                  }}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {agendamento.is_sandbox ? "Remover marcação de teste" : "Marcar como teste"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(agendamento);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Detalhes
        </Button>
      </div>
    </div>
    <HistoricoConversaModal
      agendamento={agendamento}
      isOpen={historicoOpen}
      onClose={() => setHistoricoOpen(false)}
    />
    </TooltipProvider>
  );
};

export default KanbanCard;
