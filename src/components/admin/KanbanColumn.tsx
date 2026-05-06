import { Agendamento } from "@/services/agendamentos";
import KanbanCard from "./KanbanCard";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
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
        "w-[220px] sm:w-[280px] shrink-0 bg-muted/20 rounded-2xl border border-border/60 p-3 transition-all",
        isDragOver && "bg-primary/10 ring-2 ring-primary/40 border-primary/30"
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-2 h-2 rounded-full shrink-0", color)} />
          <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground bg-card border border-border/60 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
          {agendamentos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[160px] sm:min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1 kanban-scroll">
        {agendamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-2 text-muted-foreground/70">
            <Inbox className="h-6 w-6 mb-2 opacity-40" />
            <p className="text-xs">Nenhum paciente nesta etapa.</p>
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
