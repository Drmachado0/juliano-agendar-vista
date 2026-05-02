import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Star, ShieldCheck, Award, Users, Clock, CheckCircle2, MessageCircle } from "lucide-react";
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
import drJulianoHero from "@/assets/dr-juliano-hero.png";
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

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

const pushDataLayer = (data: Record<string, any>) => {
  if (typeof window === "undefined") return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(data);
};

const AgendarConsulta = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { trackViewContent, trackLead, trackSchedule, trackCompleteRegistration } = useMetaPixel();
  const { trackFormSubmitConversion } = useGoogleTag();

  const totalSteps = 4;

  // Capture UTMs on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const utms: Record<string, string> = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) utms[k] = v;
    });
    if (Object.keys(utms).length > 0) {
      sessionStorage.setItem("lp_utms", JSON.stringify(utms));
    }

    trackViewContent("Landing Agendamento", "Consulta Oftalmológica");
    pushDataLayer({
      event: "lp_page_view",
      page_type: "landing_conversao",
      page_path: "/agendar-consulta",
      ...utms,
    });
  }, []);

  // Track step view
  useEffect(() => {
    if (isSubmitted) return;
    pushDataLayer({
      event: "lp_step_view",
      step: currentStep,
      step_name: ["dados_pessoais", "detalhes_consulta", "data_horario", "confirmacao"][currentStep - 1],
    });
  }, [currentStep, isSubmitted]);

  // Track form abandon
  useEffect(() => {
    const handleUnload = () => {
      if (!isSubmitted && currentStep < 4) {
        pushDataLayer({
          event: "lp_form_abandon",
          last_step: currentStep,
        });
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [currentStep, isSubmitted]);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      pushDataLayer({ event: "lp_step_complete", step: currentStep });

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
          toast({
            title: "Erro ao registrar interesse",
            description: "Não foi possível salvar seus dados. O agendamento continuará normalmente.",
            variant: "destructive",
          });
        } else if (lead_id) {
          setLeadId(lead_id);
          trackLead("Dados Pessoais Preenchidos", lead_id);
          pushDataLayer({ event: "lp_lead_generated", lead_id });
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

      await notificarN8n("agendamento_criado", {
        id: leadId,
        nome_completo: formData.fullName,
        telefone_whatsapp: formData.phone,
        local_atendimento: localAtendimento,
        data_agendamento: formData.selectedDate ? format(formData.selectedDate, "yyyy-MM-dd") : "",
        hora_agendamento: formData.selectedTime,
      });

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

      // Conversion tracking
      trackSchedule(formData.appointmentType, formData.location);
      trackCompleteRegistration(formData.appointmentType, formData.location);
      trackFormSubmitConversion();

      pushDataLayer({
        event: "lp_appointment_scheduled",
        appointment_type: formData.appointmentType,
        location: formData.location,
        insurance: formData.insurance,
      });

      if (typeof (window as any).gtag !== "undefined") {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-436492720/tUOICNX06JwcELCzkdAB",
          value: 300,
          currency: "BRL",
        });
      }

      window.location.href = "/obrigado";
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
        <title>Agendar Consulta Oftalmológica | Dr. Juliano Machado</title>
        <meta
          name="description"
          content="Agende sua consulta com Dr. Juliano Machado, oftalmologista com 13+ anos de experiência. Atendimento em Paragominas e Belém. Resposta em até 1h."
        />
        <link rel="canonical" href="https://drjulianomachado.com/agendar-consulta" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Top bar minimal */}
        <header className="border-b border-border/40 bg-background/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-base md:text-lg font-serif font-semibold text-foreground leading-tight">
                Dr. Juliano Machado
              </h1>
              <p className="text-[11px] md:text-xs text-muted-foreground">Médico Oftalmologista · CRM-PA 15253</p>
            </div>
            <a
              href="https://wa.me/5591936180476?text=Ol%C3%A1%21+Gostaria+de+agendar+uma+consulta."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs md:text-sm font-medium text-accent hover:text-accent/80 transition-colors"
              onClick={() => {
                pushDataLayer({
                  event: 'whatsapp_click',
                  button_id: 'whatsapp_agendar_consulta_header',
                  button_location: 'agendar_consulta_header',
                  button_text: 'Falar no WhatsApp',
                  destination_url: 'https://wa.me/5591936180476?text=Ol%C3%A1%21+Gostaria+de+agendar+uma+consulta.',
                  // Compatibilidade com tag legada
                  lp_whatsapp_click: true,
                  location: 'header',
                });
                pushDataLayer({
                  event: 'google_ads_conversion',
                  send_to: 'AW-436492720/-h8XCK3z6JwcELCzkdAB',
                  value: 300,
                  currency: 'BRL',
                });
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Falar no WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 md:py-10">
          {/* Mobile proof banner */}
          <div className="lg:hidden mb-6 flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <strong className="text-foreground">4.9</strong> · 200+ avaliações
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-accent" />
              <strong className="text-foreground">6.000+</strong> pacientes
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-accent" />
              <strong className="text-foreground">13+</strong> anos
            </span>
          </div>

          <div className="grid lg:grid-cols-[1fr_minmax(320px,400px)] gap-8 lg:gap-12 max-w-6xl mx-auto">
            {/* LEFT: Form */}
            <div>
              <div className="mb-6 text-center lg:text-left">
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-foreground mb-2">
                  {isSubmitted ? "Agendamento enviado!" : "Agende sua consulta oftalmológica"}
                </h2>
                {!isSubmitted && (
                  <p className="text-muted-foreground text-sm md:text-base">
                    Preencha os dados abaixo e nossa equipe confirma seu horário pelo WhatsApp.
                  </p>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl shadow-lg p-6 md:p-8">
                {!isSubmitted && <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />}

                <div className="mt-6">
                  {isSubmitted ? (
                    <SuccessStep onClose={handleReset} formData={formData} />
                  ) : (
                    <>
                      {currentStep === 1 && (
                        <PersonalDataStep formData={formData} updateFormData={updateFormData} onNext={nextStep} />
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

              <p className="text-center text-xs text-muted-foreground mt-4">
                <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-accent" />
                Seus dados estão protegidos. Atendimento humanizado e sigiloso.
              </p>
            </div>

            {/* RIGHT: Social proof (desktop) */}
            <aside className="hidden lg:flex flex-col gap-6 sticky top-24 self-start">
              <div className="bg-card border border-border rounded-xl p-6 shadow-md">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-foreground">4.9/5</span>
                  <span className="text-xs text-muted-foreground">(200+ avaliações)</span>
                </div>

                <img
                  src={drJulianoHero}
                  alt="Dr. Juliano Machado, oftalmologista"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                  loading="lazy"
                />

                <h3 className="font-serif text-lg font-semibold text-foreground mb-3">
                  Por que escolher o Dr. Juliano?
                </h3>

                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">13+ anos</strong> de experiência em oftalmologia
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">6.000+ pacientes</strong> atendidos
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      Atendimento em <strong className="text-foreground">Paragominas e Belém</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      Convênios: <strong className="text-foreground">Unimed, Bradesco, Cassi, Sul América</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Resposta em até 1h</strong> em horário comercial
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-foreground italic leading-relaxed">
                  "Atendimento excelente, médico atencioso e equipe muito profissional. Recomendo!"
                </p>
                <p className="text-xs text-muted-foreground mt-2">— Maria S., paciente</p>
              </div>
            </aside>
          </div>
        </main>

        <footer className="border-t border-border/40 mt-12 py-6">
          <div className="container mx-auto px-4 text-center text-xs text-muted-foreground space-y-1">
            <p>Dr. Juliano Machado · Médico Oftalmologista · CRM-PA 15253</p>
            <p>Ao prosseguir, você concorda em receber contato via WhatsApp e e-mail.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default AgendarConsulta;
