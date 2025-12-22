declare global {
  interface Window {
    dataLayer: any[];
  }
}

export const useGoogleTag = () => {
  const pushToDataLayer = (data: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(data);
    }
  };

  const trackPageView = (pagePath?: string) => {
    pushToDataLayer({
      event: 'page_view',
      page_path: pagePath || window.location.pathname,
    });
  };

  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    pushToDataLayer({
      event: eventName,
      ...parameters,
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

  return {
    trackPageView,
    trackEvent,
    trackScheduleStart,
    trackScheduleComplete,
    trackContact,
    trackLead,
  };
};
