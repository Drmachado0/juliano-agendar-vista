import { isTrackingAllowed, safeDataLayerPush } from '@/lib/trackingGuard';

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

// Não inicializar dataLayer em rotas privadas (LGPD)
if (typeof window !== 'undefined' && isTrackingAllowed()) {
  window.dataLayer = window.dataLayer || [];
}

const pushToDataLayer = (data: Record<string, any>) => {
  safeDataLayerPush(data);
};

export const useGoogleTag = () => {
  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    pushToDataLayer({
      event: eventName,
      ...parameters,
    });
  };

  const trackWhatsAppClick = (
    linkUrl: string = 'https://wa.me/559184043477',
    linkText: string = 'WhatsApp',
    buttonId: string = 'whatsapp_generic',
    buttonLocation: string = 'unknown'
  ) => {
    pushToDataLayer({
      event: 'whatsapp_click',
      button_id: buttonId,
      button_location: buttonLocation,
      button_text: linkText,
      destination_url: linkUrl,
      // Campos legados mantidos por compatibilidade com tags GTM antigas
      link_url: linkUrl,
      link_text: linkText,
    });
  };

  const trackPhoneClick = (linkUrl: string = 'tel:+559184043477') => {
    pushToDataLayer({
      event: 'phone_click',
      link_url: linkUrl,
    });
    pushToDataLayer({
      event: 'google_ads_conversion',
      send_to: 'AW-436492720/R5yuCJjn7ZwcELCzkdAB',
      value: 300,
      currency: 'BRL',
    });
  };

  const trackFormSubmitConversion = () => {
    pushToDataLayer({
      event: 'form_submitted',
      form_name: 'agendamento',
      value: 300,
      currency: 'BRL',
    });
  };

  const trackScheduleStart = () => {
    pushToDataLayer({
      event: 'begin_checkout',
      event_category: 'agendamento',
      event_label: 'inicio_agendamento',
    });
  };

  const trackScheduleComplete = (appointmentType?: string, location?: string) => {
    pushToDataLayer({
      event: 'purchase',
      event_category: 'agendamento',
      event_label: 'agendamento_confirmado',
      appointment_type: appointmentType,
      location: location,
    });
  };

  const trackContact = (method: string = 'whatsapp') => {
    pushToDataLayer({
      event: 'contact',
      event_category: 'contato',
      event_label: method,
      method: method,
    });
  };

  const trackLead = (source?: string) => {
    pushToDataLayer({
      event: 'generate_lead',
      event_category: 'lead',
      event_label: source || 'formulario',
    });
  };

  const trackCTAClick = (ctaName: string, ctaLocation: string, ctaText: string) => {
    pushToDataLayer({
      event: 'cta_click',
      cta_name: ctaName,
      cta_location: ctaLocation,
      cta_text: ctaText,
    });
  };

  const trackWhatsAppGoogleAdsConversion = () => {
    pushToDataLayer({
      event: 'google_ads_conversion',
      send_to: 'AW-436492720/-h8XCK3z6JwcELCzkdAB',
      value: 300,
      currency: 'BRL',
    });
  };

  // Funil de conversão (analytics-only): GA4/GTM lê via dataLayer.
  // Nomes de eventos prefixados por contexto para distinguir landing (/agendamento)
  // do modal (homepage). Combinados com lp_step_view permitem medir taxa por step.
  type AppointmentContext = 'landing_agendamento' | 'modal';

  const trackFormStart = (pageType: AppointmentContext) => {
    pushToDataLayer({
      event: pageType === 'modal' ? 'modal_form_start' : 'lp_form_start',
      page_type: pageType,
    });
  };

  const trackStepCompleted = (step: number, pageType: AppointmentContext) => {
    pushToDataLayer({
      event: pageType === 'modal' ? 'modal_step_completed' : 'lp_step_completed',
      step,
      page_type: pageType,
    });
  };

  const trackAppointmentError = (
    pageType: AppointmentContext,
    errorType: 'availability' | 'other' | 'unexpected',
    errorMessage?: string,
  ) => {
    pushToDataLayer({
      event: pageType === 'modal' ? 'modal_appointment_error' : 'lp_appointment_error',
      page_type: pageType,
      error_type: errorType,
      error_message: errorMessage,
    });
  };

  return {
    trackEvent,
    trackWhatsAppClick,
    trackPhoneClick,
    trackScheduleStart,
    trackScheduleComplete,
    trackContact,
    trackLead,
    trackCTAClick,
    trackFormSubmitConversion,
    trackWhatsAppGoogleAdsConversion,
    trackFormStart,
    trackStepCompleted,
    trackAppointmentError,
  };
};
