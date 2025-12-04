import { Agendamento } from "@/services/agendamentos";
import KanbanCard from "./KanbanCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  title: string;
  status: string;
  agendamentos: Agendamento[];
  color: string;
  onViewDetails: (agendamento: Agendamento) => void;
  onSendWhatsApp: (agendamento: Agendamento) => void;
  onTriggerAutomation: (agendamento: Agendamento) => void;
  onDragStart: (e: React.DragEvent, agendamento: Agendamento) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  isDragOver?: boolean;
}

const KanbanColumn = ({
  title,
  status,
  agendamentos,
  color,
  onViewDetails,
  onSendWhatsApp,
  onTriggerAutomation,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: KanbanColumnProps) => {
  return (
    <div
      className={cn(
        "flex-1 min-w-[320px] bg-muted/30 rounded-xl p-4 transition-colors",
        isDragOver && "bg-primary/10 ring-2 ring-primary/30"
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color)} />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <span className="text-sm text-muted-foreground bg-card px-2 py-1 rounded-full">
          {agendamentos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-3 min-h-[200px]">
        {agendamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
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
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
