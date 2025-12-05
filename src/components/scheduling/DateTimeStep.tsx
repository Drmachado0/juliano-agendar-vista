import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FormData } from "./SchedulingModal";
import { useEffect, useState } from "react";

interface DateTimeStepProps {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement;
        prefill?: Record<string, string>;
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

const DateTimeStep = ({ formData, updateFormData, onNext, onPrev }: DateTimeStepProps) => {
  const [isScheduled, setIsScheduled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduledData, setScheduledData] = useState<{
    eventName?: string;
    eventStartTime?: string;
  } | null>(null);

  useEffect(() => {
    // Load Calendly script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    // Listen for Calendly events
    const handleCalendlyEvent = (e: MessageEvent) => {
      if (e.data.event && e.data.event.indexOf("calendly") === 0) {
        // Widget is ready when we receive any calendly event
        if (e.data.event === "calendly.page_height" || e.data.event === "calendly.event_type_viewed") {
          setIsLoading(false);
        }
        
        if (e.data.event === "calendly.event_scheduled") {
          const payload = e.data.payload;
          setIsScheduled(true);
          setScheduledData({
            eventName: payload?.event?.name,
            eventStartTime: payload?.event?.start_time,
          });
          
          // Parse the scheduled date and time
          if (payload?.event?.start_time) {
            const scheduledDate = new Date(payload.event.start_time);
            updateFormData({
              selectedDate: scheduledDate,
              selectedTime: scheduledDate.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            });
          }
        }
      }
    };

    window.addEventListener("message", handleCalendlyEvent);
    
    // Fallback: hide loading after 5 seconds if no event received
    const fallbackTimer = setTimeout(() => setIsLoading(false), 5000);

    return () => {
      window.removeEventListener("message", handleCalendlyEvent);
      clearTimeout(fallbackTimer);
      // Clean up script if needed
      const existingScript = document.querySelector(
        'script[src="https://assets.calendly.com/assets/external/widget.js"]'
      );
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [updateFormData]);

  const handleNext = () => {
    if (isScheduled || (formData.selectedDate && formData.selectedTime)) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Escolha data e horário</h3>
        <p className="text-sm text-muted-foreground">
          Selecione a data e horário de sua preferência no calendário abaixo.
        </p>
      </div>

      {/* Calendly Widget */}
      <div className="w-full overflow-hidden rounded-xl border border-border relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <div className="grid grid-cols-7 gap-2 mt-6">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          </div>
        )}
        <div
          className="calendly-inline-widget h-[450px] sm:h-[550px] md:h-[600px]"
          data-url="https://calendly.com/julianosmachado/nova-reuniao?hide_event_type_details=1&hide_gdpr_banner=1&background_color=0e1420&text_color=ffffff&primary_color=f0b428"
          style={{ minWidth: "100%" }}
        />
      </div>

      {isScheduled && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-foreground font-medium">
            ✓ Horário selecionado com sucesso!
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
          disabled={!isScheduled && !formData.selectedDate}
        >
          Avançar
        </Button>
      </div>
    </div>
  );
};

export default DateTimeStep;
