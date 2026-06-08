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
  event_id?: string | null;
}

const STORAGE_KEY = "lp_utms";
const LEAD_EVENT_ID_KEY = "lead_event_id";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Garante um event_id estável por sessão para deduplicação Pixel/CAPI.
 */
export function getOrCreateLeadEventId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem(LEAD_EVENT_ID_KEY);
    if (!id) {
      id =
        window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(LEAD_EVENT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Captura eager (na inicialização do app) de UTMs, click-ids, landing_page e referrer.
 * Idempotente: chamada várias vezes não duplica nem perde dados.
 * Parâmetros vindos na URL sobrescrevem valores antigos da sessão.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);

    // UTMs / click-ids: URL sobrescreve sessão (regra do prompt #88).
    TRACKING_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) {
        try {
          sessionStorage.setItem(key, value);
          localStorage.setItem(key, value);
        } catch {
          /* ignore */
        }
      }
    });

    if (!sessionStorage.getItem("landing_page")) {
      sessionStorage.setItem("landing_page", window.location.href);
    }
    if (!sessionStorage.getItem("referrer") && document.referrer) {
      sessionStorage.setItem("referrer", document.referrer);
    }

    // Garante event_id pronto para uso por Pixel/CAPI/CRM.
    getOrCreateLeadEventId();

    // Mantém compatibilidade com leitores antigos (lp_utms).
    getTrackingParams();
  } catch (err) {
    console.warn("[attribution] capture failed:", err);
  }
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
    const urlValue = params.get(key);
    if (urlValue) {
      (captured as any)[key] = urlValue;
    } else if (!(captured as any)[key]) {
      // Fallback para chaves persistidas individualmente por captureAttribution().
      try {
        const stored =
          sessionStorage.getItem(key) || localStorage.getItem(key);
        if (stored) (captured as any)[key] = stored;
      } catch {
        /* noop */
      }
    }
  });

  captured.fbp = getCookie("_fbp") || captured.fbp || null;
  captured.fbc = getCookie("_fbc") || captured.fbc || null;
  captured.landing_page =
    captured.landing_page ||
    sessionStorage.getItem("landing_page") ||
    window.location.href;
  captured.referrer =
    captured.referrer ||
    sessionStorage.getItem("referrer") ||
    document.referrer ||
    null;
  captured.event_id = getOrCreateLeadEventId();

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    /* noop */
  }

  return captured;
}
