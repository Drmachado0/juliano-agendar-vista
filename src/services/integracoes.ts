import { supabase } from "@/integrations/supabase/client";
import { Agendamento } from "./agendamentos";
import { compressImage, formatFileSize } from "@/lib/imageCompression";

// Helper to extract user-friendly error message from API response
function extractUserFriendlyError(data: any): string {
  // Check for userMessage from our improved edge function
  if (data?.userMessage) {
    return data.userMessage;
  }
  
  // Check for error string
  if (data?.error && typeof data.error === "string") {
    // Map known error codes to friendly messages
    const errorMap: Record<string, string> = {
      "CONNECTION_CLOSED": "WhatsApp desconectado. Verifique a instância e tente novamente.",
      "TIMEOUT": "Tempo limite excedido. Tente novamente.",
      "AUTH_ERROR": "Erro de autenticação. Contate o suporte.",
      "INSTANCE_NOT_FOUND": "Instância não encontrada. Verifique a configuração.",
      "NOT_CONNECTED": "WhatsApp não conectado. Escaneie o QR Code.",
      "MAX_RETRIES": "Falha após várias tentativas. Tente mais tarde.",
    };
    
    if (errorMap[data.error]) {
      return errorMap[data.error];
    }
  }
  
  // Fallback to generic message
  return data?.error || "Erro ao enviar mensagem. Tente novamente.";
}

// WhatsApp Evolution API integration - Enviar texto
export async function enviarMensagemWhatsApp(
  telefone: string, 
  mensagem: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const preview = mensagem.length > 80 ? mensagem.slice(0, 77) + "..." : mensagem;
    console.log("[integracoes] Iniciando envio de texto via WhatsApp", {
      telefone,
      preview,
    });

    const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
      body: { telefone, mensagem },
    });

    console.log("[integracoes] Resposta da função enviar-whatsapp", { data, error });

    // Supabase invoke error (network, etc)
    if (error) {
      console.error("[integracoes] Erro Supabase ao enviar WhatsApp:", error);
      return { 
        success: false, 
        error: "Erro de conexão com o servidor. Verifique sua internet e tente novamente." 
      };
    }

    // Edge function returned error
    if (data && typeof data === "object" && "success" in data && data.success === false) {
      console.error("[integracoes] Função enviar-whatsapp retornou falha:", data);
      const friendlyError = extractUserFriendlyError(data);
      return { success: false, error: friendlyError };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[integracoes] Erro inesperado ao enviar WhatsApp:", err);
    return { 
      success: false, 
      error: "Erro inesperado. Tente novamente em alguns instantes." 
    };
  }
}

