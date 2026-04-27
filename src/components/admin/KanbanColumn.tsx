import { Agendamento } from "@/services/agendamentos";
import KanbanCard from "./KanbanCard";
import { cn } from "@/lib/utils";
import type { BoasVindasInfo } from "@/hooks/useBoasVindasStatus";

interface KanbanColumnProps {
  title: string;
  status: string;
  agendamentos: Agendamento[];
  color: string;
  onViewDetails: (agendamento: Agendamento) => void;
  onSendWhatsApp: (agendamento: Agendamento) => void;
  onTriggerAutomation: (agendamento: Agendamento) => void;
  onToggleSandbox?: (agendamento: Agendamento) => void;
  onDragStart: (e: React.DragEvent, agendamento: Agendamento) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  isDragOver?: boolean;
  boasVindasMap?: Record<string, BoasVindasInfo>;
}

const KanbanColumn = ({
  title,
  status,
  agendamentos,
  color,
  onViewDetails,
  onSendWhatsApp,
  onTriggerAutomation,
  onToggleSandbox,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  boasVindasMap,
}: KanbanColumnProps) => {
  return (
    <div
      className={cn(
        "w-[200px] sm:w-[260px] shrink-0 bg-muted/30 rounded-xl p-2 sm:p-3 transition-colors",
        isDragOver && "bg-primary/10 ring-2 ring-primary/30"
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0", color)} />
          <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">{title}</h3>
        </div>
        <span className="text-[10px] sm:text-sm text-muted-foreground bg-card px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shrink-0">
          {agendamentos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 sm:space-y-3 min-h-[150px] sm:min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {agendamentos.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
            Nenhum agendamento
          </div>
        ) : (
          agendamentos.map((agendamento) => (
            <div
              key={agendamento.id}
              draggable
              onDragStart={(e) => onDragStart(e, agendamento)}
            >
              <KanbanCard
                agendamento={agendamento}
                onViewDetails={onViewDetails}
                onSendWhatsApp={onSendWhatsApp}
                onTriggerAutomation={onTriggerAutomation}
                onToggleSandbox={onToggleSandbox}
                boasVindas={boasVindasMap?.[agendamento.id]}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
