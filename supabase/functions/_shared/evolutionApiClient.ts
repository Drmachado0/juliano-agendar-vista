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
}

/**
 * Obtém a configuração da Evolution API a partir das variáveis de ambiente
 * @throws Error se alguma variável obrigatória não estiver configurada
 */
export function getEvolutionConfig(): EvolutionConfig {
  const baseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
  const instance = Deno.env.get('EVOLUTION_API_INSTANCE') || 'Agente ia';
  const token = Deno.env.get('EVOLUTION_API_TOKEN');

  if (!baseUrl) {
    throw new Error('EVOLUTION_API_BASE_URL não está configurada. Configure nas secrets do Supabase.');
  }

  if (!token) {
    throw new Error('EVOLUTION_API_TOKEN não está configurada. Configure nas secrets do Supabase.');
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
    instance,
    token
  };
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
    const config = getEvolutionConfig();
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

    if (!response.ok) {
      console.error(`[Evolution API] Erro HTTP ${response.status}:`, responseData);
      return {
        success: false,
        rawResponse: responseData,
        errorMessage: `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
      };
    }

    console.log('[Evolution API] Mensagem enviada com sucesso:', responseData);
    
    // Tentar extrair o ID da mensagem da resposta
    let messageId: string | undefined;
    if (responseData && typeof responseData === 'object') {
      const data = responseData as Record<string, unknown>;
      if (data.key && typeof data.key === 'object') {
        const keyData = data.key as Record<string, unknown>;
        messageId = keyData.id as string | undefined;
      }
    }
    
    return {
      success: true,
      rawResponse: responseData,
      messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Evolution API] Exceção:', errorMessage);
    
    return {
      success: false,
      errorMessage,
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
  professionalName: string = 'Dr. Juliano Machado'
): string {
  const formattedDate = formatDateBR(date);
  const formattedTime = formatTimeBR(time);
  
  return `Olá, ${patientName}! 👋✨

🗓️ Você possui um *agendamento* confirmado:

📅 Data: *${formattedDate}*
⏰ Horário: *${formattedTime}*
👨‍⚕️ Profissional: *${professionalName}*
📍 Local: *${location}*

⚠️ *Importante:* O atendimento será por *ordem de chegada*. Recomendamos chegar com antecedência para garantir seu lugar!

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
