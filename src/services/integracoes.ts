import { supabase } from "@/integrations/supabase/client";
import { Agendamento } from "./agendamentos";

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

    if (error) {
      console.error("[integracoes] Erro Supabase ao enviar WhatsApp:", error);
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && "success" in data && (data as any).success === false) {
      const dataAny: any = data;
      console.error("[integracoes] Função enviar-whatsapp retornou falha:", dataAny);
      return {
        success: false,
        error: dataAny.error || "Falha ao enviar mensagem via WhatsApp",
      };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[integracoes] Erro inesperado ao enviar WhatsApp:", err);
    return { success: false, error: err.message || "Erro desconhecido" };
  }
}

// WhatsApp Evolution API integration - Enviar imagem
export async function enviarImagemWhatsApp(
  telefone: string,
  imageBase64: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log("[integracoes] Preparando envio de imagem via WhatsApp", {
      telefone,
      temBase64: !!imageBase64,
      tamanhoBase64: imageBase64?.length,
    });

    // Remover prefixo data:image/...;base64, se presente
    let base64Puro = imageBase64;
    if (imageBase64 && imageBase64.includes(";base64,")) {
      base64Puro = imageBase64.split(";base64,")[1];
      console.log("[integracoes] Prefixo base64 removido, novo tamanho:", base64Puro.length);
    }

    const { data, error } = await supabase.functions.invoke("enviar-whatsapp-imagem", {
      body: { telefone, imageBase64: base64Puro },
    });

    console.log("[integracoes] Resposta da função enviar-whatsapp-imagem", { data, error });

    if (error) {
      console.error("[integracoes] Erro Supabase ao enviar imagem WhatsApp:", error);
      return { success: false, error: error.message };
    }

    if (data && typeof data === "object" && "success" in data && (data as any).success === false) {
      const dataAny: any = data;
      console.error("[integracoes] Função enviar-whatsapp-imagem retornou falha:", dataAny);
      return {
        success: false,
        error: dataAny.error || "Falha ao enviar imagem via WhatsApp",
      };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[integracoes] Erro inesperado ao enviar imagem WhatsApp:", err);
    return { success: false, error: err.message || "Erro desconhecido" };
  }
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
