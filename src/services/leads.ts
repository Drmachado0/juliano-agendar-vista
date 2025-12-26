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
    // *** VALIDATE AVAILABILITY BEFORE CONVERTING ***
    console.log('[converterLeadEmAgendamento] Validando disponibilidade...');
    
    const { data: validacao, error: validacaoError } = await supabase.functions.invoke('validar-agendamento', {
      body: {
        local_atendimento: localAtendimento,
        data_agendamento: data.data_agendamento,
        hora_agendamento: data.hora_agendamento,
      },
    });

    if (validacaoError) {
      console.error('[converterLeadEmAgendamento] Erro ao validar:', validacaoError);
      return { error: new Error('Erro ao verificar disponibilidade do horário') };
    }

    if (!validacao?.disponivel) {
      console.log('[converterLeadEmAgendamento] Horário indisponível:', validacao?.motivo);
      return { 
        error: new Error(validacao?.motivo || 'Este horário não está mais disponível. Por favor, escolha outro horário.')
      };
    }

    console.log('[converterLeadEmAgendamento] Disponibilidade confirmada, convertendo lead...');

    // Determina o status_crm com base no local
    let statusCrm = 'NOVO LEAD';
    const locationLower = localAtendimento.toLowerCase();
    
    if (locationLower.includes("clinicor")) {
      statusCrm = "CLINICOR";
    } else if (locationLower.includes("hgp") || locationLower.includes("hospital geral")) {
      statusCrm = "HGP";
    } else if (locationLower.includes("belém") || locationLower.includes("belem") || locationLower.includes("iob") || locationLower.includes("vitria")) {
      statusCrm = "BELÉM";
    }

    const { error } = await supabase
      .from('agendamentos')
      .update({
        data_agendamento: data.data_agendamento,
        hora_agendamento: data.hora_agendamento,
        aceita_primeiro_horario: data.aceita_primeiro_horario ?? false,
        aceita_contato_whatsapp_email: data.aceita_contato_whatsapp_email ?? false,
        status_funil: 'agendado',
        status_crm: statusCrm,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) {
      console.error('Erro ao converter lead em agendamento:', error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error('Erro inesperado ao converter lead:', err);
    return { error: err as Error };
  }
}
