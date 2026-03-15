declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const GOOGLE_ADS_ID = 'AW-979714971';

export const useGoogleTag = () => {
  const pushToDataLayer = (data: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(data);
    }
  };

  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    pushToDataLayer({
      event: eventName,
      ...parameters,
    });
  };

  const trackGoogleAdsConversion = (conversionLabel: string) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`,
      });
    }
  };

  const trackFormSubmitConversion = () => {
    trackGoogleAdsConversion('7428858657');
  };

  const trackPhoneClickConversion = () => {
    trackGoogleAdsConversion('7504209532');
  };

  const trackWhatsAppClickConversion = () => {
    trackGoogleAdsConversion('6834364244');
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
    trackScheduleStart,
    trackScheduleComplete,
    trackContact,
    trackLead,
    trackCTAClick,
    trackFormSubmitConversion,
    trackPhoneClickConversion,
    trackWhatsAppClickConversion,
  };
};
