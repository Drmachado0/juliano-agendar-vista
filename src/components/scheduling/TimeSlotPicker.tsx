import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {[...Array(10)].map((_, i) => (
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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h4 className="font-medium text-foreground">
          Horários disponíveis para{" "}
          <span className="text-primary font-semibold">
            {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </span>
        </h4>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {slots.map((slot) => (
          <Button
            key={slot.horario}
            type="button"
            variant={selectedTime === slot.horario ? "default" : "outline"}
            className={cn(
              "h-12 text-base font-medium transition-all duration-200",
              selectedTime === slot.horario
                ? "bg-primary text-primary-foreground shadow-lg scale-105"
                : "hover:bg-primary/10 hover:border-primary/40 hover:scale-102"
            )}
            onClick={() => onSelectTime(slot.horario)}
          >
            {slot.horario}
          </Button>
        ))}
      </div>

      {slots.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {slots.length} horário{slots.length !== 1 ? "s" : ""} disponíve{slots.length !== 1 ? "is" : "l"}
        </p>
      )}
    </div>
  );
};

export default TimeSlotPicker;
