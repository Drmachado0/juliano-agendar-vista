// Helper ManyChat (WhatsApp) — API oficial.
// Docs: https://api.manychat.com/swagger
// Fluxo: createSubscriberWhatsapp (ou buscar existente) → sendFlow.
//
// Usado pelo lembretes-runner para disparar lembretes anuais via um Flow
// pré-aprovado no ManyChat. O texto da mensagem é definido NO FLOW dentro
// do ManyChat — aqui só passamos o nome do paciente como custom field.

const MC_BASE = "https://api.manychat.com";

function getToken(): string {
  const t = Deno.env.get("MANYCHAT_API_TOKEN") || "";
  if (!t) throw new Error("MANYCHAT_API_TOKEN não configurado");
  return t;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

export function normalizePhoneBR(phone: string): string {
  let p = (phone || "").replace(/\D/g, "");
  if (!p.startsWith("55")) p = "55" + p;
  return p;
}

interface ManyChatResp<T = any> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

/** Busca subscriber existente pelo telefone WhatsApp. */
export async function findSubscriberByPhone(
  whatsappPhone: string,
): Promise<{ ok: boolean; subscriberId?: string; erro?: string; raw?: any }> {
  const url = `${MC_BASE}/fb/subscriber/findByCustomField?field_id=whatsapp_phone&field_value=${encodeURIComponent(whatsappPhone)}`;
  try {
    // Endpoint real para WhatsApp: /fb/subscriber/findBySystemField
    const r = await fetch(
      `${MC_BASE}/fb/subscriber/findBySystemField?field=phone&value=${encodeURIComponent("+" + whatsappPhone)}`,
      { method: "GET", headers: authHeaders() },
    );
    const raw = await r.json().catch(() => ({}));
    if (!r.ok || raw.status !== "success") {
      return { ok: false, erro: raw?.message || `HTTP ${r.status}`, raw };
    }
    const list = Array.isArray(raw.data) ? raw.data : [];
    if (list.length === 0) return { ok: true, subscriberId: undefined, raw };
    return { ok: true, subscriberId: String(list[0].id), raw };
  } catch (e: any) {
    return { ok: false, erro: e?.message || "erro_fetch" };
  }
}

/** Cria subscriber WhatsApp (ou retorna o existente). */
export async function createSubscriberWhatsapp(
  whatsappPhone: string,
  firstName?: string,
): Promise<{ ok: boolean; subscriberId?: string; erro?: string; raw?: any }> {
  try {
    const body: Record<string, unknown> = {
      whatsapp_phone: "+" + whatsappPhone,
      has_opt_in_sms: true,
      has_opt_in_email: false,
      consent_phrase: "Paciente em atendimento - opt-in registrado no agendamento.",
    };
    if (firstName) body.first_name = firstName;

    const r = await fetch(`${MC_BASE}/fb/subscriber/createSubscriber`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const raw = await r.json().catch(() => ({}));
    if (!r.ok || raw.status !== "success") {
      return { ok: false, erro: raw?.message || `HTTP ${r.status}`, raw };
    }
    const id = raw?.data?.id ?? raw?.data?.subscriber_id;
    return { ok: true, subscriberId: id ? String(id) : undefined, raw };
  } catch (e: any) {
    return { ok: false, erro: e?.message || "erro_fetch" };
  }
}

/** Dispara um Flow específico para o subscriber. */
export async function sendFlow(
  subscriberId: string,
  flowNs: string,
): Promise<{ ok: boolean; erro?: string; raw?: any }> {
  try {
    const r = await fetch(`${MC_BASE}/fb/sending/sendFlow`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subscriber_id: subscriberId, flow_ns: flowNs }),
    });
    const raw = await r.json().catch(() => ({}));
    if (!r.ok || raw.status !== "success") {
      return { ok: false, erro: raw?.message || `HTTP ${r.status}`, raw };
    }
    return { ok: true, raw };
  } catch (e: any) {
    return { ok: false, erro: e?.message || "erro_fetch" };
  }
}

/**
 * Conveniência: garante subscriber e dispara o flow.
 * Retorna no formato compatível com SendMessageResult do código legado.
 */
export async function enviarFlowManyChat(
  phone: string,
  flowNs: string,
  firstName?: string,
): Promise<{
  success: boolean;
  errorMessage?: string;
  messageId?: string;
  sanitizedResponse?: any;
}> {
  const wa = normalizePhoneBR(phone);

  // Tenta criar (idempotente — ManyChat retorna existente se já cadastrado).
  let subId: string | undefined;
  const created = await createSubscriberWhatsapp(wa, firstName);
  if (created.ok && created.subscriberId) {
    subId = created.subscriberId;
  } else {
    // Fallback: buscar
    const found = await findSubscriberByPhone(wa);
    if (found.ok && found.subscriberId) {
      subId = found.subscriberId;
    } else {
      return {
        success: false,
        errorMessage: `manychat_subscriber_falhou: ${created.erro || found.erro || "desconhecido"}`,
        sanitizedResponse: { create: created.raw, find: found.raw },
      };
    }
  }

  const sent = await sendFlow(subId, flowNs);
  if (!sent.ok) {
    return {
      success: false,
      errorMessage: `manychat_send_flow_falhou: ${sent.erro}`,
      sanitizedResponse: sent.raw,
    };
  }

  return {
    success: true,
    messageId: subId,
    sanitizedResponse: sent.raw,
  };
}
