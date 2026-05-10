import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Columns3, GripVertical, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { useKanbanColumnsConfig } from "@/hooks/useKanbanColumnsConfig";
import { cn } from "@/lib/utils";

interface Props {
  manager: ReturnType<typeof useKanbanColumnsConfig>;
}

const KanbanColumnsManager = ({ manager }: Props) => {
  const { orderedAllColumns, toggleVisible, move, reset } = manager;
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const visibleCount = orderedAllColumns.filter((c) => c.visible).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9">
          <Columns3 className="h-3.5 w-3.5" />
          <span className="text-xs">Colunas</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {visibleCount}/{orderedAllColumns.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-border/60">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Colunas do Kanban
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1"
            onClick={reset}
            title="Restaurar padrão"
          >
            <RotateCcw className="h-3 w-3" />
            Padrão
          </Button>
        </div>
        <div className="space-y-1">
          {orderedAllColumns.map((c, idx) => (
            <div
              key={c.status}
              draggable
              onDragStart={() => setDragIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, idx);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors",
                dragIndex === idx && "opacity-50"
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
              <span className={cn("w-2 h-2 rounded-full shrink-0", c.def.color)} />
              <span className="text-xs flex-1 truncate">{c.def.title}</span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => move(idx, idx - 1)}
                  disabled={idx === 0}
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => move(idx, idx + 1)}
                  disabled={idx === orderedAllColumns.length - 1}
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Switch
                checked={c.visible}
                onCheckedChange={() => toggleVisible(c.status)}
                className="ml-1"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-2 pt-2 mt-1 border-t border-border/60">
          Arraste para reordenar. Use o switch para ocultar colunas.
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default KanbanColumnsManager;
