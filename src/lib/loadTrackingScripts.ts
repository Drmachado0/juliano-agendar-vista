/**
 * Carregamento idempotente do GTM. O Meta Pixel é disparado exclusivamente
 * via GTM (controlado pelo Consent Mode v2 — ad_storage).
 */

import { loadClarity } from "./clarity";

const GTM_ID = "GTM-K3C2NNF6";

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

/**
 * Aplica consent: GTM carrega quando analytics OU marketing for autorizado
 * (o GTM precisa estar presente para servir as tags de marketing também).
 * O Meta Pixel é uma tag dentro do GTM e respeita o Consent Mode automaticamente.
 * Microsoft Clarity carrega apenas quando `analytics=true` E
 * CLARITY_PROJECT_ID estiver preenchido (fica inerte enquanto o ID não for fornecido).
 */
export function applyConsentToScripts(opts: { analytics: boolean; marketing: boolean }): void {
  if (opts.analytics || opts.marketing) loadGTM();
  if (opts.analytics) loadClarity();
}
