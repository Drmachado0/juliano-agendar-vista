import { Agendamento } from "@/services/agendamentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, Phone, MessageCircle, Eye, Bell, Check, Zap, AlertTriangle, CheckCircle2, UserPlus, Timer, Send, XCircle, Loader2, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoasVindasInfo } from "@/hooks/useBoasVindasStatus";

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
  "Clinicor – Paragominas": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Hospital Geral de Paragominas": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "Belém (IOB / Vitria)": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
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

  // Calcula tempo desde criação e tempo na fase atual
  const createdDate = new Date(agendamento.created_at);
  const updatedDate = agendamento.updated_at ? new Date(agendamento.updated_at) : createdDate;
  const diasDesdeCriacao = differenceInDays(new Date(), createdDate);
  const diasNaFase = differenceInDays(new Date(), updatedDate);

  // Cor de urgência baseada em dias parado na fase (não aplicada para ATENDIDO)
  const urgenciaColor = atendido
    ? "border-l-gray-400"
    : diasNaFase > 7
    ? "border-l-red-500"
    : diasNaFase > 2
    ? "border-l-yellow-500"
    : "border-l-emerald-500";

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-2 sm:p-2.5 space-y-1 sm:space-y-1.5 shadow-sm transition-all cursor-grab active:cursor-grabbing border-l-4 text-[11px] sm:text-xs",
        urgenciaColor,
        isDragging && "shadow-lg ring-2 ring-primary/50 opacity-90",
        atendido && "opacity-70",
        agendamento.is_sandbox && "ring-2 ring-orange-400/60 bg-orange-50/40 dark:bg-orange-900/10"
      )}
    >
      {/* Selo TESTE / Sandbox */}
      {agendamento.is_sandbox && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-orange-500 text-white px-2 py-1 rounded w-fit">
              <FlaskConical className="h-3 w-3" />
              <span>Teste / Sandbox</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs max-w-xs">
              {agendamento.sandbox_reason || "Contato marcado como teste — não entra nas métricas reais."}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {/* Data de Contato - sempre visível no topo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-between gap-2 text-xs bg-muted/50 px-2 py-1.5 rounded">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <UserPlus className="h-3 w-3" />
              <span className="font-medium">Contato:</span>
              <span>{format(createdDate, "dd/MM/yy", { locale: ptBR })}</span>
            </div>
            <span className={cn(
              "flex items-center gap-1 font-medium",
              diasDesdeCriacao > 7 ? "text-red-600 dark:text-red-400" :
              diasDesdeCriacao > 2 ? "text-yellow-600 dark:text-yellow-400" :
              "text-emerald-600 dark:text-emerald-400"
            )}>
              <Timer className="h-3 w-3" />
              {diasDesdeCriacao === 0 ? "hoje" : `${diasDesdeCriacao}d`}
            </span>
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

      {/* Boas-vindas status */}
      {boasVindas && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-2 text-xs font-medium px-2 py-1 rounded",
                boasVindas.status === "enviada" &&
                  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
                boasVindas.status === "falhou" &&
                  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                boasVindas.status === "tentativa" &&
                  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              )}
            >
              {boasVindas.status === "enviada" && <Send className="h-3 w-3" />}
              {boasVindas.status === "falhou" && <XCircle className="h-3 w-3" />}
              {boasVindas.status === "tentativa" && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>
                {boasVindas.status === "enviada" && "Boas-vindas enviada"}
                {boasVindas.status === "falhou" && "Boas-vindas falhou"}
                {boasVindas.status === "tentativa" && "Boas-vindas em tentativa"}
              </span>
              <span className="ml-auto opacity-70">
                {format(new Date(boasVindas.data), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1">
              <div><strong>Status:</strong> {boasVindas.status}</div>
              <div>
                <strong>Quando:</strong>{" "}
                {format(new Date(boasVindas.data), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </div>
              <div className="opacity-80">
                {formatDistanceToNow(new Date(boasVindas.data), { locale: ptBR, addSuffix: true })}
              </div>
              {boasVindas.status === "falhou" && boasVindas.motivoErro && (
                <div className="pt-1 mt-1 border-t border-border/50">
                  <strong>Motivo:</strong> {boasVindas.motivoErro}
                </div>
              )}
              {boasVindas.status === "falhou" && !boasVindas.motivoErro && (
                <div className="pt-1 mt-1 border-t border-border/50 opacity-80">
                  Sem detalhe do erro registrado.
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Lead Indicator */}
      {isLead && (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">
          <AlertTriangle className="h-3 w-3" />
          <span>Aguardando agendamento</span>
        </div>
      )}
      
      {/* Atendido Indicator */}
      {atendido && (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs font-medium bg-gray-100 dark:bg-gray-800/50 px-2 py-1 rounded">
          <CheckCircle2 className="h-3 w-3" />
          <span>Atendido</span>
        </div>
      )}
      
      {/* Header - Name */}
      <div className="font-semibold text-foreground truncate">{agendamento.nome_completo}</div>

      {/* Phone */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-3 w-3 flex-shrink-0" />
        <span>{agendamento.telefone_whatsapp}</span>
      </div>

      {/* Date and time - only show if scheduled */}
      {!isLead && agendamento.data_agendamento && agendamento.hora_agendamento && (
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(agendamento.data_agendamento), "dd/MM/yy", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {agendamento.hora_agendamento.slice(0, 5)}
          </span>
        </div>
      )}

      {/* Location badge */}
      <Badge className={cn("text-xs", localBadgeColors[agendamento.local_atendimento] || "bg-gray-100 text-gray-800")}>
        <MapPin className="h-3 w-3 mr-1" />
        {agendamento.local_atendimento.split(" – ")[0]}
      </Badge>

      {/* Type and convenio */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-muted px-2 py-1 rounded">{agendamento.tipo_atendimento}</span>
        <span className="bg-muted px-2 py-1 rounded">
          {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
        </span>
      </div>

      {/* Indicators */}
      <div className="flex items-center gap-2">
        {agendamento.aceita_primeiro_horario && (
          <span className="flex items-center gap-1 text-xs text-emerald-600" title="Aceita primeiro horário">
            <Check className="h-3 w-3" />
          </span>
        )}
        {agendamento.aceita_contato_whatsapp_email && (
          <span className="flex items-center gap-1 text-xs text-blue-600" title="Aceita notificações">
            <Bell className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={(e) => {
              e.stopPropagation();
              onSendWhatsApp(agendamento);
            }}
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            onClick={(e) => {
              e.stopPropagation();
              onTriggerAutomation(agendamento);
            }}
            title="Automação n8n"
          >
            <Zap className="h-4 w-4" />
          </Button>
          {onToggleSandbox && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                agendamento.is_sandbox
                  ? "text-orange-700 hover:text-orange-800 hover:bg-orange-100"
                  : "text-muted-foreground hover:text-orange-600 hover:bg-orange-50"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSandbox(agendamento);
              }}
              title={agendamento.is_sandbox ? "Remover marcação de teste" : "Marcar como teste"}
            >
              <FlaskConical className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(agendamento);
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          Detalhes
        </Button>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default KanbanCard;
