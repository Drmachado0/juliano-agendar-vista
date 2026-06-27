const ATTR_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'gbraid',
  'wbraid',
] as const;

const LP_UTMS_KEY = 'lp_utms';
const CRM_CODE_KEY = 'crm_tracking_code';
const LEAD_EVENT_ID_KEY = 'lead_event_id';

type AttributionPayload = Record<string, string> & {
  crm_tracking_code: string;
  event_id: string;
  landing_page: string;
  referrer: string;
};

function safeGet(storage: Storage | undefined, key: string): string {
  try {
    return storage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSet(storage: Storage | undefined, key: string, value?: string | null) {
  try {
    if (value) storage?.setItem(key, String(value));
  } catch {
    // Não bloquear o fluxo do paciente por erro de storage.
  }
}

function makeShortCode() {
  return `ADS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function getOrCreateCrmCode(): string {
  const existing = safeGet(window.sessionStorage, CRM_CODE_KEY) || safeGet(window.localStorage, CRM_CODE_KEY);
  if (existing) return existing;

  const code = makeShortCode();
  safeSet(window.sessionStorage, CRM_CODE_KEY, code);
  safeSet(window.localStorage, CRM_CODE_KEY, code);
  return code;
}

function getOrCreateEventId(): string {
  const existing = safeGet(window.sessionStorage, LEAD_EVENT_ID_KEY) || safeGet(window.localStorage, LEAD_EVENT_ID_KEY);
  if (existing) return existing;

  const eventId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  safeSet(window.sessionStorage, LEAD_EVENT_ID_KEY, eventId);
  safeSet(window.localStorage, LEAD_EVENT_ID_KEY, eventId);
  return eventId;
}

function readStoredPayload(): Record<string, string> {
  try {
    const raw = safeGet(window.sessionStorage, LP_UTMS_KEY) || safeGet(window.localStorage, LP_UTMS_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
}

export function captureCrmAttribution(): AttributionPayload | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const data: Record<string, string> = readStoredPayload();

    ATTR_KEYS.forEach((key) => {
      const value = params.get(key) || safeGet(window.sessionStorage, key) || safeGet(window.localStorage, key);
      if (value) {
        data[key] = value;
        safeSet(window.sessionStorage, key, value);
        safeSet(window.localStorage, key, value);
      }
    });

    const landingPage = data.landing_page || safeGet(window.sessionStorage, 'landing_page') || window.location.href;
    const referrer = data.referrer || safeGet(window.sessionStorage, 'referrer') || document.referrer || '';
    const eventId = data.event_id || getOrCreateEventId();
    const crmCode = data.crm_tracking_code || getOrCreateCrmCode();

    data.landing_page = landingPage;
    data.referrer = referrer;
    data.event_id = eventId;
    data.crm_tracking_code = crmCode;

    safeSet(window.sessionStorage, 'landing_page', landingPage);
    safeSet(window.localStorage, 'landing_page', landingPage);
    if (referrer) {
      safeSet(window.sessionStorage, 'referrer', referrer);
      safeSet(window.localStorage, 'referrer', referrer);
    }
    safeSet(window.sessionStorage, LEAD_EVENT_ID_KEY, eventId);
    safeSet(window.localStorage, LEAD_EVENT_ID_KEY, eventId);
    safeSet(window.sessionStorage, CRM_CODE_KEY, crmCode);
    safeSet(window.localStorage, CRM_CODE_KEY, crmCode);
    safeSet(window.sessionStorage, LP_UTMS_KEY, JSON.stringify(data));
    safeSet(window.localStorage, LP_UTMS_KEY, JSON.stringify(data));

    return data as AttributionPayload;
  } catch (error) {
    console.warn('[whatsapp-crm-attribution] capture failed:', error);
    return null;
  }
}

function hasPaidAttribution(data: AttributionPayload) {
  return Boolean(
    data.utm_source ||
      data.utm_campaign ||
      data.gclid ||
      data.fbclid ||
      data.gbraid ||
      data.wbraid,
  );
}

function compactAttribution(data: AttributionPayload) {
  const parts = [`origem=${data.crm_tracking_code}`];

  ATTR_KEYS.forEach((key) => {
    const value = data[key];
    if (value) parts.push(`${key}=${String(value).slice(0, 90)}`);
  });

  return parts.join(' | ');
}

function isWhatsappHref(href: string) {
  return /wa\.me|api\.whatsapp\.com|whatsapp/i.test(href);
}

export function decorateWhatsappLinksWithCrmAttribution() {
  if (typeof window === 'undefined') return;

  const data = captureCrmAttribution();
  if (!data || !hasPaidAttribution(data)) return;

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .filter((link) => isWhatsappHref(link.getAttribute('href') || ''));

  links.forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      const url = new URL(href, window.location.href);
      const originalText =
        url.searchParams.get('text') ||
        'Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.';

      if (originalText.includes('[Origem Ads/CRM:')) {
        link.dataset.crmAttrDecorated = data.crm_tracking_code;
        return;
      }

      const marker = `[Origem Ads/CRM: ${compactAttribution(data)}]`;
      url.searchParams.set('text', `${originalText}\n\n${marker}`);
      link.setAttribute('href', url.toString());
      link.dataset.crmAttrDecorated = data.crm_tracking_code;
    } catch (error) {
      console.warn('[whatsapp-crm-attribution] decorate failed:', error);
    }
  });
}

export function installWhatsappCrmAttributionBridge() {
  if (typeof window === 'undefined') return;
  if ((window as any).__whatsappCrmAttributionInstalled) return;
  (window as any).__whatsappCrmAttributionInstalled = true;

  const run = () => decorateWhatsappLinksWithCrmAttribution();

  captureCrmAttribution();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  window.addEventListener('popstate', run);
  window.addEventListener('hashchange', run);

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!link) return;

      const href = link.getAttribute('href') || '';
      if (!isWhatsappHref(href)) return;

      decorateWhatsappLinksWithCrmAttribution();
      const data = captureCrmAttribution();
      if (!data) return;

      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: 'paid_whatsapp_click_crm',
        crm_tracking_code: data.crm_tracking_code,
        utm_source: data.utm_source || '',
        utm_campaign: data.utm_campaign || '',
        gclid: data.gclid || '',
        fbclid: data.fbclid || '',
      });
    },
    true,
  );

  let attempts = 0;
  const timer = window.setInterval(() => {
    run();
    attempts += 1;
    if (attempts > 30) window.clearInterval(timer);
  }, 500);

  try {
    const observer = new MutationObserver(run);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  } catch {
    // MutationObserver é melhoria, não dependência crítica.
  }
}
