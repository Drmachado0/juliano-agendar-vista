/**
 * Meta Pixel carregado DIRETO pelo site, sem depender do GTM, e somente após
 * consentimento de marketing (LGPD).
 *
 * Por quê: a tag do Pixel dentro do GTM não dispara em produção (window.fbq
 * fica indefinido e nenhuma requisição chega ao Pixel). Sem PageView no
 * navegador a Meta não atribui Landing Page Views, não constrói públicos do
 * site e não consegue otimizar campanhas por eventos do site.
 *
 * Pixel: 1368847001883653 ("Dr Juliano Machado - Site") — o mesmo dataset
 * usado pela edge function meta-capi (deduplicação via eventID) e pela conta
 * de anúncios Anuncios_DrJuliano (853989677377642).
 *
 * Eventos de conversão (Lead/Schedule/CompleteRegistration/Contact) continuam
 * saindo pelo CAPI server-side (criar-lead, converter-lead-agendamento,
 * criar-agendamento → meta-capi) com event_id = id do lead/agendamento. No
 * navegador, `metaPixelClient.fbqTrack` dispara os equivalentes custom.
 *
 * Se algum dia a tag do GTM voltar a disparar, PAUSE a tag no GTM: dois
 * carregadores do mesmo Pixel duplicariam o PageView.
 */

export const META_PIXEL_ID: string =
  (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ||
  "1368847001883653";

const FBEVENTS_SRC = "https://connect.facebook.net/en_US/fbevents.js";

type FbqStub = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Equivalente ao snippet oficial da Meta (stub + fbevents.js assíncrono). */
function installStub(): void {
  const w = window as unknown as { fbq?: FbqStub; _fbq?: FbqStub };
  if (w.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as FbqStub;
  n.queue = [];
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  w.fbq = n;
  if (!w._fbq) w._fbq = n;

  const script = document.createElement("script");
  script.async = true;
  script.src = FBEVENTS_SRC;
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
}

export function isMetaPixelLoaded(): boolean {
  return typeof window !== "undefined" && (window as any).__metaPixelLoaded === true;
}

/**
 * Carrega o Pixel e dispara o PageView inicial. Idempotente.
 * Chamar apenas quando `marketing === true` no consentimento.
 */
export function loadMetaPixel(): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__metaPixelLoaded) return;
  w.__metaPixelLoaded = true;

  try {
    installStub();
    w.fbq("init", META_PIXEL_ID);
    w.fbq("track", "PageView", {}, { eventID: newEventId() });
    w.__metaPixelLastPath = currentPath();
  } catch (err) {
    console.warn("[meta-pixel] falha ao carregar:", err);
  }
}

/**
 * PageView em navegação interna (SPA). Ignora se o Pixel ainda não carregou
 * (o PageView inicial sai no loadMetaPixel) ou se o path não mudou.
 */
export function trackMetaPageView(path?: string): void {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (!w.__metaPixelLoaded || typeof w.fbq !== "function") return;
  const p = path ?? currentPath();
  if (w.__metaPixelLastPath === p) return;
  w.__metaPixelLastPath = p;
  try {
    w.fbq("track", "PageView", {}, { eventID: newEventId() });
  } catch {
    /* nunca quebrar navegação por causa de tracking */
  }
}
