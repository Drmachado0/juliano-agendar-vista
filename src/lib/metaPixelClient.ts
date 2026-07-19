/**
 * Chama window.fbq('track', ...) diretamente com um eventID para deduplicação
 * server-side (Conversions API). O Pixel é carregado pelo GTM após consentimento,
 * então usamos guarda `typeof fbq === "function"`. Nunca chame para PageView ou
 * ViewContent — esses já são disparados via GTM e chamar aqui duplicaria.
 */
export function fbqTrack(
  eventName: 'Contact' | 'Schedule' | 'CompleteRegistration' | 'Lead',
  eventId: string,
): void {
  if (typeof window === 'undefined') return;
  const fbq = (window as any).fbq;
  if (typeof fbq !== 'function') return;
  try {
    fbq('track', eventName, {}, { eventID: eventId });
  } catch {
    // Falha em fbq nunca deve quebrar UX.
  }
}
