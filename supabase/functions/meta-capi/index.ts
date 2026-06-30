// Meta Conversions API (CAPI) — Server-side event forwarder
// Pixel: 1003792428067622 (Pixel site Dr Juliano)
// BM:    493850516412413 (DrJulianomachado)
//
// Recebe payload de evento, hashea PII (SHA-256), captura IP real e User Agent,
// e envia para Meta CAPI com event_id que faz dedup com o pixel browser (GTM).
//
// Secrets necessários (Supabase Dashboard → Edge Functions → Manage Secrets):
//   META_PIXEL_ID            = 1003792428067622
//   META_CAPI_ACCESS_TOKEN   = (Events Manager → Settings → Conversions API → Generate Token)
//   META_TEST_EVENT_CODE     = (opcional — só durante testes; remover em prod)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { logSystem } from "../_shared/systemLogger.ts";

// Códigos de erro da Graph API que indicam rate limit / throttling.
// Refs: https://developers.facebook.com/docs/marketing-api/error-reference
const RATE_LIMIT_CODES = new Set<number>([4, 17, 32, 613, 80004, 80014]);

function classifyMetaError(metaJson: any, httpStatus: number): {
  level: "warn" | "error" | "critical";
  reason: string;
} {
  const code = metaJson?.error?.code;
  const subcode = metaJson?.error?.error_subcode;
  if (typeof code === "number" && RATE_LIMIT_CODES.has(code)) {
    return { level: "warn", reason: `rate_limit (code=${code}${subcode ? `, subcode=${subcode}` : ""})` };
  }
  if (httpStatus === 401 || httpStatus === 403 || code === 190) {
    return { level: "critical", reason: `auth/token (code=${code}, http=${httpStatus})` };
  }
  if (httpStatus >= 500) {
    return { level: "warn", reason: `meta_5xx (http=${httpStatus})` };
  }
  return { level: "error", reason: `meta_4xx (code=${code}, http=${httpStatus})` };
}

const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN");
const TEST_EVENT_CODE = Deno.env.get("META_TEST_EVENT_CODE");
const META_API_VERSION = "v19.0";

const STANDARD_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "Lead",
  "Schedule",
  "Contact",
  "CompleteRegistration",
  "Search",
  "AddToWishlist",
  "InitiateCheckout",
  "Purchase",
  "Subscribe",
]);

interface CapiPayload {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_data?: {
    em?: string;
    ph?: string;
    fn?: string;
    ln?: string;
    ct?: string;
    st?: string;
    zp?: string;
    country?: string;
    external_id?: string;
    fbc?: string;
    fbp?: string;
    client_user_agent?: string;
  };
  custom_data?: {
    content_name?: string;
    content_category?: string;
    value?: number;
    currency?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

async function hashUserData(
  raw: NonNullable<CapiPayload["user_data"]>,
  clientIp: string,
  fallbackUserAgent: string,
) {
  const hashed: Record<string, string | string[]> = {};

  if (raw.em) hashed.em = [await sha256(raw.em)];
  if (raw.ph) hashed.ph = [await sha256(normalizePhone(raw.ph))];
  if (raw.fn) hashed.fn = [await sha256(raw.fn)];
  if (raw.ln) hashed.ln = [await sha256(raw.ln)];
  if (raw.ct) hashed.ct = [await sha256(raw.ct.replace(/\s+/g, ""))];
  if (raw.st) hashed.st = [await sha256(raw.st)];
  if (raw.zp) hashed.zp = [await sha256(raw.zp.replace(/\D/g, ""))];
  if (raw.country) hashed.country = [await sha256(raw.country)];
  if (raw.external_id) hashed.external_id = [await sha256(raw.external_id)];

  if (raw.fbc) hashed.fbc = raw.fbc;
  if (raw.fbp) hashed.fbp = raw.fbp;
  if (clientIp) hashed.client_ip_address = clientIp;

  const ua = raw.client_user_agent ?? fallbackUserAgent;
  if (ua) hashed.client_user_agent = ua;

  return hashed;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error("[meta-capi] Missing PIXEL_ID or ACCESS_TOKEN env vars");
    logSystem({
      level: "critical",
      category: "edge_function",
      source: "meta-capi",
      message: "Secrets ausentes: META_PIXEL_ID/META_CAPI_ACCESS_TOKEN",
      details: { pixel_id_set: !!PIXEL_ID, token_set: !!ACCESS_TOKEN },
    });
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: CapiPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    event_name,
    event_id,
    event_source_url,
    user_data = {},
    custom_data = {},
  } = payload;

  if (!event_name || !event_id || !event_source_url) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: event_name, event_id, event_source_url",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!STANDARD_EVENTS.has(event_name)) {
    console.warn(`[meta-capi] Non-standard event: ${event_name}`);
  }

  const clientIp = getClientIp(req);
  const fallbackUserAgent = req.headers.get("user-agent") ?? "";

  const hashedUserData = await hashUserData(user_data, clientIp, fallbackUserAgent);

  const event = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    event_source_url,
    action_source: "website",
    user_data: hashedUserData,
    custom_data: {
      ...(custom_data.value !== undefined && { value: custom_data.value }),
      ...(custom_data.currency && { currency: custom_data.currency }),
      ...(custom_data.content_name && { content_name: custom_data.content_name }),
      ...(custom_data.content_category && { content_category: custom_data.content_category }),
      ...(custom_data.utm_source && { utm_source: custom_data.utm_source }),
      ...(custom_data.utm_medium && { utm_medium: custom_data.utm_medium }),
      ...(custom_data.utm_campaign && { utm_campaign: custom_data.utm_campaign }),
      ...(custom_data.utm_content && { utm_content: custom_data.utm_content }),
      ...(custom_data.utm_term && { utm_term: custom_data.utm_term }),
    },
  };

  const body: Record<string, unknown> = {
    data: [event],
    access_token: ACCESS_TOKEN,
  };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${META_API_VERSION}/${PIXEL_ID}/events`;

  try {
    const metaRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error("[meta-capi] Meta CAPI error:", metaJson);
      return new Response(
        JSON.stringify({ error: "Meta CAPI rejected event", details: metaJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[meta-capi] OK ${event_name} event_id=${event_id} fbtrace=${metaJson.fbtrace_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_id,
        event_name,
        events_received: metaJson.events_received,
        fbtrace_id: metaJson.fbtrace_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[meta-capi] Network/fetch error:", err);
    return new Response(JSON.stringify({ error: "Failed to reach Meta CAPI" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
