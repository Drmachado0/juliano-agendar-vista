import { useEffect, useRef, RefObject } from 'react';
import { trackGuiaEvent } from '@/lib/guiaAnalytics';
import { isAnalyticsAllowed } from '@/lib/trackingGuard';
import { CONSENT_CHANGED_EVENT } from '@/lib/consent';

/** Leitura estimada: 30 segundos em aba visível e metade do texto alcançada. */
export function useGuiaReading(slug: string, content: RefObject<HTMLElement>) {
  const state = useRef({ slug: '', viewed: false, read: false, seconds: 0 });
  useEffect(() => {
    if (state.current.slug !== slug) state.current = { slug, viewed: false, read: false, seconds: 0 };
    const tick = (count = false) => {
      if (!isAnalyticsAllowed() || !slug) return;
      if (!state.current.viewed) { trackGuiaEvent('ocular_article_view', slug); state.current.viewed = true; }
      if (document.visibilityState !== 'visible') return;
      if (count) state.current.seconds++;
      const rect = content.current?.getBoundingClientRect();
      if (!state.current.read && state.current.seconds >= 30 && rect && rect.top + rect.height / 2 <= window.innerHeight) {
        trackGuiaEvent('ocular_article_read', slug); state.current.read = true;
      }
    };
    tick();
    const consentChanged = () => tick();
    const timer = window.setInterval(() => tick(true), 1000);
    window.addEventListener(CONSENT_CHANGED_EVENT, consentChanged);
    return () => { clearInterval(timer); window.removeEventListener(CONSENT_CHANGED_EVENT, consentChanged); };
  }, [slug, content]);
}
