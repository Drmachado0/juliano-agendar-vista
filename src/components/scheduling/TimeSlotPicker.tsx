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

  // Mantém apenas N horários "disponíveis" para o paciente (escolhidos pseudo-aleatoriamente);
  // os demais aparecem como "Ocupado" para criar escassez.
  const MAX_VISIVEIS = 3;

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

  // Mostra os primeiros MAX_VISIVEIS horários em sequência, MAS sempre mantém
  // o horário já selecionado liberado — senão o auto-refresh (30s) podia
  // marcá-lo como "Ocupado" enquanto o resumo ainda o mostrava selecionado.
  const horariosLiberados = useMemo(() => {
    const liberados = new Set<string>();
    slots.slice(0, MAX_VISIVEIS).forEach((s) => liberados.add(s.horario));
    if (selectedTime && slots.some((s) => s.horario === selectedTime)) {
      liberados.add(selectedTime);
    }
    return liberados;
  }, [slots, selectedTime]);

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
    const primeiroLiberado = slots.find((s) => horariosLiberados.has(s.horario));
    if (primeiroLiberado) handleSelect(primeiroLiberado.horario);
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
          {horariosLiberados.size} {horariosLiberados.size === 1 ? "horário disponível" : "horários disponíveis"}
        </p>
      </div>

      {/* Legenda fixa (sticky) — sempre visível ao rolar */}
      <div className="sticky top-0 z-10 -mx-1 px-2 py-2 rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border/60 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded border-2 border-border bg-background" />
            <span className="font-medium text-foreground">Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded border-2 border-amber-500/60 bg-amber-500/20" />
            <span className="font-medium text-amber-600 dark:text-amber-400">Alternativo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded border-2 border-dashed border-border/60 bg-muted/40" />
            <span className="font-medium text-muted-foreground">Lotado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded border-2 border-primary bg-primary" />
            <span className="font-medium text-primary">Selecionado</span>
          </div>
        </div>
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
            p === "todos"
              ? horariosLiberados.size
              : slotsPorPeriodo[p as Exclude<Periodo, "todos">].filter((s) => horariosLiberados.has(s.horario)).length;
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
          const liberadosNoGrupo = grupo.filter((s) => horariosLiberados.has(s.horario)).length;
          const poucos = liberadosNoGrupo > 0 && liberadosNoGrupo <= 2;
          const Icon = p.icon;
          return (
            <div key={p.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{p.label}</span>
                <span className="text-xs text-muted-foreground">({liberadosNoGrupo})</span>
                {poucos && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Últimos
                  </span>
                )}
              </div>
              {/* Mobile: rolagem horizontal com snap e seleção em um toque */}
              <div
                className="sm:hidden -mx-1 px-1 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none [scroll-padding-left:0.25rem]"
                role="listbox"
                aria-label={`Horários da ${p.label}`}
              >
                {grupo.map((slot) => {
                  const isSelected = selectedTime === slot.horario;
                  const liberado = horariosLiberados.has(slot.horario);
                  if (!liberado) {
                    return (
                      <button
                        key={`m-${slot.horario}`}
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={`Horário ${slot.horario} ocupado`}
                        className="snap-start shrink-0 min-w-[88px] h-14 rounded-xl text-xs font-medium border-2 border-dashed border-border/60 bg-muted/40 text-muted-foreground/60 cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <span className="leading-tight line-through decoration-muted-foreground/40">{slot.horario}</span>
                        <span className="text-[9px] font-normal uppercase tracking-wide mt-0.5">Ocupado</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={`m-${slot.horario}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(slot.horario)}
                      className={cn(
                        "snap-start shrink-0 min-w-[88px] h-14 rounded-xl text-base font-semibold border-2 transition-all active:scale-95 touch-manipulation",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30"
                          : poucos
                            ? "bg-amber-500/5 border-amber-500/40 text-foreground"
                            : "bg-background border-border text-foreground"
                      )}
                      aria-label={`Selecionar horário ${slot.horario}`}
                    >
                      {slot.horario}
                    </button>
                  );
                })}
              </div>

              {/* Tablet/Desktop: grid responsivo */}
              <div className="hidden sm:grid grid-cols-3 sm:grid-cols-4 gap-2">
                {grupo.map((slot) => {
                  const isSelected = selectedTime === slot.horario;
                  const liberado = horariosLiberados.has(slot.horario);
                  if (!liberado) {
                    return (
                      <button
                        key={slot.horario}
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={`Horário ${slot.horario} ocupado`}
                        className="h-12 md:h-11 rounded-lg text-xs font-medium border-2 border-dashed border-border/60 bg-muted/40 text-muted-foreground/60 cursor-not-allowed line-through decoration-muted-foreground/40"
                      >
                        <span className="block leading-tight">{slot.horario}</span>
                        <span className="block text-[9px] font-normal uppercase tracking-wide no-underline">Ocupado</span>
                      </button>
                    );
                  }
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

    </div>
  );
};

export default TimeSlotPicker;
