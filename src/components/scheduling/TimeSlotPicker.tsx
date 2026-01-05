import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { gerarHorariosDisponiveis, SlotDisponivel } from "@/services/disponibilidadePublica";

interface TimeSlotPickerProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  localAtendimento?: string;
}

const TimeSlotPicker = ({ selectedDate, selectedTime, onSelectTime, localAtendimento }: TimeSlotPickerProps) => {
  const [slots, setSlots] = useState<SlotDisponivel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      carregarHorarios();
      
      // Refresh automático a cada 30 segundos para evitar conflitos
      const interval = setInterval(() => {
        carregarHorarios();
      }, 30000);
      
      return () => clearInterval(interval);
    } else {
      setSlots([]);
    }
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

  // Seleciona 3 horários aleatórios para exibição
  const displaySlots = useMemo(() => {
    if (slots.length <= 3) return slots;
    
    // Embaralha e pega os 3 primeiros
    const shuffled = [...slots].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    // Ordena por horário para exibição
    return selected.sort((a, b) => a.horario.localeCompare(b.horario));
  }, [slots]);

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
        <div className="text-center">
          <Skeleton className="h-6 w-48 mx-auto mb-4" />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-20 rounded-xl" />
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

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Horários disponíveis para</p>
        <h4 className="text-lg font-semibold text-primary">
          {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </h4>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {displaySlots.map((slot) => (
          <button
            key={slot.horario}
            type="button"
            onClick={() => onSelectTime(slot.horario)}
            className={cn(
              "px-5 py-3 rounded-xl text-base font-medium",
              "transition-all duration-300 ease-out",
              "border-2",
              selectedTime === slot.horario
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-105"
                : [
                    "bg-background border-border/50 text-foreground",
                    "hover:border-primary/50 hover:bg-primary/5",
                    "hover:scale-105 hover:shadow-md",
                    "active:scale-95"
                  ]
            )}
          >
            {slot.horario}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
