import { Button } from "@/components/ui/button";
import { FormData } from "./SchedulingModal";
import { CheckCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SuccessStepProps {
  onClose: () => void;
  formData: FormData;
}

const SuccessStep = ({ onClose, formData }: SuccessStepProps) => {
  const getLocationLabel = (value: string) => {
    const locations: Record<string, string> = {
      clinicor: "Clinicor – Paragominas",
      hgp: "Hospital Geral de Paragominas",
      belem: "Belém (IOB / Vitria)",
    };
    return locations[value] || value;
  };

  const formattedDate = formData.selectedDate
    ? format(formData.selectedDate, "dd/MM/yyyy", { locale: ptBR })
    : "";

  return (
    <div className="text-center space-y-6 py-4">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse-slow">
          <CheckCircle className="w-12 h-12 text-primary" />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-foreground">
          Pedido de agendamento enviado!
        </h3>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
          Seu pedido de agendamento foi enviado com sucesso. Nossa equipe entrará em 
          contato pelo WhatsApp para confirmar o horário.
        </p>
      </div>

      {/* Appointment Summary */}
      <div className="card-glass rounded-2xl p-6 max-w-sm mx-auto">
        <div className="flex items-center justify-center gap-3 text-foreground">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-semibold">
            {formattedDate} às {formData.selectedTime}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {getLocationLabel(formData.location)}
        </p>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <Button variant="outline" onClick={onClose} className="min-w-32">
          Fechar
        </Button>
      </div>
    </div>
  );
};

export default SuccessStep;
