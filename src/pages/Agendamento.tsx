import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Star,
  ShieldCheck,
  Award,
  Users,
  Clock,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
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
import drJulianoHero from "@/assets/dr-juliano-hero.png";
import type { FormData } from "@/components/scheduling/SchedulingModal";

type Depoimento = {
  nome: string;
  cidade: string;
  data: string;
  texto: string;
};

const DEPOIMENTOS: Depoimento[] = [
  {
    nome: "Maria S.",
    cidade: "Paragominas, PA",
    data: "Mar 2025",
    texto: "Atendimento excelente, médico atencioso e equipe muito profissional. Recomendo demais!",
  },
  {
    nome: "João P.",
    cidade: "Belém, PA",
    data: "Fev 2025",
    texto: "Dr. Juliano explicou tudo com calma. Saí da consulta com todas as dúvidas resolvidas.",
  },
  {
    nome: "Ana L.",
    cidade: "Paragominas, PA",
    data: "Jan 2025",
    texto: "Marquei pelo WhatsApp e fui atendida no horário. Estrutura impecável e muito cuidado.",
  },
  {
    nome: "Carlos M.",
    cidade: "Tomé-Açu, PA",
    data: "Dez 2024",
    texto: "Cirurgia de catarata tranquila e segura. Voltei a enxergar como antes. Gratidão!",
  },
  {
    nome: "Fernanda R.",
    cidade: "Belém, PA",
    data: "Nov 2024",
    texto: "Profissional de altíssimo nível. Atencioso, paciente e extremamente competente.",
  },
  {
    nome: "Roberto A.",
    cidade: "Paragominas, PA",
    data: "Out 2024",
    texto: "Recomendo de olhos fechados. Atendimento humano e diagnóstico preciso.",
  },
];

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

