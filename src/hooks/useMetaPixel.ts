// Meta Pixel events: empurra eventos para o dataLayer (GTM).
// O Pixel é disparado exclusivamente via GTM — sem fbq() direto neste código.
//
// O parâmetro opcional `eventId` é usado para dedup com o CAPI server-side.
// Quando presente, o GTM deve passar `eventId` como `eventID` no fbq() para
// que Meta deduplique com o evento server-side de mesmo ID.
import { safeDataLayerPush } from '@/lib/trackingGuard';

const pushToDataLayer = (data: Record<string, any>) => {
  safeDataLayerPush(data);
};

// Gera UUID compatível com browsers modernos; fallback simples se ausente.
const generateEventId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useMetaPixel = () => {
  const trackViewContent = (
    contentName: string,
    contentCategory?: string,
    eventId?: string,
  ) => {
    pushToDataLayer({
      event: 'meta_view_content',
      meta_event_name: 'ViewContent',
      meta_event_id: eventId || generateEventId(),
      content_name: contentName,
      content_category: contentCategory,
    });
  };

  const trackLead = (contentName?: string, eventId?: string) => {
    const name = contentName || 'Formulário Agendamento Iniciado';
    pushToDataLayer({
      event: 'meta_lead',
      meta_event_name: 'Lead',
      meta_event_id: eventId || generateEventId(),
      form_name: 'agendamento',
      content_name: name,
      content_category: 'Consulta Oftalmológica',
      value: 300,
      currency: 'BRL',
    });
  };

  const trackSchedule = (
    appointmentType?: string,
    location?: string,
    eventId?: string,
  ) => {
    pushToDataLayer({
      event: 'meta_schedule',
      meta_event_name: 'Schedule',
      meta_event_id: eventId || generateEventId(),
      content_name: 'Agendamento Confirmado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
    });
  };

  const trackCompleteRegistration = (
    appointmentType?: string,
    location?: string,
    eventId?: string,
  ) => {
    pushToDataLayer({
      event: 'meta_complete_registration',
      meta_event_name: 'CompleteRegistration',
      meta_event_id: eventId || generateEventId(),
      content_name: 'Agendamento Finalizado',
      content_category: appointmentType,
      content_type: location,
      value: 300,
      currency: 'BRL',
    });
  };

  const trackContact = (method?: string, eventId?: string) => {
    pushToDataLayer({
      event: 'meta_contact',
      meta_event_name: 'Contact',
      meta_event_id: eventId || generateEventId(),
      content_name: method || 'WhatsApp',
    });
  };

  return {
    trackViewContent,
    trackLead,
    trackSchedule,
    trackCompleteRegistration,
    trackContact,
    generateEventId,
    trackEvent: (eventName: string, parameters?: Record<string, any>) => {
      pushToDataLayer({
        event: `meta_${eventName.toLowerCase()}`,
        meta_event_name: eventName,
        meta_event_id: parameters?.event_id || generateEventId(),
        ...parameters,
      });
    },
  };
};
