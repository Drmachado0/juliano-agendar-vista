declare global {
  interface Window {
    fbq: (
      type: string,
      eventName: string,
      parameters?: Record<string, unknown>
    ) => void;
  }
}

type MetaPixelEvent =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "Schedule"
  | "CompleteRegistration"
  | "Contact"
  | "InitiateCheckout";

interface EventParameters {
  content_name?: string;
  content_category?: string;
  content_type?: string;
  value?: number;
  currency?: string;
  [key: string]: unknown;
}

export const trackMetaEvent = (
  eventName: MetaPixelEvent | string,
  parameters?: EventParameters
) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, parameters);
  }
};

export const useMetaPixel = () => {
  const trackViewContent = (contentName: string, contentCategory?: string) => {
    trackMetaEvent("ViewContent", {
      content_name: contentName,
      content_category: contentCategory,
    });
  };

  const trackLead = (contentName?: string) => {
    trackMetaEvent("Lead", {
      content_name: contentName || "Formulário Agendamento Iniciado",
    });
  };

  const trackSchedule = (appointmentType?: string, location?: string) => {
    trackMetaEvent("Schedule", {
      content_name: "Agendamento Confirmado",
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackCompleteRegistration = (appointmentType?: string, location?: string) => {
    trackMetaEvent("CompleteRegistration", {
      content_name: "Agendamento Finalizado",
      content_category: appointmentType,
      content_type: location,
    });
  };

  const trackContact = (method?: string) => {
    trackMetaEvent("Contact", {
      content_name: method || "WhatsApp",
    });
  };

  return {
    trackViewContent,
    trackLead,
    trackSchedule,
    trackCompleteRegistration,
    trackContact,
    trackEvent: trackMetaEvent,
  };
};
