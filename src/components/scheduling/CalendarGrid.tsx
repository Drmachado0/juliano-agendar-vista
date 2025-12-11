import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { listarDatasComSlotsDisponiveis, buscarProximoHorarioLivre, DataComSlots } from "@/services/disponibilidadePublica";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onProximoHorarioLivre?: (data: Date, horario: string) => void;
  localAtendimento?: string;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CalendarGrid = ({ selectedDate, onSelectDate, onProximoHorarioLivre, localAtendimento }: CalendarGridProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [datasComSlots, setDatasComSlots] = useState<DataComSlots[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuscandoProximo, setIsBuscandoProximo] = useState(false);

  const hoje = startOfDay(new Date());

  useEffect(() => {
    carregarDisponibilidade();
  }, [currentMonth, localAtendimento]);

  const carregarDisponibilidade = async () => {
    setIsLoading(true);
    try {
      const datas = await listarDatasComSlotsDisponiveis(
        currentMonth.getMonth(),
        currentMonth.getFullYear(),
        localAtendimento
      );
      setDatasComSlots(datas);
    } catch (error) {
      console.error("Erro ao carregar disponibilidade:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProximoHorarioLivre = async () => {
    setIsBuscandoProximo(true);
    try {
      const resultado = await buscarProximoHorarioLivre(hoje, localAtendimento);
      if (resultado && onProximoHorarioLivre) {
        // Navega para o mês correto se necessário
        if (!isSameMonth(resultado.data, currentMonth)) {
          setCurrentMonth(resultado.data);
        }
        onProximoHorarioLivre(resultado.data, resultado.horario);
      }
    } catch (error) {
      console.error("Erro ao buscar próximo horário:", error);
    } finally {
      setIsBuscandoProximo(false);
    }
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const getDataInfo = (date: Date): { disponivel: boolean; slots: number } => {
    const info = datasComSlots.find((d) => isSameDay(d.data, date));
    return info ? { disponivel: true, slots: info.slotsDisponiveis } : { disponivel: false, slots: 0 };
  };

  const renderDias = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isHoje = isSameDay(day, hoje);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isPassado = isBefore(day, hoje);
        const { disponivel: temDisponibilidade } = getDataInfo(day);
        const isClicavel = isCurrentMonth && !isPassado && temDisponibilidade;

        days.push(
          <button
            key={day.toString()}
            type="button"
            disabled={!isClicavel}
            onClick={() => isClicavel && onSelectDate(cloneDay)}
            className={cn(
              "relative h-11 w-11 rounded-xl text-sm font-medium",
              "flex items-center justify-center",
              "transition-all duration-300 ease-out",
              // Dias fora do mês
              !isCurrentMonth && "text-muted-foreground/20",
              // Dias não clicáveis
              isCurrentMonth && !isClicavel && "text-muted-foreground/40 cursor-not-allowed",
              // Dias disponíveis - hover suave
              isCurrentMonth && isClicavel && !isSelected && [
                "cursor-pointer text-primary",
                "bg-primary/5 hover:bg-primary/15",
                "hover:scale-110 hover:shadow-md hover:shadow-primary/10",
                "active:scale-95"
              ],
              // Hoje (não selecionado)
              isHoje && !isSelected && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
              // Selecionado
              isSelected && [
                "bg-primary text-primary-foreground",
                "shadow-lg shadow-primary/30",
                "scale-110",
                "ring-2 ring-primary ring-offset-2 ring-offset-background"
              ]
            )}
          >
            <span className={cn(
              "transition-transform duration-200",
              isClicavel && !isSelected && "group-hover:font-semibold"
            )}>
              {format(day, "d")}
            </span>
            {/* Indicador sutil de disponibilidade */}
            {isCurrentMonth && temDisponibilidade && !isPassado && !isSelected && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary/60" />
            )}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1.5 justify-items-center">
          {days}
        </div>
      );
      days = [];
    }

    return rows;
  };

  return (
    <div className="space-y-5">
      {/* Header do calendário */}
      <div className="flex items-center justify-between px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          disabled={isSameMonth(currentMonth, hoje)}
          className="h-9 w-9 rounded-full hover:bg-primary/10 transition-colors duration-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-lg font-semibold capitalize text-foreground">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          className="h-9 w-9 rounded-full hover:bg-primary/10 transition-colors duration-200"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1.5 justify-items-center">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="h-8 w-11 flex items-center justify-center text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider"
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1.5 justify-items-center">
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-11 w-11 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">{renderDias()}</div>
      )}

      {/* Botão próximo horário livre */}
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full mt-4 gap-2",
          "border-primary/30 bg-primary/5",
          "hover:bg-primary/10 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10",
          "transition-all duration-300 ease-out",
          "active:scale-[0.98]"
        )}
        onClick={handleProximoHorarioLivre}
        disabled={isBuscandoProximo}
      >
        <Zap className={cn(
          "h-4 w-4 text-primary",
          isBuscandoProximo && "animate-pulse"
        )} />
        {isBuscandoProximo ? "Buscando..." : "Próximo horário livre"}
      </Button>
    </div>
  );
};

export default CalendarGrid;
