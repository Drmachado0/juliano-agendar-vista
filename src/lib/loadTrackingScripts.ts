/**
 * Carregamento idempotente dos scripts de tracking.
 * Só deve ser chamado após consentimento do usuário.
 */

const GTM_ID = "GTM-K3C2NNF6";
const META_PIXEL_ID = "1003792428067622";

export function loadGTM(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__gtmLoaded) return;
  w.__gtmLoaded = true;

  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

  const f = document.getElementsByTagName("script")[0];
  const j = document.createElement("script");
  j.async = true;
  j.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  f.parentNode?.insertBefore(j, f);
}

export function loadMetaPixel(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__metaPixelLoaded) return;
  w.__metaPixelLoaded = true;

  /* eslint-disable */
  // @ts-ignore
  !(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  (window as any).fbq("init", META_PIXEL_ID);
  (window as any).fbq("track", "PageView");
}

export function applyConsentToScripts(opts: { analytics: boolean; marketing: boolean }): void {
  if (opts.analytics) loadGTM();
  if (opts.marketing) loadMetaPixel();
}
