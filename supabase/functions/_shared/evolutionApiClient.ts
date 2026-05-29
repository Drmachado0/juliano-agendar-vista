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

// Cache em memória da config (TTL 30s) para evitar SELECT por chamada
let _configCache: { value: EvolutionConfig; expiresAt: number } | null = null;
const CONFIG_TTL_MS = 30_000;

export function invalidateEvolutionConfigCache(): void {
  _configCache = null;
}

/**
 * Versão SÍNCRONA legada — lê apenas das ENV vars (fallback puro).
 * Mantida para compatibilidade. Prefira `getEvolutionConfigAsync()`.
 */
export function getEvolutionConfig(): EvolutionConfig {
  const baseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
  const instance = Deno.env.get('EVOLUTION_API_INSTANCE');
  const token = Deno.env.get('EVOLUTION_API_TOKEN');

  if (!baseUrl) throw new Error('EVOLUTION_API_BASE_URL não configurada.');
  if (!instance) throw new Error('EVOLUTION_API_INSTANCE não configurada.');
  if (!token) throw new Error('EVOLUTION_API_TOKEN não configurada.');

  return { baseUrl: baseUrl.replace(/\/$/, ''), instance, token };
}

/**
 * Lê a config da tabela `integracoes_evolution` via RPC (cache 30s).
 * Faz fallback para variáveis de ambiente se a tabela estiver vazia
 * ou se algo falhar (zero-downtime durante a migração).
 */
export async function getEvolutionConfigAsync(): Promise<EvolutionConfig> {
  const now = Date.now();
  if (_configCache && _configCache.expiresAt > now) {
    return _configCache.value;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  let dbConfig: EvolutionConfig | null = null;
  if (supabaseUrl && serviceKey) {
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/obter_evolution_config_interna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: '{}',
      });
      if (resp.ok) {
        const data = await resp.json();
        const baseUrl = (data?.base_url || '').replace(/\/+$/, '');
        const instance = data?.instance || '';
        const token = data?.token || '';
        if (baseUrl && instance && token) {
          dbConfig = { baseUrl, instance, token };
        }
      } else {
        console.warn('[EvolutionConfig] RPC falhou, fallback p/ env. Status:', resp.status);
      }
    } catch (err) {
      console.warn('[EvolutionConfig] Erro lendo RPC, fallback p/ env:', err);
    }
  }

  const final: EvolutionConfig = dbConfig ?? {
    baseUrl: (Deno.env.get('EVOLUTION_API_BASE_URL') || '').replace(/\/+$/, ''),
    instance: Deno.env.get('EVOLUTION_API_INSTANCE') || '',
    token: Deno.env.get('EVOLUTION_API_TOKEN') || '',
  };

  if (!final.baseUrl || !final.instance || !final.token) {
    throw new Error(
      'Credenciais Evolution não configuradas. Configure em /admin/configuracoes/evolution.'
    );
  }

  _configCache = { value: final, expiresAt: now + CONFIG_TTL_MS };
  return final;
}

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
 * MIGRAÇÃO: Evolution API → Z-API
 * ============================================================================
 * Os helpers abaixo mantêm o MESMO contrato/assinatura usado pelas edge functions
 * existentes (sendWhatsappTextMessage, SendMessageResult, etc.), mas agora
 * enviam mensagens pela Z-API. Isso evita refatorações em cascata em todas
 * as funções que já consomem essa API.
 *
 * Receber mensagens NÃO é responsabilidade desta camada — o n8n recebe direto
 * da Z-API.
 * ============================================================================
 */

interface ZapiConfig {
  baseUrl: string;
  instance: string;
  token: string;
  clientToken: string;
}

