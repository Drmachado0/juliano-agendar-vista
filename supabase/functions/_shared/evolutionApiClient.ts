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
 * Envia uma mensagem de texto via Evolution API
 * @param phone Número do telefone (será normalizado automaticamente)
 * @param body Texto da mensagem
 * @returns Resultado do envio com sucesso/erro e dados da resposta
 */
export async function sendWhatsappTextMessage(
  phone: string, 
  body: string
): Promise<SendMessageResult> {
  try {
    const config = await getEvolutionConfigAsync();
    const normalizedPhone = normalizePhoneNumber(phone);
    
    const url = `${config.baseUrl}/message/sendText/${config.instance}`;
    
    console.log(`[Evolution API] Enviando mensagem para ${normalizedPhone}`);
    console.log(`[Evolution API] URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.token,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: body,
      }),
    });

    const responseText = await response.text();
    let responseData: unknown;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    const sanitized = sanitizePayload(responseData);

    if (!response.ok) {
      console.error(`[Evolution API] Erro HTTP ${response.status}`);
      return {
        success: false,
        rawResponse: responseData,
        sanitizedResponse: sanitized,
        errorMessage: `HTTP ${response.status}`,
        evolutionStatus: 'ERROR',
        deliveryStatus: 'erro',
        confirmed: false,
      };
    }

    console.log('[Evolution API] Mensagem aceita pelo servidor');

    // Tentar extrair o ID e o status da mensagem da resposta
    let messageId: string | undefined;
    let evolutionStatus: string | undefined;
    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;
      if (data.key && typeof data.key === 'object') {
        const keyData = data.key as Record<string, unknown>;
        messageId = keyData.id as string | undefined;
      }
      if (typeof data.status === 'string') {
        evolutionStatus = data.status;
      } else if (typeof data.messageStatus === 'string') {
        evolutionStatus = data.messageStatus;
      }
    }

    const { deliveryStatus, confirmed } = mapEvolutionStatusToDelivery(evolutionStatus);

    return {
      success: true,
      rawResponse: responseData,
      sanitizedResponse: sanitized,
      messageId,
      evolutionStatus,
      deliveryStatus,
      confirmed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Evolution API] Exceção:', errorMessage);

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
