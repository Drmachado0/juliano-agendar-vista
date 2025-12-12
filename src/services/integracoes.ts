import { supabase } from "@/integrations/supabase/client";
import { Agendamento } from "./agendamentos";

// WhatsApp Evolution API integration
export async function enviarMensagemWhatsApp(
  telefone: string, 
  mensagem: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
      body: { telefone, mensagem }
    });

    if (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Erro ao enviar WhatsApp:', err);
    return { success: false, error: err.message || 'Erro desconhecido' };
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
