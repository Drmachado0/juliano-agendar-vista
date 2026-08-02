
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

/**
 * Helper de eventos Meta Pixel com suporte a eventID para deduplicação server-side.
 */
export function trackMeta(
  event: string,
  params?: Record<string, unknown>
): string | null {
  if (typeof window === 'undefined' || !window.fbq) {
    return null;
  }

  const eventID = crypto.randomUUID();

  try {
    window.fbq('track', event, params, { eventID });
    return eventID;
  } catch (err) {
    console.warn('[Meta Pixel] Error tracking event:', event, err);
    return null;
  }
}
