import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
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
import { useGoogleTag } from "@/hooks/useGoogleTag";

export interface FormData {
  fullName: string;
  phone: string;
  birthDate: string;
  email: string;
  appointmentType: string;
  appointmentTypeName: string;
  location: string;
  locationName: string;
  insurance: string;
  insuranceName: string;
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
  appointmentTypeName: "",
  location: "",
  locationName: "",
  insurance: "",
  insuranceName: "",
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
  const { trackScheduleStart, trackScheduleComplete, trackLead, trackFormSubmitConversion } = useGoogleTag();

  const totalSteps = 4;

  // Track schedule start when modal opens
  useEffect(() => {
    if (isOpen && currentStep === 1) {
      trackScheduleStart();
    }
  }, [isOpen]);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // Send data to webhook when step 3 is completed
  const sendToWebhook = async (data: FormData) => {
    // TODO: Reconfigurar quando novo servidor n8n estiver ativo
    // O agendamento já é salvo no Supabase, esta notificação é extra
    console.log("Webhook de confirmação desabilitado (servidor n8n em migração)");
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      // When completing step 3, send data to webhook
      if (currentStep === 3) {
        await sendToWebhook(formData);
      }
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
      const agendamentoData = {
        nome_completo: formData.fullName,
        telefone_whatsapp: formData.phone,
        data_nascimento: formData.birthDate || null,
        email: formData.email || null,
        tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
        local_atendimento: formData.locationName || formData.location,
        convenio: formData.insuranceName || formData.insurance,
        convenio_outro: formData.insurance === "outro" ? formData.otherInsurance : null,
        data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
        hora_agendamento: formData.selectedTime,
        aceita_primeiro_horario: formData.acceptFirstAvailable,
        aceita_contato_whatsapp_email: formData.acceptNotifications,
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

      // Track Google Tag conversion
      trackScheduleComplete(formData.appointmentTypeName, formData.locationName);
      trackLead('agendamento');
      trackFormSubmitConversion();

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
