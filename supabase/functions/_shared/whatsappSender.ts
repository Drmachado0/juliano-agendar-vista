// ============================================================================
// Helper compartilhado de envio de WhatsApp
// ============================================================================
// Usado por TODAS as edge functions que precisam enviar mensagens de WhatsApp.
//
// O provedor de mensagens (ManyChat) é orquestrado pelo n8n: estas funções
// apenas disparam o payload para um webhook do n8n, que cuida de
// subscriber / flow / template / janela de 24h. O RECEBIMENTO também é
// tratado pelo n8n — não é responsabilidade desta camada.
//
// Configuração (secrets do backend):
//   N8N_WHATSAPP_WEBHOOK_URL  → URL do webhook do n8n que envia o WhatsApp.
//   N8N_WEBHOOK_SECRET        → (opcional) segredo enviado no header
//                               X-Webhook-Secret para o n8n validar a origem.
// O token do ManyChat fica no n8n, não aqui.
// ============================================================================

export interface WhatsappSendResult {
  ok: boolean;
  messageId?: string;
  erro?: string;
  status?: number;
  raw?: unknown;
}

interface WebhookConfig {
  url: string;
  secret: string;
}

const N8N_TIMEOUT_MS = Number(Deno.env.get("N8N_WHATSAPP_TIMEOUT_MS") || "15000");

function getWebhookConfig(): WebhookConfig {
  const url = (Deno.env.get("N8N_WHATSAPP_WEBHOOK_URL") || "").trim();
  const secret = Deno.env.get("N8N_WEBHOOK_SECRET") || "";
  if (!url) {
    throw new Error("WhatsApp não configurado (falta N8N_WHATSAPP_WEBHOOK_URL).");
  }
  return { url, secret };
}

/** Normaliza para formato internacional brasileiro (55 + DDD + número). */
export function normalizePhoneBR(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && !d.startsWith("55")) return "55" + d;
  return d;
}

interface N8nDispatchResult extends WhatsappSendResult {
  exists?: boolean;
}

type FailureKind =
  | "config_missing"
  | "timeout"
  | "network"
  | "http_4xx"
  | "http_5xx"
  | "unauthorized_secret"
  | "logical_error";

/**
 * Classifica a falha e devolve o nível para system_logs.
 * - critical → exige ação humana (config ausente, 5xx persistente, secret inválido)
 * - error    → falha que afeta entrega (4xx, lógico)
 * - warn     → transiente (timeout, rede)
 */
function classifyFailure(kind: FailureKind): "warn" | "error" | "critical" {
  if (kind === "config_missing" || kind === "http_5xx" || kind === "unauthorized_secret") return "critical";
  if (kind === "timeout" || kind === "network") return "warn";
  return "error";
}

/**
 * Grava falha em system_logs (fire-and-forget). Nunca lança.
 * Usa service role; não bloqueia o fluxo principal.
 */
function logFailure(
  action: string,
  kind: FailureKind,
  details: Record<string, unknown>,
): void {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const level = classifyFailure(kind);
    const body = {
      level,
      category: "edge_function",
      source: "whatsapp-n8n",
      message: `n8n webhook falhou (${action}): ${kind}`,
      details: { action, failure_kind: kind, ...details },
    };

    // fire-and-forget — sem await
    fetch(`${url}/rest/v1/system_logs`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    }).catch((e) => {
      console.warn("[whatsapp] falha ao gravar system_logs:", e?.message);
    });
  } catch (e: any) {
    console.warn("[whatsapp] logFailure exceção:", e?.message);
  }
}

