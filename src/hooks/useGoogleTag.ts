declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const useGoogleTag = () => {
  const trackPageView = (pagePath?: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: pagePath || window.location.pathname,
      });
    }
  };

  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  };

  const trackScheduleStart = () => {
    trackEvent('begin_checkout', {
      event_category: 'agendamento',
      event_label: 'inicio_agendamento',
    });
  };

  const trackScheduleComplete = (appointmentType?: string, location?: string) => {
    trackEvent('purchase', {
      event_category: 'agendamento',
      event_label: 'agendamento_confirmado',
      appointment_type: appointmentType,
      location: location,
    });
  };

  const trackContact = (method: string = 'whatsapp') => {
    trackEvent('contact', {
      event_category: 'contato',
      event_label: method,
      method: method,
    });
  };

  const trackLead = (source?: string) => {
    trackEvent('generate_lead', {
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
