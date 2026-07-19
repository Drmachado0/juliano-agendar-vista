import { useEffect, useRef, useState } from "react";
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
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import drJulianoHero from "@/assets/dr-juliano-hero.jpg";
import { GOOGLE_REVIEWS } from "@/lib/constants";
import { buildLeadUserData, collectAttribution } from "@/lib/leadUserData";
import type { FormData } from "@/components/scheduling/SchedulingModal";

type Depoimento = {
  nome: string;
  data: string;
  texto: string;
};

// Avaliações reais do Google Business Profile do Dr. Juliano Machado.
// Mantidas em código para o carrossel da landing /agendamento — espelham
// as avaliações exibidas na home. Conformidade com CFM 2.336/2023:
// apenas avaliações verificadas reais, sem depoimentos fictícios.
const DEPOIMENTOS: Depoimento[] = [
  {
    nome: "Jéssica Oliveira da Costa",
    data: "Avaliação verificada · Google",
    texto:
      "Atendimento muito bom, profissional excelente, muito prestativo, atencioso, humano, super indico, fala muita clara.",
  },
  {
    nome: "Gislene Alves da Silva",
    data: "Avaliação verificada · Google",
    texto:
      "Atendimento excelente, médico atencioso e equipe muito profissional. Recomendo demais!",
  },
  {
    nome: "Fernanda Cruz",
    data: "Avaliação verificada · Google",
    texto:
      "Um ótimo atendimento, e dr Juliano um grande profissional. Levei meu filho para fazer o teste do olhinho e o dr. foi muito atencioso, cauteloso e muito cuidadoso no atendimento do meu pequeno.",
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

const WHATSAPP_DEFAULT_MSG =
  "Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.";

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
    trackScheduleComplete,
    trackFormSubmitConversion,
    trackWhatsAppClick,
    trackWhatsAppGoogleAdsConversion,
    trackFormStart,
    trackStepCompleted,
    trackAppointmentError,
    trackAppointmentSuccess,
  } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const WHATSAPP_URL = waLink(WHATSAPP_DEFAULT_MSG, "agendamento_secretaria");
  const formStartFiredRef = useRef(false);
  const successFiredRef = useRef(false);
  const viewFiredRef = useRef(false);
  const stepsCompletedRef = useRef<Set<number>>(new Set());



  const totalSteps = 4;

  // view_scheduling_page + ViewContent + UTMs. Guard evita disparo duplo em
  // StrictMode/re-render — booking_view = 1 por montagem/visita à rota.
  useEffect(() => {
    if (viewFiredRef.current) return;
    viewFiredRef.current = true;

    trackViewContent("Landing Agendamento", "Consulta Oftalmológica");
    // Evento legado — mantido pra compatibilidade com tags GTM já publicadas.
    pushDL({
      event: "view_scheduling_page",
      page_path: "/agendamento",
      page_type: "landing_agendamento",
    });
    // Evento novo padronizado do funil.
    pushDL({ event: "booking_view", page_type: "landing_agendamento" });

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
    if (!formStartFiredRef.current) {
      formStartFiredRef.current = true;
      trackFormStart("landing_agendamento");
      pushDL({ event: "booking_start", page_type: "landing_agendamento" });
    }
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleWhatsAppClick = (location: string) => {
    trackWhatsAppClick(WHATSAPP_URL, "Falar com a secretária", `whatsapp_${location}`, location);
    trackWhatsAppGoogleAdsConversion();
    trackMetaContact("WhatsApp");
  };

  const STEP_NAMES: Record<number, string> = {
    1: "personal_data",
    2: "consultation_details",
    3: "date_time",
    4: "confirmation",
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      trackStepCompleted(currentStep, "landing_agendamento");
      // Dedup: 1 booking_step_completed por etapa por tentativa, mesmo que o
      // usuário volte e avance novamente. Sem PII no payload.
      if (!stepsCompletedRef.current.has(currentStep)) {
        stepsCompletedRef.current.add(currentStep);
        pushDL({
          event: "booking_step_completed",
          page_type: "landing_agendamento",
          step: currentStep,
          step_name: STEP_NAMES[currentStep] ?? `step_${currentStep}`,
        });
      }
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

        trackAppointmentError(
          "landing_agendamento",
          isAvailabilityError ? "availability" : "other",
          error.message,
        );

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
      trackScheduleComplete(formData.appointmentTypeName, formData.locationName);
      trackSchedule(formData.appointmentTypeName, formData.locationName, leadId);
      trackCompleteRegistration(formData.appointmentTypeName, formData.locationName, leadId);
      trackFormSubmitConversion();

      // Evento de sucesso real do agendamento (GA4 + Google Ads conversion).
      // Guard impede dupla contagem em re-submits / re-renders.
      if (!successFiredRef.current) {
        successFiredRef.current = true;
        trackAppointmentSuccess('landing_agendamento', {
          id: leadId ?? null,
          appointmentType: formData.appointmentTypeName,
          location: formData.locationName,
        });
        pushDL({
          event: "booking_submit",
          page_type: "landing_agendamento",
          appointment_id: leadId ?? null,
          appointment_type: formData.appointmentTypeName,
          location: formData.locationName,
          value: 300,
          currency: "BRL",
        });
      }

      // Enhanced Conversions (Google Ads) + Advanced Matching (Meta) via GTM.
      // Todos os PII são normalizados e ficam APENAS no dataLayer/GTM — nada
      // é enviado para outro lugar além do fluxo n8n já existente.
      pushDL({
        event: "lead_form_submit",
        page_type: "landing_agendamento",
        lead_id: leadId ?? null,
        user_data: buildLeadUserData({
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
        }),
        ...collectAttribution(),
      });

      pushDL({
        event: "lp_appointment_scheduled",
        page_type: "landing_agendamento",
        tipo_atendimento: formData.appointmentTypeName,
        local: formData.locationName,
        value: 300,
        currency: "BRL",
      });


      // Renderiza SuccessStep inline (sem hard navigation) — preserva fbq async
      // pra terminar de enviar Lead/Schedule/CompleteRegistration ao Meta
      setIsSubmitted(true);
    } catch (err) {
      console.error("[Agendamento] Erro inesperado:", err);
      trackAppointmentError(
        "landing_agendamento",
        "unexpected",
        err instanceof Error ? err.message : "unknown",
      );
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
      className="group relative block overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/70 to-card/90 p-7 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_30px_70px_-20px_hsl(var(--primary)/0.45)]"
    >
      {/* Glow ornaments */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl transition-all duration-700 group-hover:scale-110 group-hover:opacity-90" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative flex items-start gap-5">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.3)]">
          <MessageCircle className="h-6 w-6 text-primary" strokeWidth={1.75} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        </div>
        <div className="flex-1">
          <p className="font-serif text-lg font-medium leading-snug text-foreground md:text-xl">
            Prefere atendimento humano?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Fale diretamente com nossa equipe pelo WhatsApp e agende com tranquilidade.
          </p>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-5">
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
          Disponível 24 horas
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary/85 px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.7)] transition-all duration-300 group-hover:shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.85)]">
          Chamar agora
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </a>
  );

  // JSON-LD — @type Physician (mesmos dados da Home) + MedicalWebPage
  // apontando que /agendamento é a página oficial de agendamento online.
  const physicianJsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: "Dr. Juliano Machado",
    description:
      "Oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém.",
    medicalSpecialty: "Ophthalmology",
    url: "https://drjulianomachado.com",
    image: "https://drjulianomachado.com/og-image.jpg",
    telephone: "+5591936180476",
    priceRange: "$$",
    address: [
      {
        "@type": "PostalAddress",
        streetAddress: "Rua Eixo W1, R. Célio Miranda, N° 729",
        addressLocality: "Paragominas",
        addressRegion: "PA",
        addressCountry: "BR",
      },
      {
        "@type": "PostalAddress",
        streetAddress: "Av. Generalíssimo Deodoro, 904 - Nazaré",
        addressLocality: "Belém",
        addressRegion: "PA",
        addressCountry: "BR",
      },
    ],
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CRM-PA",
      value: "15253",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(GOOGLE_REVIEWS.rating),
      bestRating: "5",
      ratingCount: String(GOOGLE_REVIEWS.count),
    },
    sameAs: ["https://www.instagram.com/drjulianomachado.oftalmo/"],
  };
  const medicalWebPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: "Agendar Consulta — Dr. Juliano Machado",
    description:
      "Página oficial de agendamento online de consultas oftalmológicas com o Dr. Juliano Machado em Paragominas e Belém.",
    url: "https://drjulianomachado.com/agendamento",
    inLanguage: "pt-BR",
    isPartOf: {
      "@type": "WebSite",
      name: "Dr. Juliano Machado — Oftalmologista",
      url: "https://drjulianomachado.com",
    },
    about: physicianJsonLd,
    audience: { "@type": "MedicalAudience", audienceType: "Patient" },
    mainEntity: physicianJsonLd,
  };

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
        <script type="application/ld+json">{JSON.stringify(physicianJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(medicalWebPageJsonLd)}</script>
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
              <strong className="text-foreground">Mais de 15 anos</strong>
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
                        5.0 · Avaliações do Google
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
                  <span className="text-xs text-muted-foreground">({GOOGLE_REVIEWS.count} avaliações)</span>
                </div>

                <img
                  src={drJulianoHero}
                  alt="Dr. Juliano Machado, oftalmologista"
                  className="mb-4 h-64 w-full rounded-lg object-cover object-top"
                  loading="lazy"
                  decoding="async"
                />

                <h3 className="mb-3 font-serif text-lg font-semibold text-foreground">
                  Por que escolher o Dr. Juliano?
                </h3>

                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Mais de 15 anos</strong> de experiência em oftalmologia
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
                      <strong className="text-foreground">Resposta em até 2h úteis</strong>
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
                  "Atendimento muito bom, profissional excelente, muito prestativo, atencioso, humano, super indico."
                </p>
                <p className="mt-2 text-xs text-muted-foreground">— Jéssica Oliveira da Costa · Avaliação Google</p>
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
