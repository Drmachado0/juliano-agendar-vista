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
import { criarLead, converterLeadEmAgendamento } from "@/services/leads";
import { supabase } from "@/integrations/supabase/client";
import { notificarN8n } from "@/services/integracoes";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import type { FormData } from "@/components/scheduling/SchedulingModal";

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

const Agendar = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { trackViewContent, trackLead, trackSchedule, trackCompleteRegistration } = useMetaPixel();
  const { trackFormSubmitConversion } = useGoogleTag();

  const totalSteps = 4;

  // Track ViewContent when page loads
  useEffect(() => {
    trackViewContent("Agendamento Online", "Consulta Oftalmológica");
  }, []);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const sendToWebhook = async (data: FormData) => {
    // TODO: Reconfigurar quando novo servidor n8n estiver ativo
    // O agendamento já é salvo no Supabase, esta notificação é extra
    console.log("Webhook de confirmação desabilitado (servidor n8n em migração)");
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      // Track Lead when moving from step 1 to step 2 (personal data filled)
      if (currentStep === 1) {
        trackLead("Dados Pessoais Preenchidos");
      }
      
      // Ao avançar da etapa 2 para 3, criar o lead no banco
      if (currentStep === 2 && !leadId) {
        const leadData = {
          nome_completo: formData.fullName,
          telefone_whatsapp: formData.phone,
          data_nascimento: formData.birthDate || null,
          email: formData.email || null,
          tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
          local_atendimento: formData.locationName || formData.location,
          convenio: formData.insuranceName || formData.insurance,
          convenio_outro: formData.insurance === "outro" ? formData.otherInsurance : null,
        };

        console.log('[Agendar] Criando lead com dados:', leadData);
        
        const { lead_id, error } = await criarLead(leadData);
        
        if (error) {
          console.error('[Agendar] Erro ao criar lead:', error);
          toast({
            title: "Erro ao registrar interesse",
            description: "Não foi possível salvar seus dados. O agendamento continuará normalmente.",
            variant: "destructive",
          });
        } else if (lead_id) {
          setLeadId(lead_id);
          console.log('[Agendar] Lead criado com ID:', lead_id);
        }
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
      const localAtendimento = formData.locationName || formData.location;

      if (leadId) {
        // Converter lead existente em agendamento (com validação de disponibilidade)
        const { error } = await converterLeadEmAgendamento(
          leadId,
          {
            data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
            hora_agendamento: formData.selectedTime,
            aceita_primeiro_horario: formData.acceptFirstAvailable,
            aceita_contato_whatsapp_email: formData.acceptNotifications,
          },
          localAtendimento
        );

        if (error) {
          // Check if it's an availability error
          const isAvailabilityError = error.message.includes('disponível') || 
                                       error.message.includes('bloqueado') || 
                                       error.message.includes('ocupado');
          
          toast({
            title: isAvailabilityError ? "Horário indisponível" : "Erro ao agendar",
            description: error.message || "Não foi possível finalizar seu agendamento. Tente novamente.",
            variant: "destructive",
          });
          
          // If availability error, go back to date/time selection
          if (isAvailabilityError) {
            setCurrentStep(3);
          }
          return;
        }

        // Notificar n8n sobre agendamento convertido
        await notificarN8n('agendamento_criado', {
          id: leadId,
          nome_completo: formData.fullName,
          telefone_whatsapp: formData.phone,
          local_atendimento: localAtendimento,
          data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
          hora_agendamento: formData.selectedTime,
        });

        // Aguardar notificacoes (com timeout de 8s para nao travar UX)
        const NOTIFICATION_TIMEOUT_MS = 8000;
        const notificationsPromise = Promise.allSettled([
          supabase.functions.invoke('confirmar-agendamento-whatsapp', {
            body: {
              agendamento_data: {
                nome_completo: formData.fullName,
                telefone_whatsapp: formData.phone,
                tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
                local_atendimento: localAtendimento,
                data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
                hora_agendamento: formData.selectedTime,
                convenio: formData.insuranceName || formData.insurance,
              }
            },
          }),
          supabase.functions.invoke('notificar-agendamento-email', {
            body: {
              nome_completo: formData.fullName,
              telefone_whatsapp: formData.phone,
              email_paciente: formData.email || null,
              data_nascimento: formData.birthDate || null,
              tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
              local_atendimento: localAtendimento,
              convenio: formData.insuranceName || formData.insurance,
              convenio_outro: formData.insurance === 'outro' ? formData.otherInsurance : null,
              data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
              hora_agendamento: formData.selectedTime,
            },
          }),
        ]);

        const timeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), NOTIFICATION_TIMEOUT_MS)
        );

        console.log('[Agendar] Disparando notificacoes WhatsApp + E-mail...');
        const result = await Promise.race([notificationsPromise, timeoutPromise]);

        if (result === 'timeout') {
          console.warn('[Agendar] Notificacoes excederam timeout de', NOTIFICATION_TIMEOUT_MS, 'ms - prosseguindo com redirect');
        } else {
          result.forEach((r, i) => {
            const label = i === 0 ? 'WhatsApp' : 'Email';
            if (r.status === 'rejected') {
              console.error(`[Agendar] Notificacao ${label} falhou:`, r.reason);
            } else {
              console.log(`[Agendar] Notificacao ${label} OK:`, r.value);
            }
          });
        }
      } else {
        // Fallback: criar agendamento diretamente se não houver lead
        toast({
          title: "Erro",
          description: "Lead não encontrado. Por favor, reinicie o agendamento.",
          variant: "destructive",
        });
        return;
      }

      // Track Schedule and CompleteRegistration conversion events
      trackSchedule(formData.appointmentType, formData.location);
      trackCompleteRegistration(formData.appointmentType, formData.location);
      trackFormSubmitConversion();

      // Google Ads Conversion
      if (typeof (window as any).gtag !== 'undefined') {
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-436492720/3Y-4COmQ1dUbELCzkdAB',
          value: 300,
          currency: 'BRL',
        });
      }

      // Redirect to thank-you page
      window.location.href = '/obrigado';
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
    setLeadId(null);
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
