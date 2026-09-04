import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { safeDataLayerPush, isMarketingAllowed } from '@/lib/trackingGuard';
import { trackMetaPageView } from '@/lib/metaPixel';

// Chaves de tracking que devem sobreviver à navegação interna SPA.
// Persistidas em sessionStorage assim que aparecem na URL — depois lidas no
// submit do form (services/agendamentos.ts → captureMetaSignals).
const TRACKING_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'gbraid', 'wbraid',
] as const;

const RouteChangeTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    safeDataLayerPush({
      event: 'virtualPageview',
      page_path: location.pathname,
      page_title: document.title,
    });

    // PageView do Meta Pixel em navegação SPA (ex.: /agendamento → /obrigado).
    // O PageView do primeiro carregamento sai em loadMetaPixel().
    if (isMarketingAllowed()) {
      trackMetaPageView(`${location.pathname}${location.search}`);
    }

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
