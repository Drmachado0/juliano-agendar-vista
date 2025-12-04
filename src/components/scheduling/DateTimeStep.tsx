import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { FormData } from "./SchedulingModal";
import { useState } from "react";
import { Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimeStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const DateTimeStep = ({ formData, updateFormData, onNext, onPrev }: DateTimeStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mock available time slots - in production, this would come from Google Calendar/Calendly API
  const availableTimeSlots = [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.selectedDate) {
      newErrors.selectedDate = "Selecione uma data";
    }

    if (!formData.selectedTime) {
      newErrors.selectedTime = "Selecione um horário";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  // Disable past dates and weekends (example)
  const disabledDays = [
    { before: new Date() },
    { dayOfWeek: [0] }, // Sundays
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Escolha data e horário</h3>
        <p className="text-sm text-muted-foreground">
          Selecione a data e horário de sua preferência.
        </p>
      </div>

      <div className="space-y-6">
        {/* Calendar */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Data *
          </Label>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={formData.selectedDate}
              onSelect={(date) => updateFormData({ selectedDate: date })}
              disabled={disabledDays}
              className={cn(
                "rounded-xl border border-border bg-secondary p-3 pointer-events-auto",
                errors.selectedDate && "border-destructive"
              )}
            />
          </div>
          {errors.selectedDate && (
            <p className="text-sm text-destructive text-center">{errors.selectedDate}</p>
          )}
        </div>

        {/* Time Slots */}
        {formData.selectedDate && (
          <div className="space-y-3 animate-fade-in">
            <Label className="text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Horário disponível *
            </Label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {availableTimeSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => updateFormData({ selectedTime: time })}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                    formData.selectedTime === time
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground hover:border-primary/50"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
            {errors.selectedTime && (
              <p className="text-sm text-destructive">{errors.selectedTime}</p>
            )}
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
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrev}>
          Voltar
        </Button>
        <Button variant="hero" onClick={handleNext}>
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default DateTimeStep;
