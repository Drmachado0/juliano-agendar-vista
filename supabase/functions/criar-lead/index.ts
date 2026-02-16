import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadData {
  nome_completo: string;
  telefone_whatsapp: string;
  data_nascimento?: string;
  email?: string;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia?: string;
  local_atendimento: string;
  convenio: string;
  convenio_outro?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const data: LeadData = await req.json();
    
    console.log('[criar-lead] Dados recebidos:', JSON.stringify(data));

    // Validação básica
    if (!data.nome_completo || !data.telefone_whatsapp || !data.tipo_atendimento || !data.local_atendimento || !data.convenio) {
      console.error('[criar-lead] Campos obrigatórios faltando');
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const phoneClean = data.telefone_whatsapp.replace(/\D/g, '');

    // Criar lead
    const { data: lead, error } = await supabase
      .from('agendamentos')
      .insert({
        nome_completo: data.nome_completo.trim(),
        telefone_whatsapp: phoneClean,
        data_nascimento: data.data_nascimento || null,
        email: data.email?.trim() || null,
        tipo_atendimento: data.tipo_atendimento,
        detalhe_exame_ou_cirurgia: data.detalhe_exame_ou_cirurgia || null,
        local_atendimento: data.local_atendimento,
        convenio: data.convenio,
        convenio_outro: data.convenio_outro || null,
        status_crm: 'NOVO LEAD',
        status_funil: 'lead',
        origem: 'site',
        data_agendamento: null,
        hora_agendamento: null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar lead:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar lead', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead criado com sucesso:', lead.id);
    // Mensagem de boas-vindas será enviada pela função agendada (enviar-boas-vindas-lead)
    // após 5 minutos de delay, evitando duplicatas e envios prematuros.

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
