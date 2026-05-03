/**
 * Captura e persiste parâmetros de tracking (UTMs, click-ids, cookies Meta).
 * Persistido em sessionStorage (`lp_utms`) para sobreviver à navegação interna.
 */

export const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
] as const;

export type TrackingKey = (typeof TRACKING_KEYS)[number];

export interface TrackingParams {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
}

const STORAGE_KEY = "lp_utms";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function getTrackingParams(): TrackingParams {
  if (typeof window === "undefined") return {};

  let existing: TrackingParams = {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) existing = JSON.parse(raw);
  } catch {
    /* noop */
  }

  const captured: TrackingParams = { ...existing };
  const params = new URLSearchParams(window.location.search);

  TRACKING_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) (captured as any)[key] = value;
  });

  captured.fbp = getCookie("_fbp") || captured.fbp || null;
  captured.fbc = getCookie("_fbc") || captured.fbc || null;
  captured.landing_page = captured.landing_page || window.location.href;
  captured.referrer = captured.referrer || document.referrer || null;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    /* noop */
  }

  return captured;
}