export function getZapiConfig(): ZapiConfig {
  const baseUrl = (Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io').replace(/\/+$/, '');
  const instance = Deno.env.get('ZAPI_INSTANCE') || '';
  const token = Deno.env.get('ZAPI_TOKEN') || '';
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  if (!instance || !token || !clientToken) {
    throw new Error('Z-API não configurada (faltam ZAPI_INSTANCE / ZAPI_TOKEN / ZAPI_CLIENT_TOKEN).');
  }
  return { baseUrl, instance, token, clientToken };
}

/**
 * Envia uma mensagem de TEXTO via Z-API.
 * Mantém a assinatura/contrato originais (success/messageId/deliveryStatus...).
 */
export async function sendWhatsappTextMessage(
  phone: string,
  body: string
): Promise<SendMessageResult> {
  try {
    const cfg = getZapiConfig();
    const normalizedPhone = normalizePhoneNumber(phone);
    const url = `${cfg.baseUrl}/instances/${cfg.instance}/token/${cfg.token}/send-text`;

    console.log(`[Z-API] send-text → ${normalizedPhone}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': cfg.clientToken,
      },
      body: JSON.stringify({ phone: normalizedPhone, message: body }),
    });

    const responseText = await response.text();
    let responseData: unknown;
    try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }
    const sanitized = sanitizePayload(responseData);

    if (!response.ok) {
      console.error(`[Z-API] Erro HTTP ${response.status}: ${responseText.slice(0, 300)}`);
      return {
        success: false,
        rawResponse: responseData,
        sanitizedResponse: sanitized,
        errorMessage: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
        evolutionStatus: 'ERROR',
        deliveryStatus: 'erro',
        confirmed: false,
      };
    }

    const data = (responseData && typeof responseData === 'object') ? responseData as Record<string, unknown> : {};
    const messageId = (data.messageId as string | undefined) ?? (data.id as string | undefined);

    // Z-API não retorna ACK no momento do envio; consideramos "enviado" (aceito).
    return {
      success: true,
      rawResponse: responseData,
      sanitizedResponse: sanitized,
      messageId,
      evolutionStatus: 'SENT',
      deliveryStatus: 'enviado',
      confirmed: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Z-API] Exceção em send-text:', errorMessage);
    return {
      success: false,
      errorMessage,
      evolutionStatus: 'ERROR',
      deliveryStatus: 'erro',
      confirmed: false,
    };
  }
}

/**
 * Envia uma IMAGEM via Z-API.
 * `image` pode ser uma URL pública ou um data URI base64 (data:image/...;base64,XXX).
 */
export async function sendWhatsappImageMessage(
  phone: string,
  image: string,
  caption?: string
): Promise<SendMessageResult> {
  try {
    const cfg = getZapiConfig();
    const normalizedPhone = normalizePhoneNumber(phone);
    const url = `${cfg.baseUrl}/instances/${cfg.instance}/token/${cfg.token}/send-image`;

    // Z-API aceita URL pública ou data URI base64.
    let imagePayload = image;
    if (image && !image.startsWith('http') && !image.startsWith('data:')) {
      imagePayload = `data:image/jpeg;base64,${image}`;
    }

    console.log(`[Z-API] send-image → ${normalizedPhone}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': cfg.clientToken,
      },
      body: JSON.stringify({ phone: normalizedPhone, image: imagePayload, caption: caption ?? '' }),
    });

    const responseText = await response.text();
    let responseData: unknown;
    try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }
    const sanitized = sanitizePayload(responseData);

    if (!response.ok) {
      console.error(`[Z-API] Erro HTTP ${response.status} em send-image: ${responseText.slice(0, 300)}`);
      return {
        success: false,
        rawResponse: responseData,
        sanitizedResponse: sanitized,
        errorMessage: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
        evolutionStatus: 'ERROR',
        deliveryStatus: 'erro',
        confirmed: false,
      };
    }

    const data = (responseData && typeof responseData === 'object') ? responseData as Record<string, unknown> : {};
    const messageId = (data.messageId as string | undefined) ?? (data.id as string | undefined);

    return {
      success: true,
      rawResponse: responseData,
      sanitizedResponse: sanitized,
      messageId,
      evolutionStatus: 'SENT',
      deliveryStatus: 'enviado',
      confirmed: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Z-API] Exceção em send-image:', errorMessage);
    return {
      success: false,
      errorMessage,
      evolutionStatus: 'ERROR',
      deliveryStatus: 'erro',
      confirmed: false,
    };
  }
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
