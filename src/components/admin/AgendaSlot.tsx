import { cn } from "@/lib/utils";
import { SlotAgenda } from "@/services/agenda";
import { Clock, User, MapPin, CreditCard, Ban, Lock, CheckCircle, XCircle, AlertTriangle, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTipoBloqueioLabel } from "@/services/disponibilidade";
import { Badge } from "@/components/ui/badge";

interface AgendaSlotProps {
  slot: SlotAgenda;
  onClick: () => void;
}

// Mapeamento de status de confirmação para cores e labels
const confirmationStatusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  'nao_enviado': { 
    label: 'Não enviado', 
    icon: MessageSquare, 
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' 
  },
  'aguardando_confirmacao': { 
    label: 'Aguardando', 
    icon: Clock, 
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
  },
  'confirmado': { 
    label: 'Confirmado', 
    icon: CheckCircle, 
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
  },
  'cancelado_pelo_paciente': { 
    label: 'Cancelado', 
    icon: XCircle, 
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
  },
  'falha_envio': { 
    label: 'Falha envio', 
    icon: AlertTriangle, 
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
  },
};

export function AgendaSlot({ slot, onClick }: AgendaSlotProps) {
  const statusStyles = {
    livre: 'bg-green-50 hover:bg-green-100 border-green-200 cursor-pointer dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:border-green-800',
    ocupado: 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:border-blue-800',
    bloqueado: 'bg-red-50 border-red-200 cursor-not-allowed dark:bg-red-900/20 dark:border-red-800',
    passado: 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50 dark:bg-gray-900/20 dark:border-gray-800',
  };

  if (slot.status === 'bloqueado') {
    const motivoExibicao = slot.motivoBloqueio || (slot.bloqueio ? getTipoBloqueioLabel(slot.bloqueio.tipo_bloqueio) : 'Bloqueado');
    const tooltipMotivo = slot.motivoBloqueio || slot.bloqueio?.motivo || 'Horário bloqueado';
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "p-3 rounded-lg border transition-colors flex items-center gap-3",
                statusStyles[slot.status]
              )}
            >
              <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {slot.horaFormatada}
              </div>
              <div className="flex-1 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <Ban className="h-4 w-4" />
                <span>{motivoExibicao}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMotivo}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (slot.status === 'passado') {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border transition-colors flex items-center gap-3",
          statusStyles[slot.status]
        )}
      >
        <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {slot.horaFormatada}
        </div>
        <div className="flex-1 flex items-center gap-2 text-sm text-gray-400">
          <Lock className="h-4 w-4" />
          <span>Horário passado</span>
        </div>
      </div>
    );
  }

  if (slot.status === 'ocupado' && slot.agendamento) {
    const { agendamento } = slot;
    const confirmationStatus = agendamento.confirmation_status || 'nao_enviado';
    const statusConfig = confirmationStatusConfig[confirmationStatus] || confirmationStatusConfig['nao_enviado'];
    const StatusIcon = statusConfig.icon;

    return (
      <div
        onClick={onClick}
        className={cn(
          "p-3 rounded-lg border transition-colors",
          statusStyles[slot.status]
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {slot.horaFormatada}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-sm truncate">{agendamento.nome_completo}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {agendamento.tipo_atendimento}
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                {agendamento.convenio}
              </span>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs flex items-center gap-1 shrink-0", statusConfig.className)}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Status da confirmação WhatsApp</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  // Slot livre
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border transition-colors flex items-center gap-3",
        statusStyles[slot.status]
      )}
    >
      <div className="w-16 text-sm font-medium text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {slot.horaFormatada}
      </div>
      <div className="flex-1 text-sm text-green-600 dark:text-green-400">
        Horário disponível
      </div>
    </div>
  );
}
