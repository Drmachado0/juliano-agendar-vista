const PIXEL_ID = '704492538264617';

const pushToDataLayer = (data: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
};

const trackFbq = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
    (window as any).fbq('track', eventName, params);
  }
};

export const useMetaPixel = () => {
  const trackViewContent = (contentName: string, contentCategory?: string) => {
    trackFbq('ViewContent', {
      content_name: contentName,
      content_category: contentCategory,
    });
    pushToDataLayer({
      event: 'meta_view_content',
      content_name: contentName,
      content_category: contentCategory,
    });
  };

  const trackLead = (contentName?: string) => {
    trackFbq('Lead', {
      content_name: contentName || 'Formulário Agendamento Iniciado',
      content_category: 'Consulta Oftalmológica',
      value: 300,
      currency: 'BRL',
    });
    pushToDataLayer({
      event: 'meta_lead',
      content_name: contentName || 'Formulário Agendamento Iniciado',
    });
  };

  const trackSchedule = (appointmentType?: string, location?: string) => {
    trackFbq('Schedule', {
      content_name: 'Agendamento Confirmado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
    });
    pushToDataLayer({
      event: 'meta_schedule',
      content_name: 'Agendamento Confirmado',
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackCompleteRegistration = (appointmentType?: string, location?: string) => {
    trackFbq('CompleteRegistration', {
      content_name: 'Agendamento Finalizado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
    });
    pushToDataLayer({
      event: 'meta_complete_registration',
      content_name: 'Agendamento Finalizado',
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackContact = (method?: string) => {
    trackFbq('Contact', {
      content_name: method || 'WhatsApp',
    });
    pushToDataLayer({
      event: 'meta_contact',
      content_name: method || 'WhatsApp',
    });
  };

  return {
    trackViewContent,
    trackLead,
    trackSchedule,
    trackCompleteRegistration,
    trackContact,
    trackEvent: (eventName: string, parameters?: Record<string, any>) => {
      trackFbq(eventName, parameters);
      pushToDataLayer({ event: `meta_${eventName.toLowerCase()}`, ...parameters });
    },
  };
};
