/**
 * Guard centralizado de privacidade/LGPD.
 *
 * Bloqueia qualquer tracking externo (GTM, GA4, Meta Pixel, Google Ads,
 * dataLayer pushes etc.) em rotas administrativas e autenticadas.
 *
 * Use `isTrackingAllowed()` antes de inicializar scripts ou disparar eventos.
 * Use `safeDataLayerPush()` para empurrar eventos respeitando o guard.
 */

import { getConsent } from "./consent";

const PRIVATE_PREFIXES = ["/admin"];
const PRIVATE_EXACT = ["/auth"];

export function isPrivateRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (PRIVATE_EXACT.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function routeAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return !isPrivateRoute(window.location.pathname);
}

export function isAnalyticsAllowed(): boolean {
  return routeAllowed() && getConsent()?.analytics === true;
}

export function isMarketingAllowed(): boolean {
  return routeAllowed() && getConsent()?.marketing === true;
}

/** Mantido por compatibilidade — equivale a analytics OU marketing autorizado. */
export function isTrackingAllowed(): boolean {
  if (!routeAllowed()) return false;
  const c = getConsent();
  return !!(c && (c.analytics || c.marketing));
}

export function safeDataLayerPush(event: Record<string, unknown>): void {
  // Permite push se QUALQUER consent (analytics OU marketing) estiver granted.
  // Consent Mode v2 no GTM filtra internamente quais tags podem disparar
  // baseado em analytics_storage e ad_storage — não precisamos bloquear o
  // push antes de chegar no GTM.
  if (!isTrackingAllowed()) return;
  if (typeof window === "undefined") return;
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(event);
}

export function safeGtag(...args: unknown[]): void {
  if (!isTrackingAllowed()) return;
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag === "function") {
    gtag(...args);
  }
}

/**
 * Mantido apenas como compatibilidade — o site não dispara fbq() diretamente.
 * O Meta Pixel é servido via GTM e respeita Consent Mode v2.
 */
export function safeFbq(
  _method: "track" | "trackCustom",
  _event: string,
  _params?: Record<string, unknown>
): void {
  /* noop: pixel só dispara via GTM */
}
