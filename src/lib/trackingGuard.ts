/**
 * Guard centralizado de privacidade/LGPD.
 *
 * Bloqueia qualquer tracking externo (GTM, GA4, Meta Pixel, Google Ads,
 * dataLayer pushes etc.) em rotas administrativas e autenticadas.
 *
 * Use `isTrackingAllowed()` antes de inicializar scripts ou disparar eventos.
 * Use `safeDataLayerPush()` para empurrar eventos respeitando o guard.
 */

const PRIVATE_PREFIXES = ["/admin"];
const PRIVATE_EXACT = ["/auth"];

export function isPrivateRoute(pathname: string): boolean {
  if (!pathname) return false;
  if (PRIVATE_EXACT.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isTrackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return !isPrivateRoute(window.location.pathname);
}

export function safeDataLayerPush(event: Record<string, unknown>): void {
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
