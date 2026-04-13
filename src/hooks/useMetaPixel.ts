// Meta Pixel is now managed via GTM. These functions push dataLayer events
// that GTM can pick up to fire the corresponding Meta Pixel events.

const pushToDataLayer = (data: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
};

export const useMetaPixel = () => {
  const trackViewContent = (contentName: string, contentCategory?: string) => {
    pushToDataLayer({
      event: 'meta_view_content',
      content_name: contentName,
      content_category: contentCategory,
    });
  };

  const trackLead = (contentName?: string) => {
    pushToDataLayer({
      event: 'meta_lead',
      content_name: contentName || 'Formulário Agendamento Iniciado',
    });
  };

  const trackSchedule = (appointmentType?: string, location?: string) => {
    pushToDataLayer({
      event: 'meta_schedule',
      content_name: 'Agendamento Confirmado',
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackCompleteRegistration = (appointmentType?: string, location?: string) => {
    pushToDataLayer({
      event: 'meta_complete_registration',
      content_name: 'Agendamento Finalizado',
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackContact = (method?: string) => {
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
      pushToDataLayer({ event: `meta_${eventName.toLowerCase()}`, ...parameters });
    },
  };
};
