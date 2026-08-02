
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

