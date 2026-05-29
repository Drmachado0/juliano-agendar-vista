// ============================================================================
// Helper compartilhado de envio Z-API
// ============================================================================
// Usado por TODAS as edge functions que precisam enviar mensagens de WhatsApp.
// O recebimento NÃO é feito aqui — o n8n recebe direto da Z-API.
// ============================================================================

export interface ZapiSendResult {
  ok: boolean;
  messageId?: string;
  erro?: string;
  status?: number;
  raw?: unknown;
}

interface ZapiConfig {
  baseUrl: string;
  instance: string;
  token: string;
  clientToken: string;
}

function getZapiConfig(): ZapiConfig {
  const baseUrl = (Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io").replace(/\/+$/, "");
  const instance = Deno.env.get("ZAPI_INSTANCE") || "";
  const token = Deno.env.get("ZAPI_TOKEN") || "";
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || "";
  if (!instance || !token || !clientToken) {
    throw new Error("Z-API não configurada (faltam ZAPI_INSTANCE / ZAPI_TOKEN / ZAPI_CLIENT_TOKEN).");
  }
  return { baseUrl, instance, token, clientToken };
}

/** Normaliza para formato internacional brasileiro (55 + DDD + número). */
export function normalizePhoneBR(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && !d.startsWith("55")) return "55" + d;
  return d;
}

/**
 * Envia uma mensagem de texto via Z-API.
 *   POST {ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-text
 *   Headers: Content-Type, Client-Token
 *   Body: { phone, message }
 */
export async function enviarTextoZapi(
  telefone: string,
  mensagem: string,
): Promise<ZapiSendResult> {
  let cfg: ZapiConfig;
  try {
    cfg = getZapiConfig();
  } catch (e: any) {
    console.error("[zapi] Config inválida:", e?.message);
    return { ok: false, erro: e?.message ?? "Config Z-API inválida" };
  }

  const phone = normalizePhoneBR(telefone);
  const url = `${cfg.baseUrl}/instances/${cfg.instance}/token/${cfg.token}/send-text`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": cfg.clientToken,
      },
      body: JSON.stringify({ phone, message: mensagem }),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      console.error(`[zapi] send-text HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return {
        ok: false,
        status: resp.status,
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
        raw: data,
      };
    }

    const messageId: string | undefined = data?.messageId ?? data?.id;
    return { ok: true, status: resp.status, messageId, raw: data };
  } catch (e: any) {
    console.error("[zapi] Exceção em send-text:", e?.message);
    return { ok: false, erro: e?.message ?? "Erro desconhecido" };
  }
}

/**
 * Envia uma imagem via Z-API.
 *   POST {ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-image
 *   Body: { phone, image (URL ou data URI base64), caption }
 */
export async function enviarImagemZapi(
  telefone: string,
  image: string,
  caption?: string,
): Promise<ZapiSendResult> {
  let cfg: ZapiConfig;
  try {
    cfg = getZapiConfig();
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Config Z-API inválida" };
  }

  const phone = normalizePhoneBR(telefone);
  const url = `${cfg.baseUrl}/instances/${cfg.instance}/token/${cfg.token}/send-image`;

  let imagePayload = image;
  if (image && !image.startsWith("http") && !image.startsWith("data:")) {
    imagePayload = `data:image/jpeg;base64,${image}`;
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": cfg.clientToken,
      },
      body: JSON.stringify({ phone, image: imagePayload, caption: caption ?? "" }),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      console.error(`[zapi] send-image HTTP ${resp.status}: ${text.slice(0, 300)}`);
      return {
        ok: false,
        status: resp.status,
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
        raw: data,
      };
    }

    const messageId: string | undefined = data?.messageId ?? data?.id;
    return { ok: true, status: resp.status, messageId, raw: data };
  } catch (e: any) {
    console.error("[zapi] Exceção em send-image:", e?.message);
    return { ok: false, erro: e?.message ?? "Erro desconhecido" };
  }
}

export interface ZapiPhoneExistsResult {
  ok: boolean;
  exists?: boolean;
  erro?: string;
  status?: number;
  raw?: unknown;
}

/**
 * Verifica se um número existe no WhatsApp via Z-API.
 *   GET {ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/phone-exists/{phone}
 *   Headers: Client-Token
 *   Resposta: { exists: boolean }
 */
export async function verificarNumeroZapi(
  telefone: string,
): Promise<ZapiPhoneExistsResult> {
  let cfg: ZapiConfig;
  try {
    cfg = getZapiConfig();
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Config Z-API inválida" };
  }

  const phone = normalizePhoneBR(telefone);
  const url = `${cfg.baseUrl}/instances/${cfg.instance}/token/${cfg.token}/phone-exists/${phone}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "Client-Token": cfg.clientToken },
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
        raw: data,
      };
    }
    const exists = data?.exists === true || data?.exists === "true";
    return { ok: true, status: resp.status, exists, raw: data };
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Erro desconhecido" };
  }
}

