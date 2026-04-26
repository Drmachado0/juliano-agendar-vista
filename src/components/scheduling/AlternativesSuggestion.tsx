import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  buscarHorariosAlternativos,
  HorarioAlternativo,
} from "@/services/disponibilidadePublica";
import { cn } from "@/lib/utils";

interface AlternativesSuggestionProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  localAtendimento?: string;
  acceptFirstAvailable: boolean;
  highlight?: boolean;
  onSelect: (data: Date, horario: string) => void;
}

const AlternativesSuggestion = ({
  selectedDate,
  selectedTime,
  localAtendimento,
  acceptFirstAvailable,
  highlight = false,
  onSelect,
}: AlternativesSuggestionProps) => {
  const [alternativas, setAlternativas] = useState<HorarioAlternativo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const visivel = Boolean(selectedTime) || acceptFirstAvailable;

  useEffect(() => {
    if (!visivel) {
      setAlternativas([]);
      return;
    }

    const dataRef = selectedDate ?? new Date();
    const horarioRef = selectedTime ?? null;

    let ativo = true;
    setIsLoading(true);

    const timeout = setTimeout(async () => {
      try {
        const alts = await buscarHorariosAlternativos(
          dataRef,
          horarioRef,
          localAtendimento,
          3
        );
        if (ativo) setAlternativas(alts);
      } catch (err) {
        console.error("Erro ao buscar horários alternativos:", err);
        if (ativo) setAlternativas([]);
      } finally {
        if (ativo) setIsLoading(false);
      }
    }, 300);

    return () => {
      ativo = false;
      clearTimeout(timeout);
    };
  }, [selectedDate, selectedTime, localAtendimento, acceptFirstAvailable, visivel]);

  if (!visivel) return null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-all duration-300",
        highlight
          ? "border-primary/60 shadow-md shadow-primary/10 ring-2 ring-primary/30"
          : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Alternativas próximas
        </h4>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Sugerimos opções caso seu horário fique indisponível. Toque para usar.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : alternativas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          Sem alternativas próximas no momento.
        </p>
      ) : (
        <div className="space-y-2">
          {alternativas.map((alt) => (
            <button
              key={`${alt.data.toISOString()}-${alt.horario}`}
              type="button"
              onClick={() => onSelect(alt.data, alt.horario)}
              className={cn(
                "w-full flex items-center justify-between gap-3 p-3 rounded-lg",
                "border border-border bg-background",
                "hover:border-primary/50 hover:bg-primary/5",
                "transition-all duration-200 active:scale-[0.98] text-left"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize truncate">
                    {format(alt.data, "EEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {alt.distanciaLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary flex-shrink-0">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold">{alt.horario}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlternativesSuggestion;
