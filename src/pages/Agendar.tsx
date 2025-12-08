import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import StepIndicator from "@/components/scheduling/StepIndicator";
import PersonalDataStep from "@/components/scheduling/PersonalDataStep";
import ConsultationDetailsStep from "@/components/scheduling/ConsultationDetailsStep";
import DateTimeStep from "@/components/scheduling/DateTimeStep";
import ConfirmationStep from "@/components/scheduling/ConfirmationStep";
import SuccessStep from "@/components/scheduling/SuccessStep";
import { criarAgendamento } from "@/services/agendamentos";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import type { FormData } from "@/components/scheduling/SchedulingModal";

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

const Agendar = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { trackViewContent, trackLead, trackSchedule } = useMetaPixel();

  const totalSteps = 4;

  // Track ViewContent when page loads
  useEffect(() => {
    trackViewContent("Agendamento Online", "Consulta Oftalmológica");
  }, []);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const sendToWebhook = async (data: FormData) => {
    const webhookUrl = "https://juliano-n8n.cloudfy.live/webhook/confirmacao";
    
    const payload = {
      dados_pessoais: {
        nome_completo: data.fullName,
        telefone_whatsapp: data.phone,
        data_nascimento: data.birthDate || null,
        email: data.email || null,
      },
      detalhes_consulta: {
        tipo_atendimento: data.appointmentType,
        local_atendimento: data.location,
        convenio: data.insurance,
        convenio_outro: data.insurance === "outro" ? data.otherInsurance : null,
      },
      data_horario: {
        data_agendamento: data.selectedDate ? format(data.selectedDate, 'yyyy-MM-dd') : null,
        hora_agendamento: data.selectedTime,
        aceita_primeiro_horario: data.acceptFirstAvailable,
        aceita_contato_whatsapp_email: data.acceptNotifications,
      },
      metadata: {
        origem: "site",
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Erro ao enviar dados ao webhook:", error);
    }
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      // Track Lead when moving from step 1 to step 2 (personal data filled)
      if (currentStep === 1) {
        trackLead("Dados Pessoais Preenchidos");
      }
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
      const locationMap: Record<string, string> = {
        clinicor: "Clinicor – Paragominas",
        hgp: "Hospital Geral de Paragominas",
        belem: "Belém (IOB / Vitria)",
      };

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

      if (data) {
        await notificarN8n('agendamento_criado', data);
      }

      // Track Schedule conversion event
      trackSchedule(formData.appointmentType, formData.location);

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

  const handleReset = () => {
    setCurrentStep(1);
    setFormData(initialFormData);
    setIsSubmitted(false);
  };

  return (
    <>
      <Helmet>
        <title>Agendar Consulta | Dr. Juliano Machado - Oftalmologista</title>
        <meta 
          name="description" 
          content="Agende sua consulta oftalmológica com Dr. Juliano Machado. Atendimento em Paragominas e Belém. Consultas, exames e cirurgias." 
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link 
              to="/" 
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Voltar ao site</span>
            </Link>
            <div className="text-center">
              <h1 className="text-lg font-serif font-semibold text-foreground">
                Dr. Juliano Machado
              </h1>
              <p className="text-xs text-muted-foreground">Oftalmologista</p>
            </div>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-xl mx-auto">
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">
                {isSubmitted ? "Agendamento Enviado!" : "Agende sua Consulta"}
              </h2>
              {!isSubmitted && (
                <p className="text-muted-foreground">
                  Preencha os dados abaixo para solicitar seu agendamento
                </p>
              )}
            </div>

            {/* Form Card */}
            <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8">
              {!isSubmitted && <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />}

              <div className="mt-6">
                {isSubmitted ? (
                  <SuccessStep onClose={handleReset} formData={formData} />
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
            </div>

            {/* Footer info */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              Ao prosseguir, você concorda em receber contato da nossa equipe via WhatsApp.
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default Agendar;
