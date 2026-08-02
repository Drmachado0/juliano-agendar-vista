
declare global {
  interface Window {
    fbq: (
      command: string,
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID: string }
    ) => void;
  }
}

// Armazena chaves de eventos já disparados para evitar duplicação em re-renders ou StrictMode.
const firedEvents = new Set<string>();

const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
};

const getUtm = (key: string): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get(key);
  if (fromUrl) return fromUrl;
  try {
    return window.sessionStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

/**
 * Envia eventos para a Meta Conversions API (CAPI) via Edge Function.
 * Reutiliza a lógica de atribuição e cookies do checkout.
 */
export const sendMetaCapi = async (
  eventName: string, 
  eventId: string, 
  customData: Record<string, any> = {}
) => {
  if (typeof window === "undefined") return;

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    
    const utm_source = getUtm("utm_source");
    const utm_medium = getUtm("utm_medium");
    const utm_campaign = getUtm("utm_campaign");
    const utm_content = getUtm("utm_content");
    const utm_term = getUtm("utm_term");

    const payload = {
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      user_data: {
        country: "BR",
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        client_user_agent: navigator.userAgent,
      },
      custom_data: {
        content_name: "Agendamento Confirmado",
        content_category: "Consulta Oftalmológica",
        value: 300,
        currency: "BRL",
        ...customData,
        ...(utm_source && { utm_source }),
        ...(utm_medium && { utm_medium }),
        ...(utm_campaign && { utm_campaign }),
        ...(utm_content && { utm_content }),
        ...(utm_term && { utm_term }),
      },
    };

    const { data, error } = await supabase.functions.invoke("meta-capi", { body: payload });
    
    if (error) {
      console.warn(`[meta-capi] ${eventName} falhou (Edge Function Error):`, error);
    } else if (data?.success !== true || data?.events_received !== 1) {
      console.warn(`[meta-capi] ${eventName} anomalia na resposta:`, {
        success: data?.success,
        received: data?.events_received,
        fbtrace_id: data?.fbtrace_id
      });
    }
  } catch (err) {
    console.warn(`[meta-capi] ${eventName} erro inesperado no envio:`, err);
  }
};

/**
 * Helper de eventos Meta Pixel com suporte a eventID para deduplicação server-side.
 */
export function trackMeta(
  event: string,
  params?: Record<string, unknown>,
  eventID?: string
): string | null {
  if (typeof window === 'undefined' || !window.fbq) {
    return null;
  }

  const finalEventID = eventID || crypto.randomUUID();

  try {
    window.fbq('track', event, params, { eventID: finalEventID });
    return finalEventID;
  } catch (err) {
    console.warn('[Meta Pixel] Error tracking event:', event, err);
    return null;
  }
}

/**
 * Dispara um evento Meta Pixel apenas uma vez por chave fornecida.
 * A chave deve ser única para o contexto (ex: pathname para visualização de página).
 */
export function trackMetaOnce(
  event: string,
  key: string,
  params?: Record<string, unknown>,
  eventID?: string
): string | null {
  const compositeKey = `${event}:${key}`;
  
  if (firedEvents.has(compositeKey)) {
    return null;
  }

  firedEvents.add(compositeKey);
  return trackMeta(event, params, eventID);
}

