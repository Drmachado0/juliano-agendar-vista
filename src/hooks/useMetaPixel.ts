// Meta Pixel events: dual-fire — empurra para o dataLayer (GTM)
// E também dispara fbq() direto, garantindo que o Meta receba os eventos
// mesmo se a tag do GTM estiver com problema.
import { safeDataLayerPush, safeFbq } from '@/lib/trackingGuard';

const pushToDataLayer = (data: Record<string, any>) => {
  safeDataLayerPush(data);
};

export const useMetaPixel = () => {
  const trackViewContent = (contentName: string, contentCategory?: string) => {
    pushToDataLayer({
      event: 'meta_view_content',
      content_name: contentName,
      content_category: contentCategory,
    });
    safeFbq('track', 'ViewContent', {
      content_name: contentName,
      content_category: contentCategory,
    });
  };

  const trackLead = (contentName?: string) => {
    const name = contentName || 'Formulário Agendamento Iniciado';
    pushToDataLayer({
      event: 'meta_lead',
      form_name: 'agendamento',
      content_name: name,
      content_category: 'Consulta Oftalmológica',
      value: 300,
      currency: 'BRL',
    });
    safeFbq('track', 'Lead', {
      content_name: name,
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
    safeFbq('trackCustom', 'Schedule', {
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
    safeFbq('track', 'CompleteRegistration', {
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
    safeFbq('track', 'Contact', {
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
      safeFbq('trackCustom', eventName, parameters);
    },
  };
};
