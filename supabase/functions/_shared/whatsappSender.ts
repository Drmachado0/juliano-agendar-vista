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
    return { ok: false, erro: e?.message ?? "Config de WhatsApp inválida" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.secret) headers["X-Webhook-Secret"] = cfg.secret;

    const resp = await fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      console.error(`[whatsapp] ${action} HTTP ${resp.status}: ${text.slice(0, 300)}`);
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
      return {
        ok: false,
        status: resp.status,
        erro: data?.erro ?? data?.error ?? "Falha reportada pelo n8n",
        raw: data,
      };
    }

    return { ok: true, status: resp.status, messageId, exists, raw: data };
  } catch (e: any) {
    console.error(`[whatsapp] Exceção em ${action}:`, e?.message);
    return { ok: false, erro: e?.message ?? "Erro desconhecido" };
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
