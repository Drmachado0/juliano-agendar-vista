import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormData } from "./SchedulingModal";
import CalendarGrid from "./CalendarGrid";
import TimeSlotPicker from "./TimeSlotPicker";

interface DateTimeStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const DateTimeStep = ({ formData, updateFormData, onNext, onPrev }: DateTimeStepProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(formData.selectedDate || null);
  const [selectedTime, setSelectedTime] = useState<string | null>(formData.selectedTime || null);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null); // Reset time when date changes
    updateFormData({ selectedDate: date, selectedTime: undefined });
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    updateFormData({ selectedTime: time });
  };

  const handleProximoHorarioLivre = (data: Date, horario: string) => {
    setSelectedDate(data);
    setSelectedTime(horario);
    updateFormData({ selectedDate: data, selectedTime: horario });
  };

  const handleNext = () => {
    if (selectedDate && selectedTime) {
      onNext();
    }
  };

  const canProceed = selectedDate && selectedTime;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Escolha data e horário</h3>
        <p className="text-sm text-muted-foreground">
          Selecione a data e horário de sua preferência para o atendimento.
        </p>
      </div>

      {/* Calendar and Time Slots */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar Section */}
        <div className="bg-card rounded-xl border border-border p-4">
          <CalendarGrid
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            onProximoHorarioLivre={handleProximoHorarioLivre}
            localAtendimento={formData.location}
          />
        </div>

        {/* Time Slots Section */}
        <div className="bg-card rounded-xl border border-border p-4">
          <TimeSlotPicker
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectTime={handleTimeSelect}
            localAtendimento={formData.location}
          />
        </div>
      </div>

      {/* Selection Summary */}
      {selectedDate && selectedTime && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-foreground font-medium flex items-center gap-2">
            <span className="text-primary">✓</span>
            Horário selecionado: {selectedTime} em{" "}
            {selectedDate.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      )}

      {/* Checkboxes */}
      <div className="space-y-4 pt-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptFirstAvailable"
            checked={formData.acceptFirstAvailable}
            onCheckedChange={(checked) =>
              updateFormData({ acceptFirstAvailable: checked as boolean })
            }
            className="mt-0.5"
          />
          <Label
            htmlFor="acceptFirstAvailable"
            className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
          >
            Aceito o primeiro horário disponível se não houver vaga no horário escolhido
          </Label>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptNotifications"
            checked={formData.acceptNotifications}
            onCheckedChange={(checked) =>
              updateFormData({ acceptNotifications: checked as boolean })
            }
            className="mt-0.5"
          />
          <Label
            htmlFor="acceptNotifications"
            className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
          >
            Aceito receber confirmação e lembretes por WhatsApp/E-mail
          </Label>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button 
          variant="hero" 
          onClick={handleNext}
          disabled={!canProceed}
        >
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default DateTimeStep;
