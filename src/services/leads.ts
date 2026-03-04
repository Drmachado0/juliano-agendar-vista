import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  nome_completo: string;
  telefone_whatsapp: string;
  data_nascimento?: string | null;
  email?: string | null;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia?: string | null;
  local_atendimento: string;
  convenio: string;
  convenio_outro?: string | null;
}

export async function criarLead(data: LeadData): Promise<{ lead_id: string | null; error: Error | null }> {
  try {
    const { data: responseData, error } = await supabase.functions.invoke('criar-lead', {
      body: data,
    });

    if (error) {
      console.error('Erro ao criar lead:', error);
      return { lead_id: null, error: new Error(error.message || 'Erro ao criar lead') };
    }

    if (responseData?.error) {
      console.error('Erro retornado pela edge function:', responseData.error);
      return { lead_id: null, error: new Error(responseData.error) };
    }

    return { lead_id: responseData?.lead_id || null, error: null };
  } catch (err) {
    console.error('Erro inesperado ao criar lead:', err);
    return { lead_id: null, error: err as Error };
  }
}

export async function converterLeadEmAgendamento(
  leadId: string, 
  data: {
    data_agendamento: string;
    hora_agendamento: string;
    aceita_primeiro_horario?: boolean;
    aceita_contato_whatsapp_email?: boolean;
  },
  localAtendimento: string
): Promise<{ error: Error | null }> {
  try {
    console.log('[converterLeadEmAgendamento] Chamando edge function converter-lead-agendamento...');
    
    const { data: responseData, error } = await supabase.functions.invoke('converter-lead-agendamento', {
      body: {
        lead_id: leadId,
        data_agendamento: data.data_agendamento,
        hora_agendamento: data.hora_agendamento,
        local_atendimento: localAtendimento,
        aceita_primeiro_horario: data.aceita_primeiro_horario ?? false,
        aceita_contato_whatsapp_email: data.aceita_contato_whatsapp_email ?? false,
      },
    });

    if (error) {
      console.error('[converterLeadEmAgendamento] Erro na invocação:', error);
      return { error: new Error(error.message || 'Erro ao confirmar agendamento') };
    }

    if (responseData?.error) {
      console.error('[converterLeadEmAgendamento] Erro retornado:', responseData.error);
      return { error: new Error(responseData.error) };
    }

    if (responseData?.success) {
      console.log('[converterLeadEmAgendamento] Conversão realizada com sucesso');
      return { error: null };
    }

    return { error: new Error('Resposta inesperada do servidor') };
  } catch (err) {
    console.error('Erro inesperado ao converter lead:', err);
    return { error: err as Error };
  }
}