// Upload image to Supabase Storage and get public URL
async function uploadImageToStorage(imageBase64: string): Promise<{ url: string | null; error: string | null }> {
  try {
    // Compress the image first
    console.log("[integracoes] Comprimindo imagem antes do upload...");
    const compressed = await compressImage(imageBase64);
    console.log("[integracoes] Imagem comprimida:", {
      originalSize: formatFileSize(compressed.originalSize),
      compressedSize: formatFileSize(compressed.compressedSize),
      dimensions: `${compressed.width}x${compressed.height}`,
    });

    // Generate unique filename
    const filename = `whatsapp_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = filename;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('whatsapp-images')
      .upload(filePath, compressed.blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error("[integracoes] Erro ao fazer upload da imagem:", error);
      return { url: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('whatsapp-images')
      .getPublicUrl(data.path);

    console.log("[integracoes] Imagem uploaded com sucesso:", urlData.publicUrl);
    return { url: urlData.publicUrl, error: null };
  } catch (err: any) {
    console.error("[integracoes] Erro ao processar imagem para upload:", err);
    return { url: null, error: err.message || "Erro ao processar imagem" };
  }
}

// Helper function for retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[integracoes] Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[integracoes] Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// WhatsApp Evolution API integration - Enviar imagem (com caption opcional)
// Agora usa Storage + URL + compressão + retry + fallback para base64
export async function enviarImagemWhatsApp(
  telefone: string,
  imageBase64: string,
  caption?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log("[integracoes] Preparando envio de imagem via WhatsApp (com Storage)", {
      telefone,
      temBase64: !!imageBase64,
      tamanhoBase64Original: imageBase64?.length,
      temCaption: !!caption,
    });

    // Compress the image first (for fallback)
    const compressed = await compressImage(imageBase64);
    const compressedBase64 = await blobToBase64(compressed.blob);
    
    console.log("[integracoes] Imagem comprimida:", {
      originalSize: formatFileSize(compressed.originalSize),
      compressedSize: formatFileSize(compressed.compressedSize),
      dimensions: `${compressed.width}x${compressed.height}`,
    });

    // Upload image to storage and get public URL
    const { url: imageUrl, error: uploadError } = await uploadImageToStorage(imageBase64);
    
    if (uploadError || !imageUrl) {
      console.warn("[integracoes] Falha no upload, usando apenas base64:", uploadError);
    } else {
      console.log("[integracoes] URL do Storage:", imageUrl);
    }

    // Send with retry mechanism - sends BOTH url and base64 for server-side fallback
    const result = await retryWithBackoff(async () => {
      const { data, error } = await supabase.functions.invoke("enviar-whatsapp-imagem", {
        body: { 
          telefone, 
          imageUrl: imageUrl || undefined,  // URL (preferred)
          imageBase64: compressedBase64,     // Base64 (fallback)
          caption 
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === "object" && "success" in data && (data as any).success === false) {
        throw new Error((data as any).error || "Falha ao enviar imagem via WhatsApp");
      }

      return { success: true, error: null };
    }, 3, 2000);

    console.log("[integracoes] Imagem enviada com sucesso");
    return result;
  } catch (err: any) {
    console.error("[integracoes] Erro ao enviar imagem WhatsApp:", err);
    return { success: false, error: err.message || "Erro desconhecido" };
  }
}

// Helper to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Return just the base64 part without data URL prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// n8n Webhook notification
export async function notificarN8n(
  evento: 'agendamento_criado' | 'status_crm_atualizado',
  dadosAgendamento: Partial<Agendamento>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('notificar-n8n', {
      body: { evento, dados_agendamento: dadosAgendamento }
    });

    if (error) {
      console.error('Erro ao notificar n8n:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Erro ao notificar n8n:', err);
    return { success: false, error: err.message || 'Erro desconhecido' };
  }
}

// Generate AI-powered confirmation message
export async function gerarMensagemConfirmacaoIA(
  agendamento: Partial<Agendamento>
): Promise<{ mensagem: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('gerar-mensagem-confirmacao', {
      body: { 
        agendamento: {
          nome_completo: agendamento.nome_completo,
          tipo_atendimento: agendamento.tipo_atendimento,
          local_atendimento: agendamento.local_atendimento,
          data_agendamento: agendamento.data_agendamento,
          hora_agendamento: agendamento.hora_agendamento,
          convenio: agendamento.convenio,
        }
      }
    });

    if (error) {
      console.error('Erro ao gerar mensagem com IA:', error);
      return { mensagem: null, error: error.message };
    }

    return { mensagem: data?.mensagem || null, error: null };
  } catch (err: any) {
    console.error('Erro ao gerar mensagem com IA:', err);
    return { mensagem: null, error: err.message || 'Erro desconhecido' };
  }
}

// Generate default WhatsApp message (fallback)
export function gerarMensagemPadrao(agendamento: Agendamento): string {
  if (!agendamento.data_agendamento || !agendamento.hora_agendamento) {
    return `Olá, ${agendamento.nome_completo}! Aqui é da clínica Dr. Juliano Machado. Vimos seu interesse em agendar uma consulta no local ${agendamento.local_atendimento}. Qual data e horário seriam melhores para você?`;
  }
  
  const dataFormatada = new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR');
  const horaFormatada = agendamento.hora_agendamento.slice(0, 5);
  
  return `Olá, ${agendamento.nome_completo}! Aqui é da clínica Dr. Juliano Machado. Recebemos seu pedido de agendamento para ${dataFormatada} às ${horaFormatada} no local ${agendamento.local_atendimento}. Vamos confirmar seu horário por aqui. Tudo bem?`;
}
