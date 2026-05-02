/**
 * Gerenciamento de consentimento LGPD/GDPR.
 * Persistido em localStorage. Categorias: necessary (sempre on), analytics, marketing.
 */

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = "lgpd-consent";
export const CONSENT_VERSION = "1.0";
export const CONSENT_CHANGED_EVENT = "lgpd-consent-changed";
export const OPEN_PREFERENCES_EVENT = "lgpd-open-preferences";

export function getConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasDecided(): boolean {
  return getConsent() !== null;
}

export function setConsent(opts: { analytics: boolean; marketing: boolean }): ConsentState {
  const state: ConsentState = {
    necessary: true,
    analytics: opts.analytics,
    marketing: opts.marketing,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }));

    // Google Consent Mode v2 update
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") {
      gtag("consent", "update", {
        analytics_storage: opts.analytics ? "granted" : "denied",
        ad_storage: opts.marketing ? "granted" : "denied",
        ad_user_data: opts.marketing ? "granted" : "denied",
        ad_personalization: opts.marketing ? "granted" : "denied",
      });
    }
  }
  return state;
}

export function acceptAll(): ConsentState {
  return setConsent({ analytics: true, marketing: true });
}

export function rejectAll(): ConsentState {
  return setConsent({ analytics: false, marketing: false });
}

export function subscribeConsent(cb: (state: ConsentState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
}

export function openPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}
