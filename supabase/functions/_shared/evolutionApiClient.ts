// Cliente Evolution API Centralizado
// Módulo compartilhado para todas as edge functions que usam Evolution API

export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  token: string;
}

export interface SendMessageResult {
  success: boolean;
  rawResponse?: unknown;
  errorMessage?: string;
  messageId?: string;
  /** Status bruto retornado pela Evolution (ex.: PENDING, SERVER_ACK, DELIVERY_ACK, READ, ERROR) */
  evolutionStatus?: string;
  /** Status confiável e normalizado para persistir em mensagens_whatsapp.status_envio */
  deliveryStatus?: 'enviado' | 'entregue' | 'lido' | 'pendente' | 'erro';
  /** Indica se o envio é considerado "confirmado" para automações (true só para enviado/entregue/lido) */
  confirmed?: boolean;
  /** rawResponse já sanitizada (sem apikey/token/secret) */
  sanitizedResponse?: unknown;
}

/**
 * Remove campos sensíveis (apikey/token/secret/authorization) de qualquer objeto/payload
 * antes de persistir em banco ou log.
 */
export function sanitizePayload(input: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]';
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => sanitizePayload(v, depth + 1));
  if (typeof input !== 'object') return input;

  const SENSITIVE = /^(apikey|api_key|token|access_token|refresh_token|secret|authorization|auth|password|bearer)$/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizePayload(v, depth + 1);
    }
  }
  return out;
}

/**
 * Mapeia status bruto da Evolution para nosso status_envio confiável.
 * Apenas DELIVERY_ACK/READ contam como "entrega confirmada".
 * SERVER_ACK = apenas aceito pelo servidor WhatsApp, sem confirmação de entrega ao destinatário → pendente.
 * PENDING/sem status = pendente; ERROR = erro.
 */
export function mapEvolutionStatusToDelivery(
  rawStatus?: string,
): { deliveryStatus: 'enviado' | 'entregue' | 'lido' | 'pendente' | 'erro'; confirmed: boolean } {
  const s = (rawStatus || '').toUpperCase();
  if (s === 'READ' || s === 'PLAYED') return { deliveryStatus: 'lido', confirmed: true };
  if (s === 'DELIVERY_ACK' || s === 'DELIVERED') return { deliveryStatus: 'entregue', confirmed: true };
  // SERVER_ACK / SENT: aceito pelo servidor, mas NÃO confirma entrega → pendente, aguarda DELIVERY_ACK
  if (s === 'SERVER_ACK' || s === 'SENT') return { deliveryStatus: 'enviado', confirmed: false };
  if (s === 'ERROR' || s === 'FAILED') return { deliveryStatus: 'erro', confirmed: false };
  // PENDING / vazio / desconhecido → pendente, NÃO confirmado
  return { deliveryStatus: 'pendente', confirmed: false };
}

// NOTA: O envio de WhatsApp é 100% via n8n → ManyChat.
// Helpers legados foram apagados; use ./whatsappSender.ts diretamente quando possível.



/**
 * Normaliza número de telefone para formato brasileiro
 * Remove caracteres não numéricos e garante formato 55 + DDD + número
 * @param rawPhone Telefone em qualquer formato
 * @returns Telefone normalizado (apenas dígitos, com DDI 55)
 */
export function normalizePhoneNumber(rawPhone: string): string {
  // Remove tudo que não é dígito
  let digits = rawPhone.replace(/\D/g, '');
  
  // Se começar com +, já foi removido, então verificar se tem DDI
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  // Se não tem DDI, adicionar 55 (Brasil)
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  
  // Se já tem 12 ou 13 dígitos, assumir que está correto
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) {
      return '55' + digits;
    }
    return digits;
  }
  
  // Fallback: retornar como está
  return digits;
}

