declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

window.dataLayer = window.dataLayer || [];

const pushToDataLayer = (data: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
};

export const useGoogleTag = () => {
  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    pushToDataLayer({
      event: eventName,
      ...parameters,
    });
  };

  const trackWhatsAppClick = (linkUrl: string = 'https://wa.me/5591936180476', linkText: string = 'WhatsApp') => {
    pushToDataLayer({
      event: 'whatsapp_click',
      link_url: linkUrl,
      link_text: linkText,
    });
  };

  const trackPhoneClick = (linkUrl: string = 'tel:+5591936180476') => {
    pushToDataLayer({
      event: 'phone_click',
      link_url: linkUrl,
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
  };
};
