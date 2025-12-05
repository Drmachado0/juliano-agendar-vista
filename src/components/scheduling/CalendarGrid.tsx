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
import { listarDatasComDisponibilidade, buscarProximoHorarioLivre } from "@/services/disponibilidadePublica";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onProximoHorarioLivre?: (data: Date, horario: string) => void;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CalendarGrid = ({ selectedDate, onSelectDate, onProximoHorarioLivre }: CalendarGridProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [datasDisponiveis, setDatasDisponiveis] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuscandoProximo, setIsBuscandoProximo] = useState(false);

  const hoje = startOfDay(new Date());

  useEffect(() => {
    carregarDisponibilidade();
  }, [currentMonth]);

  const carregarDisponibilidade = async () => {
    setIsLoading(true);
    try {
      const datas = await listarDatasComDisponibilidade(
        currentMonth.getMonth(),
        currentMonth.getFullYear()
      );
      setDatasDisponiveis(datas);
    } catch (error) {
      console.error("Erro ao carregar disponibilidade:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProximoHorarioLivre = async () => {
    setIsBuscandoProximo(true);
    try {
      const resultado = await buscarProximoHorarioLivre(hoje);
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

  const isDataDisponivel = (date: Date) => {
    return datasDisponiveis.some((d) => isSameDay(d, date));
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
        const temDisponibilidade = isDataDisponivel(day);
        const isClicavel = isCurrentMonth && !isPassado && temDisponibilidade;

        days.push(
          <button
            key={day.toString()}
            type="button"
            disabled={!isClicavel}
            onClick={() => isClicavel && onSelectDate(cloneDay)}
            className={cn(
              "h-10 w-10 rounded-full text-sm font-medium transition-all duration-200",
              "flex items-center justify-center",
              !isCurrentMonth && "text-muted-foreground/30",
              isCurrentMonth && !isClicavel && "text-muted-foreground/50 cursor-not-allowed",
              isCurrentMonth && isClicavel && "hover:bg-primary/10 cursor-pointer text-foreground",
              isCurrentMonth && temDisponibilidade && !isSelected && "bg-primary/5 text-primary font-semibold",
              isHoje && !isSelected && "ring-2 ring-primary/30",
              isSelected && "bg-primary text-primary-foreground shadow-lg scale-105"
            )}
          >
            {format(day, "d")}
          </button>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7 gap-1">
          {days}
        </div>
      );
      days = [];
    }

    return rows;
  };

  return (
    <div className="space-y-4">
      {/* Header do calendário */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          disabled={isSameMonth(currentMonth, hoje)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-lg font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button type="button" variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia}
            className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground uppercase"
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-10 w-10 rounded-full" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">{renderDias()}</div>
      )}

      {/* Botão próximo horário livre */}
      <Button
        type="button"
        variant="outline"
        className="w-full mt-4 gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40"
        onClick={handleProximoHorarioLivre}
        disabled={isBuscandoProximo}
      >
        <Zap className="h-4 w-4 text-primary" />
        {isBuscandoProximo ? "Buscando..." : "Próximo horário livre"}
      </Button>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-primary/10 border border-primary/30" />
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span>Selecionado</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