const WHATSAPP_URL =
  "https://wa.me/5591936180476?text=Ol%C3%A1%21+Gostaria+de+agendar+uma+consulta+oftalmol%C3%B3gica+com+o+Dr.+Juliano+Machado.";

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
  const [depoimentoAtivo, setDepoimentoAtivo] = useState(0);
  const {
    trackViewContent,
    trackLead,
    trackSchedule,
    trackCompleteRegistration,
    trackContact: trackMetaContact,
  } = useMetaPixel();
  const {
    trackFormSubmitConversion,
    trackWhatsAppClick,
    trackWhatsAppGoogleAdsConversion,
  } = useGoogleTag();

  const totalSteps = 4;

  // view_scheduling_page + ViewContent + UTMs (também persistidos por getTrackingParams)
  useEffect(() => {
    trackViewContent("Landing Agendamento", "Consulta Oftalmológica");
    pushDL({
      event: "view_scheduling_page",
      page_path: "/agendamento",
      page_type: "landing_agendamento",
    });

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

  // Carrossel auto
  useEffect(() => {
    const interval = setInterval(() => {
      setDepoimentoAtivo((prev) => (prev + 1) % DEPOIMENTOS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateFormData = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleWhatsAppClick = (location: string) => {
    trackWhatsAppClick(WHATSAPP_URL, "Falar com a secretária", `whatsapp_${location}`, location);
    trackWhatsAppGoogleAdsConversion();
    trackMetaContact("WhatsApp");
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
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
          // Lead tracking com event_id = lead_id (dedup com CAPI server-side)
          trackLead("Dados Pessoais Preenchidos - Landing", lead_id);
          pushDL({
            event: "lead_created",
            lead_id,
            event_id: `lead_${lead_id}`,
            content_name: "Agendamento Formulario - Site",
            content_category: "Consulta Oftalmológica",
            value: 300,
            currency: "BRL",
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

      // Tracking (event_id = leadId para dedup com CAPI server-side)
      trackSchedule(formData.appointmentTypeName, formData.locationName, leadId);
      trackCompleteRegistration(formData.appointmentTypeName, formData.locationName, leadId);
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
          send_to: "AW-436492720/tUOICNX06JwcELCzkdAB",
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

  const WhatsAppHighlight = ({ location }: { location: string }) => (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => handleWhatsAppClick(location)}
      className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-card/70 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-15px_hsl(var(--primary)/0.35)]"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/15 to-accent/10">
          <MessageCircle className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <p className="font-serif text-base font-medium leading-snug text-foreground md:text-lg">
            Prefere atendimento humano?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
            Fale diretamente com nossa equipe pelo WhatsApp e agende em minutos.
          </p>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-4">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Resposta em minutos · Seg a Sáb
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.6)] transition-all duration-300 group-hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.7)] md:text-sm">
          Chamar agora
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </a>
  );

  return (
    <>
      <Helmet>
        <title>Agendar Consulta — Dr. Juliano Machado | Oftalmologista</title>
        <meta
          name="description"
          content="Agende sua consulta com Dr. Juliano Machado: oftalmologista 5 estrelas em Paragominas e Belém. Agendamento online ou direto com nossa secretária pelo WhatsApp."
        />
        <meta property="og:url" content="https://drjulianomachado.com/agendamento" />
        <meta property="og:title" content="Agendar Consulta — Dr. Juliano Machado | Oftalmologista" />
        <meta
          property="og:description"
          content="Agende sua consulta com Dr. Juliano Machado: oftalmologista 5 estrelas em Paragominas e Belém. Agendamento online ou direto com nossa secretária pelo WhatsApp."
        />
        <link rel="canonical" href="https://drjulianomachado.com/agendamento" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
            <Link
              to="/"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">Voltar ao site</span>
            </Link>
            <div className="hidden text-center md:block">
              <h1 className="text-base font-serif font-semibold leading-tight text-foreground md:text-lg">
                Dr. Juliano Machado
              </h1>
              <p className="text-[11px] text-muted-foreground md:text-xs">Médico Oftalmologista · CRM-PA 15253</p>
            </div>
            <div />
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 md:py-10">
          {/* Banner de prova social mobile */}
          <div className="mb-5 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground lg:hidden">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <strong className="text-foreground">5.0</strong> · 200+ avaliações
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

          {/* CTA WhatsApp em destaque (mobile, acima do form) */}
          <div className="mb-6 lg:hidden">
            <WhatsAppHighlight location="agendamento_destaque_secretaria_mobile" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(320px,400px)] lg:gap-12">
            {/* COLUNA ESQUERDA: Form */}
            <div>
              <div className="mb-6 text-center lg:text-left">
                <h2 className="mb-2 font-serif text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
                  {isSubmitted ? "Agendamento enviado!" : "Agende sua consulta oftalmológica"}
                </h2>
                {!isSubmitted && (
                  <p className="text-sm text-muted-foreground md:text-base">
                    Preencha os dados abaixo e nossa equipe confirma seu horário pelo WhatsApp —
                    ou, se preferir, fale agora com a nossa secretária.
                  </p>
                )}
              </div>

              {/* Carrossel de depoimentos */}
              {!isSubmitted && (
                <div className="mb-6 overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 via-card to-primary/5 p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                      ))}
                      <span className="ml-1 text-xs font-semibold text-foreground">
                        5.0 · pacientes reais
                      </span>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Depoimentos
                    </span>
                  </div>

                  <div className="relative min-h-[120px]">
                    {DEPOIMENTOS.map((d, idx) => (
                      <div
                        key={d.nome + d.data}
                        className={`absolute inset-0 transition-all duration-500 ${
                          idx === depoimentoAtivo
                            ? "translate-x-0 opacity-100"
                            : "pointer-events-none translate-x-2 opacity-0"
                        }`}
                        aria-hidden={idx !== depoimentoAtivo}
                      >
                        <p className="text-sm italic leading-relaxed text-foreground md:text-base">
                          "{d.texto}"
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <strong className="text-foreground">{d.nome}</strong>
                          <span className="text-muted-foreground">· {d.cidade}</span>
                          <span className="text-muted-foreground">· {d.data}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    {DEPOIMENTOS.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDepoimentoAtivo(idx)}
                        aria-label={`Ver depoimento ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === depoimentoAtivo
                            ? "w-6 bg-accent"
                            : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-6 shadow-lg md:p-8">
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

              <p className="mt-4 text-center text-xs text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-accent" />
                Seus dados estão protegidos. Atendimento humanizado e sigiloso.
              </p>
            </div>

            {/* COLUNA DIREITA: prova social (desktop) */}
            <aside className="sticky top-24 hidden self-start lg:flex lg:flex-col lg:gap-6">
              <WhatsAppHighlight location="agendamento_destaque_secretaria_desktop" />

              <div className="rounded-xl border border-border bg-card p-6 shadow-md">
                <div className="mb-3 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-foreground">5.0/5</span>
                  <span className="text-xs text-muted-foreground">(200+ avaliações)</span>
                </div>

                <img
                  src={drJulianoHero}
                  alt="Dr. Juliano Machado, oftalmologista"
                  className="mb-4 h-48 w-full rounded-lg object-cover"
                  loading="lazy"
                />

                <h3 className="mb-3 font-serif text-lg font-semibold text-foreground">
                  Por que escolher o Dr. Juliano?
                </h3>

                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">13+ anos</strong> de experiência em oftalmologia
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">6.000+ pacientes</strong> atendidos
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      Atendimento em <strong className="text-foreground">Paragominas e Belém</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      Convênios: <strong className="text-foreground">Unimed, Bradesco, Cassi, Sul América</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Resposta em até 1h</strong> em horário comercial
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-primary/10 bg-primary/5 p-5">
                <div className="mb-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm italic leading-relaxed text-foreground">
                  "Atendimento excelente, médico atencioso e equipe muito profissional. Recomendo!"
                </p>
                <p className="mt-2 text-xs text-muted-foreground">— Maria S., paciente</p>
              </div>
            </aside>
          </div>
        </main>

        <footer className="mt-12 border-t border-border/40 py-6">
          <div className="container mx-auto space-y-1 px-4 text-center text-xs text-muted-foreground">
            <p>Dr. Juliano Machado · Médico Oftalmologista · CRM-PA 15253</p>
            <p>Ao prosseguir, você concorda em receber contato via WhatsApp e e-mail.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Agendamento;