/** Mascara dados sensíveis em payloads antes de logar. */
function safeDetailsForLog(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "phone" && typeof v === "string") {
      out.phone_masked = "***" + v.slice(-4);
    } else if (k === "message" && typeof v === "string") {
      out.message_preview = v.slice(0, 80);
    } else if (k === "image") {
      out.has_image = true;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Dispara uma ação de WhatsApp para o webhook do n8n.
 * O n8n decide como falar com o ManyChat (flow/template/conteúdo).
 * Espera-se uma resposta flexível, ex.:
 *   { ok|success: true, messageId|id: "...", exists?: boolean }
 */
async function dispararN8n(
  action: string,
  payload: Record<string, unknown>,
): Promise<N8nDispatchResult> {
  let cfg: WebhookConfig;
  try {
    cfg = getWebhookConfig();
  } catch (e: any) {
    console.error("[whatsapp] Config inválida:", e?.message);
    logFailure(action, "config_missing", { error: e?.message });
    return { ok: false, erro: e?.message ?? "Config de WhatsApp inválida" };
  }

  const safeDetails = safeDetailsForLog(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.secret) headers["X-Webhook-Secret"] = cfg.secret;

    const resp = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const elapsed_ms = Date.now() - startedAt;
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      const kind: FailureKind = resp.status >= 500 ? "http_5xx" : "http_4xx";
      console.error(`[whatsapp] ${action} HTTP ${resp.status}: ${text.slice(0, 300)}`);
      logFailure(action, kind, {
        http_status: resp.status,
        elapsed_ms,
        response_preview: text.slice(0, 300),
        ...safeDetails,
      });
      return {
        ok: false,
        status: resp.status,
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
        raw: data,
      };
    }

    // Falha lógica reportada pelo n8n no corpo (HTTP 200 mas ok/success === false)
    const okLogico = data?.ok !== false && data?.success !== false;
    const messageId: string | undefined = data?.messageId ?? data?.id ?? undefined;
    const exists = data?.exists === true || data?.exists === "true";

    if (!okLogico) {
      const erro = data?.erro ?? data?.error ?? "Falha reportada pelo n8n";
      logFailure(action, "logical_error", {
        http_status: resp.status,
        elapsed_ms,
        n8n_error: erro,
        response_preview: text.slice(0, 300),
        ...safeDetails,
      });
      return {
        ok: false,
        status: resp.status,
        erro,
        raw: data,
      };
    }

    return { ok: true, status: resp.status, messageId, exists, raw: data };
  } catch (e: any) {
    clearTimeout(timer);
    const elapsed_ms = Date.now() - startedAt;
    const aborted = e?.name === "AbortError";
    const kind: FailureKind = aborted ? "timeout" : "network";
    console.error(`[whatsapp] Exceção em ${action}${aborted ? " (timeout)" : ""}:`, e?.message);
    logFailure(action, kind, {
      elapsed_ms,
      timeout_ms: N8N_TIMEOUT_MS,
      error: e?.message ?? String(e),
      ...safeDetails,
    });
    return {
      ok: false,
      erro: aborted
        ? `Timeout (${N8N_TIMEOUT_MS}ms) no webhook do n8n`
        : (e?.message ?? "Erro desconhecido"),
    };
  }
}


/**
 * Envia uma mensagem de TEXTO via WhatsApp (n8n → ManyChat).
 */
export async function enviarTextoWhatsapp(
  telefone: string,
  mensagem: string,
): Promise<WhatsappSendResult> {
  const phone = normalizePhoneBR(telefone);
  const r = await dispararN8n("send-text", { phone, message: mensagem });
  return { ok: r.ok, messageId: r.messageId, erro: r.erro, status: r.status, raw: r.raw };
}

/**
 * Envia uma IMAGEM via WhatsApp (n8n → ManyChat).
 * `image` pode ser uma URL pública ou um data URI base64.
 */
export async function enviarImagemWhatsapp(
  telefone: string,
  image: string,
  caption?: string,
): Promise<WhatsappSendResult> {
  const phone = normalizePhoneBR(telefone);

  let imagePayload = image;
  if (image && !image.startsWith("http") && !image.startsWith("data:")) {
    imagePayload = `data:image/jpeg;base64,${image}`;
  }

  const r = await dispararN8n("send-image", {
    phone,
    image: imagePayload,
    caption: caption ?? "",
  });
  return { ok: r.ok, messageId: r.messageId, erro: r.erro, status: r.status, raw: r.raw };
}

export interface WhatsappPhoneExistsResult {
  ok: boolean;
  exists?: boolean;
  erro?: string;
  status?: number;
  raw?: unknown;
}

/**
 * Verifica se um número existe no WhatsApp.
 * Encaminhado ao n8n (action "phone-exists"). Observação: o ManyChat não
 * expõe um endpoint público de phone-exists; cabe ao n8n decidir a estratégia
 * (ou responder indisponível).
 */
export async function verificarNumeroWhatsapp(
  telefone: string,
): Promise<WhatsappPhoneExistsResult> {
  const phone = normalizePhoneBR(telefone);
  const r = await dispararN8n("phone-exists", { phone });
  return { ok: r.ok, exists: r.exists, erro: r.erro, status: r.status, raw: r.raw };
}
