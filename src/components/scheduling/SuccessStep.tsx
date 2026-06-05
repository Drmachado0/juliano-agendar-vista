import { Button } from "@/components/ui/button";
import { FormData } from "./SchedulingModal";
import { CheckCircle, Calendar, Sparkles, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Confetti from "./Confetti";

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
    <>
      <Confetti />
      <div className="text-center space-y-6 py-4 overflow-hidden">
        {/* Success Icon with elaborate animation */}
        <div 
          className="flex justify-center animate-scale-in"
          style={{ animationDuration: '0.5s' }}
        >
          <div className="relative">
            {/* Sparkle decorations */}
            <Sparkles 
              className="absolute -top-2 -left-4 w-5 h-5 text-primary/60 animate-pulse" 
              style={{ animationDelay: '0.3s' }}
            />
            <Sparkles 
              className="absolute -top-1 -right-3 w-4 h-4 text-primary/40 animate-pulse" 
              style={{ animationDelay: '0.5s' }}
            />
            <Sparkles 
              className="absolute -bottom-1 -right-4 w-3 h-3 text-primary/50 animate-pulse" 
              style={{ animationDelay: '0.7s' }}
            />
            
            {/* Main icon container */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/20">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Message with staggered animation */}
        <div 
          className="space-y-3 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          <h3 className="text-xl font-bold text-foreground">
            Pedido de agendamento enviado!
          </h3>
          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
            Seu pedido de agendamento foi enviado com sucesso. Nossa equipe entrará em 
            contato pelo WhatsApp para confirmar o horário.
          </p>
        </div>

        {/* Appointment Summary with staggered animation */}
        <div 
          className="animate-fade-in"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="card-glass rounded-2xl p-6 max-w-sm mx-auto border border-primary/10 shadow-lg">
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
        </div>

        {/* WhatsApp confirmation prompt */}
        <div
          className="space-y-3 animate-fade-in"
          style={{ animationDelay: '0.5s' }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Toque abaixo e envie a mensagem para receber a confirmação e lembretes da sua consulta no WhatsApp.
          </p>
          <a
            href="https://wa.me/5591936180476?text=Ol%C3%A1!%20Acabei%20de%20agendar%20minha%20consulta%20no%20site%20e%20quero%20receber%20as%20confirma%C3%A7%C3%B5es%20por%20aqui."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <Button
              variant="whatsapp"
              size="lg"
              className="w-full max-w-sm mx-auto gap-2 transition-transform duration-200 hover:scale-105"
            >
              <MessageCircle className="w-5 h-5" />
              Confirmar pelo WhatsApp
            </Button>
          </a>
        </div>

        {/* Action Button with staggered animation */}
        <div
          className="pt-2 animate-fade-in"
          style={{ animationDelay: '0.7s' }}
        >
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-32 transition-transform duration-200 hover:scale-105"
          >
            Fechar
          </Button>
        </div>
      </div>
    </>
  );
};

export default SuccessStep;
