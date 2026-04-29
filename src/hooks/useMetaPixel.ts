// Meta Pixel events agora são disparados 100% via GTM.
// Este hook apenas envia eventos ao dataLayer; o GTM lê e dispara o fbq().

const isAdminContext = () =>
  typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin');

const pushToDataLayer = (data: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  if (isAdminContext()) return; // Não rastrear ações dentro do painel admin
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(data);
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
      form_name: 'agendamento',
      content_name: contentName || 'Formulário Agendamento Iniciado',
      content_category: 'Consulta Oftalmológica',
      value: 300,
      currency: 'BRL',
    });
  };

  const trackSchedule = (appointmentType?: string, location?: string) => {
    pushToDataLayer({
      event: 'meta_schedule',
      content_name: 'Agendamento Confirmado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
    });
  };

  const trackCompleteRegistration = (appointmentType?: string, location?: string) => {
    pushToDataLayer({
      event: 'meta_complete_registration',
      content_name: 'Agendamento Finalizado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
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
