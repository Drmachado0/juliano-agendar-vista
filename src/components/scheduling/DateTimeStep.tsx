import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { FormData } from "./SchedulingModal";
import { useEffect, useState, useCallback } from "react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DateTimeStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Mapeamento local -> slug da clínica
const locationToSlug: Record<string, string> = {
  clinicor: "clinicor",
  hgp: "hgp",
  belem: "iob",
};

// Mapeamento local -> texto para banco
const locationToText: Record<string, string> = {
  clinicor: "Clinicor – Paragominas",
  hgp: "Hospital Geral de Paragominas",
  belem: "Belém (IOB / Vitria)",
};

const DateTimeStep = ({ formData, updateFormData, onNext, onPrev }: DateTimeStepProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Carregar slots disponíveis via edge function
  const loadSlots = useCallback(async (date: Date) => {
    if (!formData.location) return;

    setIsLoading(true);
    try {
      const dataStr = format(date, "yyyy-MM-dd");
      const clinicaSlug = locationToSlug[formData.location];
      const localTexto = locationToText[formData.location];

      const { data, error } = await supabase.functions.invoke("verificar-disponibilidade", {
        body: {
          data: dataStr,
          clinicaSlug,
          localAtendimento: localTexto,
        },
      });

      if (error) throw error;

      setAvailableSlots(data?.slots || []);
    } catch (error) {
      console.error("Erro ao carregar slots:", error);
      setAvailableSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [formData.location]);

  // Carregar slots quando data mudar
  useEffect(() => {
    if (formData.selectedDate && formData.location) {
      loadSlots(formData.selectedDate);
      setSelectedTime(null);
    }
  }, [formData.selectedDate, formData.location, loadSlots]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      updateFormData({ selectedDate: date, selectedTime: undefined });
      setSelectedTime(null);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    updateFormData({ selectedTime: time });
  };

  const handleNext = () => {
    if (formData.selectedDate && formData.selectedTime) {
      onNext();
    }
  };

  // Desabilitar datas passadas e domingos
  const disabledDays = (date: Date) => {
    const today = startOfDay(new Date());
    return isBefore(date, today) || date.getDay() === 0;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Escolha data e horário</h3>
        <p className="text-sm text-muted-foreground">
          Selecione a data e horário disponíveis para seu atendimento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Data do atendimento
          </Label>
          <div className="border border-border rounded-xl p-4 bg-secondary/30">
            <Calendar
              mode="single"
              selected={formData.selectedDate}
              onSelect={handleDateSelect}
              disabled={disabledDays}
              locale={ptBR}
              fromDate={new Date()}
              toDate={addDays(new Date(), 90)}
              className="rounded-md"
            />
          </div>
        </div>

        {/* Time Slots */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horários disponíveis
          </Label>

          {!formData.selectedDate ? (
            <div className="border border-border rounded-xl p-8 bg-secondary/30 text-center">
              <p className="text-muted-foreground text-sm">
                Selecione uma data para ver os horários disponíveis
              </p>
            </div>
          ) : isLoading ? (
            <div className="border border-border rounded-xl p-4 bg-secondary/30 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="border border-border rounded-xl p-8 bg-secondary/30 text-center">
              <p className="text-muted-foreground text-sm">
                Nenhum horário disponível para esta data.
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Por favor, selecione outra data.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl p-4 bg-secondary/30 max-h-[320px] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => handleTimeSelect(slot)}
                    className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedTime === slot
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-background border border-border hover:border-primary/50 hover:bg-primary/10 text-foreground"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formData.selectedDate && formData.selectedTime && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm text-foreground">
                <span className="font-medium">Selecionado:</span>{" "}
                {format(formData.selectedDate, "dd 'de' MMMM", { locale: ptBR })} às{" "}
                {formData.selectedTime}
              </p>
            </div>
          )}
        </div>
      </div>

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
          disabled={!formData.selectedDate || !formData.selectedTime}
        >
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default DateTimeStep;
