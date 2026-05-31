import { useEffect, useState } from "react";
import { fetchSiteConfig } from "@/services/siteConfig";
import {
  DEFAULT_WHATSAPP_RAW,
  buildTelLink,
  buildWaLink,
  buildWaLinkBare,
  formatWhatsAppDisplay,
} from "@/lib/whatsappNumber";

// Cache global do número para evitar refetch em cada componente.
let cachedNumber: string | null = null;
let inflight: Promise<string> | null = null;
const subscribers = new Set<(n: string) => void>();

function notifyAll(n: string) {
  cachedNumber = n;
  subscribers.forEach((cb) => cb(n));
}

async function loadOnce(): Promise<string> {
  if (cachedNumber) return cachedNumber;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await fetchSiteConfig();
    const n = data?.whatsapp_number?.trim() || DEFAULT_WHATSAPP_RAW;
    notifyAll(n);
    return n;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Força a atualização do cache global após salvar no admin. */
export function refreshSiteWhatsApp() {
  cachedNumber = null;
  inflight = null;
  loadOnce();
}

export interface SiteWhatsApp {
  raw: string; // só dígitos, ex "5591980690617"
  display: string; // "(91) 98069-0617"
  telLink: string; // "tel:+55..."
  waLink: (message?: string) => string;
  waLinkBare: string;
  loaded: boolean;
}

export function useSiteWhatsApp(): SiteWhatsApp {
  const [raw, setRaw] = useState<string>(cachedNumber || DEFAULT_WHATSAPP_RAW);
  const [loaded, setLoaded] = useState<boolean>(!!cachedNumber);

  useEffect(() => {
    const sub = (n: string) => {
      setRaw(n);
      setLoaded(true);
    };
    subscribers.add(sub);
    if (!cachedNumber) {
      loadOnce().then(sub).catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  return {
    raw,
    display: formatWhatsAppDisplay(raw),
    telLink: buildTelLink(raw),
    waLink: (message?: string) => buildWaLink(raw, message),
    waLinkBare: buildWaLinkBare(raw),
    loaded,
  };
}
