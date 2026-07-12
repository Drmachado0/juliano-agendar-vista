import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { criarLead, converterLeadEmAgendamento } from "@/services/leads";
import { notificarN8n } from "@/services/integracoes";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import type { FormData } from "@/components/scheduling/SchedulingModal";

/**
 * Motor compartilhado do fluxo de agendamento (estado + integrações + tracking).
 *
 * Preserva integralmente o comportamento da rota `/agendamento`: quando chamado
 * sem opções, o payload de submit e todos os eventos disparados são idênticos
 * ao código original de `src/pages/Agendamento.tsx`.
 *
 * A opção `experienceVariant` apenas *adiciona* um campo não sensível
 * (`experience_variant`) aos eventos `booking_*` do dataLayer, sem alterar
 * conteúdo dos steps, do payload do lead ou do agendamento.
 */
export interface UseAgendamentoFlowOptions {
  /** page_type usado em dataLayer/eventos de tracking. */
  pageType?: string;
  /** Rótulo não sensível para diferenciar variantes visuais no analytics. */
  experienceVariant?: string;
}

export const AGENDAMENTO_INITIAL_FORM_DATA: FormData = {
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

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
];

const STEP_NAMES: Record<number, string> = {
  1: "personal_data",
  2: "consultation_details",
  3: "date_time",
  4: "confirmation",
};

const TOTAL_STEPS = 4;

const pushDL = (data: Record<string, any>) => {
  if (typeof window !== "undefined") {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push(data);
  }
};

export function useAgendamentoFlow(options: UseAgendamentoFlowOptions = {}) {
  const pageType = options.pageType ?? "landing_agendamento";
  const experienceVariant = options.experienceVariant;

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(AGENDAMENTO_INITIAL_FORM_DATA);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const formStartFiredRef = useRef(false);
  const successFiredRef = useRef(false);
  const viewFiredRef = useRef(false);
  const stepsCompletedRef = useRef<Set<number>>(new Set());

  // Adiciona experience_variant apenas quando definido, sem alterar rota antiga.
  const withVariant = (payload: Record<string, any>) =>
    experienceVariant
      ? { ...payload, experience_variant: experienceVariant }
      : payload;

  // booking_view — 1 por montagem. Preserva evento legado view_scheduling_page.
  useEffect(() => {
    if (viewFiredRef.current) return;
    viewFiredRef.current = true;

    trackViewContent("Landing Agendamento", "Consulta Oftalmológica");
    pushDL({
      event: "view_scheduling_page",
      page_path: typeof window !== "undefined" ? window.location.pathname : "/agendamento",
      page_type: pageType,
    });
    pushDL(withVariant({ event: "booking_view", page_type: pageType }));

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
      console.warn("[useAgendamentoFlow] UTM capture falhou:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSubmitted) {
      pushDL({
        event: "lp_step_view",
        page_type: pageType,
        step: currentStep,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isSubmitted]);

  const updateFormData = (data: Partial<FormData>) => {
    if (!formStartFiredRef.current) {
      formStartFiredRef.current = true;
      trackFormStart(pageType);
      pushDL(withVariant({ event: "booking_start", page_type: pageType }));
    }
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleWhatsAppClick = (location: string, whatsappUrl: string) => {
    trackWhatsAppClick(whatsappUrl, "Falar com a secretária", `whatsapp_${location}`, location);
    trackWhatsAppGoogleAdsConversion();
    trackMetaContact("WhatsApp");
  };

  const nextStep = async () => {
    if (currentStep >= TOTAL_STEPS) return;

    trackStepCompleted(currentStep, pageType);
    if (!stepsCompletedRef.current.has(currentStep)) {
      stepsCompletedRef.current.add(currentStep);
      pushDL(
        withVariant({
          event: "booking_step_completed",
          page_type: pageType,
          step: currentStep,
          step_name: STEP_NAMES[currentStep] ?? `step_${currentStep}`,
        }),
      );
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
        console.error("[useAgendamentoFlow] Erro ao criar lead:", error);
        toast({
          title: "Erro ao registrar interesse",
          description:
            "Não foi possível salvar seus dados. O agendamento continuará normalmente.",
          variant: "destructive",
        });
      } else if (lead_id) {
        setLeadId(lead_id);
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
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS && step <= currentStep) {
      setCurrentStep(step);
    }
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
          data_agendamento: formData.selectedDate
            ? format(formData.selectedDate, "yyyy-MM-dd")
            : "",
          hora_agendamento: formData.selectedTime,
          aceita_primeiro_horario: formData.acceptFirstAvailable,
          aceita_contato_whatsapp_email: formData.acceptNotifications,
        },
        localAtendimento,
      );

      if (error) {
        const isAvailabilityError =
          error.message.includes("disponível") ||
          error.message.includes("bloqueado") ||
          error.message.includes("ocupado");

        trackAppointmentError(
          pageType,
          isAvailabilityError ? "availability" : "other",
          error.message,
        );

        toast({
          title: isAvailabilityError ? "Horário indisponível" : "Erro ao agendar",
          description:
            error.message || "Não foi possível finalizar seu agendamento. Tente novamente.",
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
        data_agendamento: formData.selectedDate
          ? format(formData.selectedDate, "yyyy-MM-dd")
          : "",
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
              data_agendamento: formData.selectedDate
                ? format(formData.selectedDate, "yyyy-MM-dd")
                : "",
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
            convenio_outro:
              formData.insurance === "outro" ? formData.otherInsurance : null,
            data_agendamento: formData.selectedDate
              ? format(formData.selectedDate, "yyyy-MM-dd")
              : "",
            hora_agendamento: formData.selectedTime,
          },
        }),
      ]);
      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), NOTIFICATION_TIMEOUT_MS),
      );
      await Promise.race([notificationsPromise, timeoutPromise]);

      trackScheduleComplete(formData.appointmentTypeName, formData.locationName);
      trackSchedule(formData.appointmentTypeName, formData.locationName, leadId);
      trackCompleteRegistration(formData.appointmentTypeName, formData.locationName, leadId);
      trackFormSubmitConversion();

      if (!successFiredRef.current) {
        successFiredRef.current = true;
        trackAppointmentSuccess(pageType, {
          id: leadId ?? null,
          appointmentType: formData.appointmentTypeName,
          location: formData.locationName,
        });
        pushDL(
          withVariant({
            event: "booking_submit",
            page_type: pageType,
            appointment_id: leadId ?? null,
            appointment_type: formData.appointmentTypeName,
            location: formData.locationName,
            value: 300,
            currency: "BRL",
          }),
        );
      }

      pushDL({
        event: "lp_appointment_scheduled",
        page_type: pageType,
        tipo_atendimento: formData.appointmentTypeName,
        local: formData.locationName,
        value: 300,
        currency: "BRL",
      });

      setIsSubmitted(true);
    } catch (err) {
      console.error("[useAgendamentoFlow] Erro inesperado:", err);
      trackAppointmentError(
        pageType,
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
    setFormData(AGENDAMENTO_INITIAL_FORM_DATA);
    setLeadId(null);
    setIsSubmitted(false);
  };

  return {
    currentStep,
    formData,
    leadId,
    isSubmitted,
    isSubmitting,
    totalSteps: TOTAL_STEPS,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    handleSubmit,
    handleReset,
    handleWhatsAppClick,
  };
}
