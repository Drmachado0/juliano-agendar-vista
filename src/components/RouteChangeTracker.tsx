import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { safeDataLayerPush } from '@/lib/trackingGuard';
import { trackMeta, trackMetaOnce } from '@/lib/meta-pixel';

// Chaves de tracking que devem sobreviver à navegação interna SPA.
// Persistidas em sessionStorage assim que aparecem na URL — depois lidas no
// submit do form (services/agendamentos.ts → captureMetaSignals).
const TRACKING_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'gbraid', 'wbraid',
] as const;

const RouteChangeTracker = () => {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dispara PageView a cada navegação, exceto no primeiro carregamento (já disparado no index.html)
    if (!isFirstRender.current) {
      trackMetaOnce('PageView', location.pathname);
    }
    isFirstRender.current = false;

    safeDataLayerPush({
      event: 'virtualPageview',
      page_path: location.pathname,
      page_title: document.title,
    });

    // Persiste UTMs/click IDs em sessionStorage — sobrevive à mudança de rota
    // que normalmente apaga query params da URL após o landing.
    const params = new URLSearchParams(window.location.search);
    for (const key of TRACKING_KEYS) {
      const value = params.get(key);
      if (value) sessionStorage.setItem(key, value);
    }

    // landing_page = URL completa da primeira navegação da sessão (com query string)
    if (!sessionStorage.getItem('landing_page')) {
      sessionStorage.setItem('landing_page', window.location.href);
    }
    if (!sessionStorage.getItem('referrer') && document.referrer) {
      sessionStorage.setItem('referrer', document.referrer);
    }
  }, [location]);

  return null;
};

export default RouteChangeTracker;
