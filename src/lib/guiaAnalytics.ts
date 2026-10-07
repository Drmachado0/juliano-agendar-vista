import { isAnalyticsAllowed } from './trackingGuard';
import { GUIA_ARTIGOS } from './guia';

export type GuiaEvent = 'ocular_article_view' | 'ocular_article_read' | 'ocular_article_schedule_click' | 'ocular_article_appointment_success';
const SOURCE_KEY = 'ocular_article_source';

export function rememberGuiaSource(slug: string): void {
  if (typeof window === 'undefined' || !isAnalyticsAllowed()) return;
  if (!GUIA_ARTIGOS.some(a => a.slug === slug)) return;
  try { window.sessionStorage.setItem(SOURCE_KEY, slug); } catch { /* armazenamento indisponível */ }
}

/** Chamado somente pelo evento de reserva concluída, sem dados do paciente. */
export function trackGuiaAppointmentSuccess(): void {
  if (typeof window === 'undefined') return;
  try {
    const slug = window.sessionStorage.getItem(SOURCE_KEY);
    window.sessionStorage.removeItem(SOURCE_KEY);
    if (slug) trackGuiaEvent('ocular_article_appointment_success', slug);
  } catch { /* agendamento segue funcionando sem analytics */ }
}

/** Reutiliza a tag GA4 existente; sem nova instalação ou campos do agendamento. */
export function trackGuiaEvent(event: GuiaEvent, slug: string): void {
  if (typeof window === 'undefined' || !['drjulianomachado.com', 'www.drjulianomachado.com'].includes(window.location.hostname)) return;
  if (!isAnalyticsAllowed()) return;
  const artigo = GUIA_ARTIGOS.find(a => a.slug === slug);
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (!artigo || typeof gtag !== 'function') return;
  gtag('event', event, {
    send_to: 'G-79BDCX4R2L',
    article_slug: artigo.slug,
    article_category: artigo.categoria,
  });
}
