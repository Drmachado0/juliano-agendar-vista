import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Heart, Shield, MapPin, Star, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import StepIndicator from "@/components/scheduling/StepIndicator";
import PersonalDataStep from "@/components/scheduling/PersonalDataStep";
import ConsultationDetailsStep from "@/components/scheduling/ConsultationDetailsStep";
import DateTimeStep from "@/components/scheduling/DateTimeStep";
import ConfirmationStep from "@/components/scheduling/ConfirmationStep";
import SuccessStep from "@/components/scheduling/SuccessStep";
import { criarLead, converterLeadEmAgendamento } from "@/services/leads";
import { notificarN8n } from "@/services/integracoes";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import type { FormData } from "@/components/scheduling/SchedulingModal";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const WHATSAPP_NUMBER = "5591936180476";
const WHATSAPP_MESSAGE = "Olá! Gostaria de agendar uma consulta com o Dr. Juliano Machado.";

const getWhatsAppUrl = () => {
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return isMobile
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
    : `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
};

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

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

const pushDL = (data: Record<string, any>) => {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
};

const Agendamento = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { trackViewContent, trackLead, trackSchedule, trackCompleteRegistration, trackContact: trackMetaContact } = useMetaPixel();
  const { trackFormSubmitConversion, trackWhatsAppClick } = useGoogleTag();

  const totalSteps = 4;

  // ViewContent + page_view + UTMs
  useEffect(() => {
    trackViewContent("Landing Agendamento", "Consulta Oftalmológica");
    pushDL({ event: "page_view", page_type: "landing_agendamento", page_path: "/agendamento" });

    try {
      const params = new URLSearchParams(window.location.search);
      const utms: Record<string, string> = {};
      UTM_KEYS.forEach((k) => {
        const v = params.get(k);
        if (v) utms[k] = v;
      });
      if (Object.keys(utms).length > 0) {
        sessionStorage.setItem("lp_agendamento_utms", JSON.stringify(utms));
      }
    } catch (e) {
      console.warn("[Agendamento] UTM capture falhou:", e);
    }
  }, []);

  // Track step view
  useEffect(() => {
    if (!isSubmitted) {
      pushDL({
        event: "lp_step_view",
        page_type: "landing_agendamento",
        step: currentStep,
      });
    }
  }, [currentStep, isSubmitted]);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      if (currentStep === 1) {
        trackLead("Dados Pessoais Preenchidos - Landing");
      }

      // Cria o lead ao avançar da etapa 2 para 3
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

        const { lead_id, error } = await criarLead(leadData);

        if (error) {
          console.error("[Agendamento] Erro ao criar lead:", error);
          toast({
            title: "Erro ao registrar interesse",
            description: "Não foi possível salvar seus dados. O agendamento continuará normalmente.",
            variant: "destructive",
          });
        } else if (lead_id) {
          setLeadId(lead_id);
          pushDL({
            event: "lp_lead_generated",
            page_type: "landing_agendamento",
            lead_id,
            tipo_atendimento: leadData.tipo_atendimento,
          });
        }
      }

      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const localAtendimento = formData.locationName || formData.location;

      if (!leadId) {
        toast({
          title: "Erro",
          description: "Lead não encontrado. Por favor, reinicie o agendamento.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await converterLeadEmAgendamento(
        leadId,
        {
          data_agendamento: formData.selectedDate ? format(formData.selectedDate, "yyyy-MM-dd") : "",
          hora_agendamento: formData.selectedTime,
          aceita_primeiro_horario: formData.acceptFirstAvailable,
          aceita_contato_whatsapp_email: formData.acceptNotifications,
        },
        localAtendimento
      );

      if (error) {
        const isAvailabilityError =
          error.message.includes("disponível") ||
          error.message.includes("bloqueado") ||
          error.message.includes("ocupado");

        toast({
          title: isAvailabilityError ? "Horário indisponível" : "Erro ao agendar",
          description: error.message || "Não foi possível finalizar seu agendamento. Tente novamente.",
          variant: "destructive",
        });

        if (isAvailabilityError) setCurrentStep(3);
        return;
      }

      // n8n
      await notificarN8n("agendamento_criado", {
        id: leadId,
        nome_completo: formData.fullName,
        telefone_whatsapp: formData.phone,
        local_atendimento: localAtendimento,
        data_agendamento: formData.selectedDate ? format(formData.selectedDate, "yyyy-MM-dd") : "",
        hora_agendamento: formData.selectedTime,
      });

      // Notificações com timeout de 8s
      const NOTIFICATION_TIMEOUT_MS = 8000;
      const notificationsPromise = Promise.allSettled([
        supabase.functions.invoke("confirmar-agendamento-whatsapp", {
          body: {
            agendamento_data: {
              nome_completo: formData.fullName,
              telefone_whatsapp: formData.phone,
              tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
              local_atendimento: localAtendimento,
              data_agendamento: formData.selectedDate ? format(formData.selectedDate, "yyyy-MM-dd") : "",
              hora_agendamento: formData.selectedTime,
              convenio: formData.insuranceName || formData.insurance,
            },
          },
        }),
        supabase.functions.invoke("notificar-agendamento-email", {
          body: {
            nome_completo: formData.fullName,
            telefone_whatsapp: formData.phone,
            email_paciente: formData.email || null,
            data_nascimento: formData.birthDate || null,
            tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
            local_atendimento: localAtendimento,
            convenio: formData.insuranceName || formData.insurance,
            convenio_outro: formData.insurance === "outro" ? formData.otherInsurance : null,
            data_agendamento: formData.selectedDate ? format(formData.selectedDate, "yyyy-MM-dd") : "",
            hora_agendamento: formData.selectedTime,
          },
        }),
      ]);
      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), NOTIFICATION_TIMEOUT_MS)
      );
      await Promise.race([notificationsPromise, timeoutPromise]);

      // Tracking
      trackSchedule(formData.appointmentTypeName, formData.locationName);
      trackCompleteRegistration(formData.appointmentTypeName, formData.locationName);
      trackFormSubmitConversion();

      pushDL({
        event: "lp_appointment_scheduled",
        page_type: "landing_agendamento",
        tipo_atendimento: formData.appointmentTypeName,
        local: formData.locationName,
        value: 300,
        currency: "BRL",
      });

      // Google Ads conversion
      if (typeof (window as any).gtag !== "undefined") {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-436492720/3Y-4COmQ1dUbELCzkdAB",
          value: 300,
          currency: "BRL",
        });
      }

      window.location.href = "/obrigado";
    } catch (err) {
      console.error("[Agendamento] Erro inesperado:", err);
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
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Agendar Consulta — Dr. Juliano Machado | Oftalmologista</title>
        <meta
          name="description"
          content="Agende sua consulta online com o Dr. Juliano Machado. Oftalmologista em Paragominas e Belém. Rápido, fácil e sem complicação."
        />
        <meta property="og:url" content="https://drjulianomachado.com/agendamento" />
        <meta property="og:title" content="Agendar Consulta — Dr. Juliano Machado | Oftalmologista" />
        <meta property="og:description" content="Agende sua consulta online com o Dr. Juliano Machado. Oftalmologista em Paragominas e Belém. Rápido, fácil e sem complicação." />
        <link rel="canonical" href="https://drjulianomachado.com/agendamento" />
      </Helmet>

      {/* Header minimal */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg font-bold gradient-text leading-tight">
              Dr. Juliano Machado
            </span>
            <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight">
              Oftalmologista · Paragominas
            </span>
          </div>
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { trackWhatsAppClick(getWhatsAppUrl(), "Header Agendamento"); trackMetaContact("WhatsApp"); }}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:text-[#20BD5A] transition-colors"
            aria-label="Falar no WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* Hero + Form */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-60" aria-hidden />
        <div className="absolute inset-0 noise-overlay" aria-hidden />

        <div className="container mx-auto px-4 py-10 sm:py-14 relative">
          <div className="max-w-xl mx-auto text-center mb-8 animate-fade-in">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold tracking-wide uppercase mb-4">
              Agendamento Online
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold mb-3 leading-tight">
              {isSubmitted ? (
                <>Agendamento <span className="gradient-text">Enviado!</span></>
              ) : (
                <>Agende sua <span className="gradient-text">Consulta</span></>
              )}
            </h1>
            {!isSubmitted && (
              <p className="text-base sm:text-lg text-muted-foreground">
                Oftalmologia em Paragominas e Belém — Dr. Juliano Machado
              </p>
            )}
            <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </span>
                <span className="font-bold text-foreground ml-1">5.0</span>
              </span>
              <span>✓ 13+ anos de experiência</span>
              <span>✓ 6.000+ pacientes atendidos</span>
            </div>
          </div>

          <Card className="max-w-xl mx-auto card-premium border-primary/20 shadow-2xl animate-fade-in">
            <CardContent className="p-6 sm:p-8">
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
            </CardContent>
          </Card>

          {!isSubmitted && (
            <p className="text-center text-xs text-muted-foreground mt-6 max-w-xl mx-auto">
              Ao prosseguir, você concorda em receber contato da nossa equipe via WhatsApp.
            </p>
          )}
        </div>
      </section>

      {/* Trust cards */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[
            {
              icon: Heart,
              title: "Atendimento Humanizado",
              desc: "Cuidado individual e atenção em cada consulta com escuta ativa.",
            },
            {
              icon: Shield,
              title: "Convênios Aceitos",
              desc: "Bradesco, Unimed, Cassi, Sul América e particular.",
            },
            {
              icon: MapPin,
              title: "Paragominas e Belém",
              desc: "Clinicor, Hospital Geral e atendimento também em Belém.",
            },
          ].map((item) => (
            <Card key={item.title} className="card-glass border-primary/20 hover:border-primary/40 transition-all">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="font-serif font-semibold gradient-text">Dr. Juliano Machado</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Phone className="w-4 h-4" />
            <a href={`tel:+${WHATSAPP_NUMBER}`} className="hover:text-primary transition-colors">
              (91) 93618-0476
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            Clinicor · Av. Pres. Vargas, 1234 — Paragominas/PA
          </p>
          <p className="text-xs text-muted-foreground/70 pt-2">
            © {new Date().getFullYear()} Dr. Juliano Machado · Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Agendamento;
