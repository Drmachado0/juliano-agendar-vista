import { cn } from "@/lib/utils";
import { SlotAgenda } from "@/services/agenda";
import { Clock, User, MapPin, CreditCard, Ban, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTipoBloqueioLabel } from "@/services/disponibilidade";

interface AgendaSlotProps {
  slot: SlotAgenda;
  onClick: () => void;
}

export function AgendaSlot({ slot, onClick }: AgendaSlotProps) {
  const statusStyles = {
    livre: 'bg-green-50 hover:bg-green-100 border-green-200 cursor-pointer',
    ocupado: 'bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer',
    bloqueado: 'bg-red-50 border-red-200 cursor-not-allowed',
    passado: 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50',
  };

  if (slot.status === 'bloqueado') {
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
              <div className="flex-1 flex items-center gap-2 text-sm text-red-600">
                <Ban className="h-4 w-4" />
                <span>
                  {slot.bloqueio ? getTipoBloqueioLabel(slot.bloqueio.tipo_bloqueio) : 'Bloqueado'}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{slot.bloqueio?.motivo || 'Horário bloqueado'}</p>
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
              <User className="h-4 w-4 text-blue-600" />
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
          {agendamento.confirmacao_enviada && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              ✓ Confirmado
            </span>
          )}
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
      <div className="flex-1 text-sm text-green-600">
        Horário disponível
      </div>
    </div>
  );
}
