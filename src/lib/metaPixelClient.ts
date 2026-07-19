/**
 * Dispara eventos Meta Pixel via `fbq('trackCustom', ...)` com um eventID para
 * deduplicação server-side (Conversions API).
 *
 * IMPORTANTE — por que trackCustom e não track:
 * O domínio é de saúde. A Meta aplica "Health Data Restrictions" e descarta
 * silenciosamente eventos padrão (`fbq('track', 'Contact'|'Schedule'|'Lead'|
 * 'CompleteRegistration')`) client-side — testado em produção, não chegam ao
 * Facebook. Eventos custom (`trackCustom`) passam normalmente e são usados
 * para audiências e otimização. O CAPI server-side complementa quando o
 * domínio for verificado.
 *
 * O Pixel é carregado pelo GTM após consentimento; por isso a guarda
 * `typeof fbq === 'function'`. Nunca chamar aqui para PageView/ViewContent
 * (o GTM já dispara — chamada aqui duplicaria).
 */
const STANDARD_TO_CUSTOM: Record<string, string> = {
  Contact: 'ContatoWhatsApp',
  Schedule: 'AgendamentoRealizado',
  CompleteRegistration: 'CadastroConfirmado',
  Lead: 'LeadFormulario',
};

export function fbqTrack(
  eventName: 'Contact' | 'Schedule' | 'CompleteRegistration' | 'Lead',
  eventId: string,
): void {
  if (typeof window === 'undefined') return;
  const fbq = (window as any).fbq;
  if (typeof fbq !== 'function') return;
  const customName = STANDARD_TO_CUSTOM[eventName];
  if (!customName) return;
  try {
    fbq('trackCustom', customName, {}, { eventID: eventId });
  } catch {
    // Falha em fbq nunca deve quebrar UX.
  }
}
