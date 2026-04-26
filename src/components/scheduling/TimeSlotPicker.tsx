import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertCircle, Sun, Sunset, Moon, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { gerarHorariosDisponiveis, SlotDisponivel } from "@/services/disponibilidadePublica";
import { useIsMobile } from "@/hooks/use-mobile";

interface TimeSlotPickerProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  localAtendimento?: string;
}

type Periodo = "todos" | "manha" | "tarde" | "noite";

const periodoDeHorario = (horario: string): Exclude<Periodo, "todos"> => {
  const hora = parseInt(horario.split(":")[0], 10);
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
};

const periodos: {
  key: Exclude<Periodo, "todos">;
  label: string;
  icon: typeof Sun;
}[] = [
  { key: "manha", label: "Manhã", icon: Sun },
  { key: "tarde", label: "Tarde", icon: Sunset },
  { key: "noite", label: "Noite", icon: Moon },
];

const TimeSlotPicker = ({
  selectedDate,
  selectedTime,
  onSelectTime,
  localAtendimento,
}: TimeSlotPickerProps) => {
  const [slots, setSlots] = useState<SlotDisponivel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>("todos");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (selectedDate) {
      carregarHorarios();
      const interval = setInterval(carregarHorarios, 30000);
      return () => clearInterval(interval);
    } else {
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, localAtendimento]);

  const carregarHorarios = async () => {
    if (!selectedDate) return;
    setIsLoading(true);
    try {
      const horariosDisponiveis = await gerarHorariosDisponiveis(selectedDate, localAtendimento);
      setSlots(horariosDisponiveis);
    } catch (error) {
      console.error("Erro ao carregar horários:", error);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const slotsPorPeriodo = useMemo(() => {
    const agrupado: Record<Exclude<Periodo, "todos">, SlotDisponivel[]> = {
      manha: [],
      tarde: [],
      noite: [],
    };
    slots.forEach((s) => {
      agrupado[periodoDeHorario(s.horario)].push(s);
    });
    return agrupado;
  }, [slots]);

  const handleSelect = (horario: string) => {
    onSelectTime(horario);
    if (isMobile) {
      setTimeout(() => {
        const el = document.getElementById("summary-anchor");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  };

  const handleProximoLivre = () => {
    if (slots.length > 0) handleSelect(slots[0].horario);
  };

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">
          Selecione uma data no calendário para ver os horários disponíveis
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 mx-auto" />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive/50 mb-3" />
        <p className="text-muted-foreground font-medium">
          Não há horários disponíveis para esta data
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Por favor, selecione outra data ou use "Próximo horário livre"
        </p>
      </div>
    );
  }

  const periodosVisiveis = periodos.filter(
    (p) => filtroPeriodo === "todos" || filtroPeriodo === p.key
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Horários disponíveis para</p>
        <h4 className="text-lg font-semibold text-primary">
          {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          {slots.length} {slots.length === 1 ? "horário disponível" : "horários disponíveis"}
        </p>
      </div>

      {/* Quick picks */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          type="button"
          onClick={handleProximoLivre}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-medium whitespace-nowrap hover:bg-primary/20 transition-colors active:scale-95"
        >
          <Zap className="h-3.5 w-3.5" />
          Próximo livre
        </button>
        {(["todos", "manha", "tarde", "noite"] as Periodo[]).map((p) => {
          const labels: Record<Periodo, string> = {
            todos: "Todos",
            manha: "Manhã",
            tarde: "Tarde",
            noite: "Noite",
          };
          const count =
            p === "todos" ? slots.length : slotsPorPeriodo[p as Exclude<Periodo, "todos">].length;
          if (p !== "todos" && count === 0) return null;
          const ativo = filtroPeriodo === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setFiltroPeriodo(p)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all active:scale-95",
                ativo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              )}
            >
              {labels[p]} {p !== "todos" && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Grupos por período */}
      <div className="space-y-4">
        {periodosVisiveis.map((p) => {
          const grupo = slotsPorPeriodo[p.key];
          if (grupo.length === 0) return null;
          const poucos = grupo.length <= 2;
          const Icon = p.icon;
          return (
            <div key={p.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{p.label}</span>
                <span className="text-xs text-muted-foreground">({grupo.length})</span>
                {poucos && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Últimos
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {grupo.map((slot) => {
                  const isSelected = selectedTime === slot.horario;
                  return (
                    <button
                      key={slot.horario}
                      type="button"
                      onClick={() => handleSelect(slot.horario)}
                      className={cn(
                        "h-12 md:h-11 rounded-lg text-sm font-medium border-2 transition-all active:scale-95",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                          : poucos
                            ? "bg-amber-500/5 border-amber-500/40 text-foreground hover:border-amber-500 hover:bg-amber-500/10"
                            : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                      aria-pressed={isSelected}
                      aria-label={`Selecionar horário ${slot.horario}`}
                    >
                      {slot.horario}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-border bg-background" />
          Disponível
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-primary bg-primary" />
          Selecionado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-amber-500/60 bg-amber-500/20" />
          Poucos restantes
        </div>
      </div>
    </div>
  );
};

export default TimeSlotPicker;
