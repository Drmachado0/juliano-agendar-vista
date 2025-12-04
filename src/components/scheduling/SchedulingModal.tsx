import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import StepIndicator from "./StepIndicator";
import PersonalDataStep from "./PersonalDataStep";
import ConsultationDetailsStep from "./ConsultationDetailsStep";
import DateTimeStep from "./DateTimeStep";
import ConfirmationStep from "./ConfirmationStep";
import SuccessStep from "./SuccessStep";
import { criarAgendamento } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface FormData {
  fullName: string;
  phone: string;
  birthDate: string;
  email: string;
  appointmentType: string;
  location: string;
  insurance: string;
  otherInsurance: string;
  selectedDate: Date | undefined;
  selectedTime: string;
  acceptFirstAvailable: boolean;
  acceptNotifications: boolean;
}

const initialFormData: FormData = {
  fullName: "",
  phone: "",
  birthDate: "",
  email: "",
  appointmentType: "",
  location: "",
  insurance: "",
  otherInsurance: "",
  selectedDate: undefined,
  selectedTime: "",
  acceptFirstAvailable: false,
  acceptNotifications: true,
};

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SchedulingModal = ({ isOpen, onClose }: SchedulingModalProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 4;

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Map location values to display names for proper CRM status detection
      const locationMap: Record<string, string> = {
        clinicor: "Clinicor – Paragominas",
        hgp: "Hospital Geral de Paragominas",
        belem: "Belém (IOB / Vitria)",
      };

      // Map appointment type to proper format
      const appointmentTypeMap: Record<string, string> = {
        consulta: "Consulta",
        retorno: "Retorno",
        exame: "Exame",
        cirurgia: "Cirurgia",
      };

      const agendamentoData = {
        nome_completo: formData.fullName,
        telefone_whatsapp: formData.phone,
        data_nascimento: formData.birthDate || null,
        email: formData.email || null,
        tipo_atendimento: appointmentTypeMap[formData.appointmentType] || formData.appointmentType,
        local_atendimento: locationMap[formData.location] || formData.location,
        convenio: formData.insurance,
        convenio_outro: formData.insurance === "outro" ? formData.otherInsurance : null,
        data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
        hora_agendamento: formData.selectedTime,
        aceita_primeiro_horario: formData.acceptFirstAvailable,
        aceita_contato_whatsapp_email: formData.acceptNotifications,
        // status_crm will be automatically determined by the service based on location
        origem: "site",
      };

      const { data, error } = await criarAgendamento(agendamentoData);
      
      if (error) {
        toast({
          title: "Erro ao agendar",
          description: error.message || "Não foi possível enviar seu agendamento. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Notify n8n about new appointment
      if (data) {
        await notificarN8n('agendamento_criado', data);
      }

      // TODO: Futura integração com Google Calendar/Calendly
      // await criarEventoCalendario(data);

      setIsSubmitted(true);
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
    setIsSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isSubmitted ? "Agendamento enviado!" : "Agendar consulta"}
          </DialogTitle>
        </DialogHeader>

        {!isSubmitted && <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />}

        <div className="mt-6">
          {isSubmitted ? (
            <SuccessStep onClose={handleClose} formData={formData} />
          ) : (
            <>
              {currentStep === 1 && (
                <PersonalDataStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                />
              )}
              {currentStep === 2 && (
                <ConsultationDetailsStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                  onPrev={prevStep}
                />
              )}
              {currentStep === 3 && (
                <DateTimeStep
                  formData={formData}
                  updateFormData={updateFormData}
                  onNext={nextStep}
                  onPrev={prevStep}
                />
              )}
              {currentStep === 4 && (
                <ConfirmationStep
                  formData={formData}
                  onSubmit={handleSubmit}
                  onPrev={prevStep}
                  isSubmitting={isSubmitting}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingModal;