/**
 * ============================================================================
 * Envio de WhatsApp → n8n → ManyChat
 * ============================================================================
 * Mantemos a assinatura legada (sendWhatsappTextMessage, SendMessageResult)
 * para evitar refatorações em cascata. Internamente delegamos para o helper
 * único em ../_shared/whatsappSender.ts.
 *
 * Receber mensagens NÃO é responsabilidade desta camada — o n8n cuida do
 * recebimento.
 * ============================================================================
 */

import { enviarTextoWhatsapp, enviarImagemWhatsapp } from "./whatsappSender.ts";

/** Envia mensagem de TEXTO via WhatsApp (delega ao helper único). */
export async function sendWhatsappTextMessage(
  phone: string,
  body: string
): Promise<SendMessageResult> {
  const r = await enviarTextoWhatsapp(phone, body);
  const sanitized = sanitizePayload(r.raw);
  if (!r.ok) {
    return {
      success: false,
      rawResponse: r.raw,
      sanitizedResponse: sanitized,
      errorMessage: r.erro,
      evolutionStatus: 'ERROR',
      deliveryStatus: 'erro',
      confirmed: false,
    };
  }
  return {
    success: true,
    rawResponse: r.raw,
    sanitizedResponse: sanitized,
    messageId: r.messageId,
    evolutionStatus: 'SENT',
    deliveryStatus: 'enviado',
    confirmed: false,
  };
}

/** Envia IMAGEM via WhatsApp (delega ao helper único). */
export async function sendWhatsappImageMessage(
  phone: string,
  image: string,
  caption?: string
): Promise<SendMessageResult> {
  const r = await enviarImagemWhatsapp(phone, image, caption);
  const sanitized = sanitizePayload(r.raw);
  if (!r.ok) {
    return {
      success: false,
      rawResponse: r.raw,
      sanitizedResponse: sanitized,
      errorMessage: r.erro,
      evolutionStatus: 'ERROR',
      deliveryStatus: 'erro',
      confirmed: false,
    };
  }
  return {
    success: true,
    rawResponse: r.raw,
    sanitizedResponse: sanitized,
    messageId: r.messageId,
    evolutionStatus: 'SENT',
    deliveryStatus: 'enviado',
    confirmed: false,
  };
}



/**
 * Formata data para exibição amigável (DD/MM/YYYY)
 */
export function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formata hora para exibição amigável (HH:MM)
 */
export function formatTimeBR(timeStr: string): string {
  return timeStr.substring(0, 5);
}

/**
 * Constrói mensagem de confirmação de agendamento
 */
export function buildAppointmentConfirmationMessage(
  patientName: string,
  date: string,
  time: string,
  location: string,
  professionalName: string = 'Dr. Juliano Machado',
  statusLink?: string
): string {
  const formattedDate = formatDateBR(date);
  const formattedTime = formatTimeBR(time);
  const statusLine = statusLink ? `\n🔗 Acompanhe seu agendamento: ${statusLink}\n` : '';

  return `Olá, ${patientName}! 👋✨

🗓️ Você possui um *agendamento* confirmado:

📅 Data: *${formattedDate}*
⏰ Horário: *${formattedTime}*
👨‍⚕️ Profissional: *${professionalName}*
📍 Local: *${location}*

⚠️ *Importante:* O atendimento será por *ordem de chegada*. Recomendamos chegar com antecedência para garantir seu lugar!
${statusLine}
Se não puder comparecer, avise-nos com antecedência. Agradecemos a preferência! 🙏💙`;
}

/**
 * Constrói mensagem de resposta automática para confirmação
 */
export function buildConfirmationReplyMessage(): string {
  return `✅ Sua presença foi *confirmada*!

Obrigado por confirmar. Aguardamos você no horário marcado.

Se precisar reagendar, entre em contato conosco. 📞`;
}

/**
 * Constrói mensagem de resposta automática para cancelamento
 */
export function buildCancellationReplyMessage(): string {
  return `❌ Seu agendamento foi *cancelado*.

Caso queira remarcar, entre em contato conosco pelo WhatsApp ou ligue para a clínica.

Obrigado pela compreensão! 🙏`;
}
