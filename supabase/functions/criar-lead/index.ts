import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsappTextMessage, normalizePhoneNumber } from "../_shared/evolutionApiClient.ts";
import { buscarTemplate, renderizarTemplate } from "../_shared/templateRenderer.ts";

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

    // === ENVIO AUTOMÁTICO DE WHATSAPP ===
    try {
      console.log('[criar-lead] Preparando mensagem automática de boas-vindas...');

      const template = await buscarTemplate('boas_vindas_lead');
      
      // Fallback caso template não exista
      const templateFinal = template || `Olá, {{nome}}! Aqui é da clínica *Dr. Juliano Machado - Oftalmologista*. 👋\n\nVimos seu interesse em agendar uma {{tipo_atendimento}} no local *{{local}}*.\n\nQual data e horário seriam melhores para você? 📅\n\nAguardamos seu retorno! 🙏`;

      const mensagem = renderizarTemplate(templateFinal, {
        nome: data.nome_completo.trim().split(' ')[0], // Primeiro nome
        tipo_atendimento: data.tipo_atendimento.toLowerCase(),
        local: data.local_atendimento,
        convenio: data.convenio,
      });

      console.log('[criar-lead] Mensagem renderizada, enviando via WhatsApp...');

      const resultado = await sendWhatsappTextMessage(phoneClean, mensagem);

      // Persistir mensagem na tabela mensagens_whatsapp
      const normalizedPhone = normalizePhoneNumber(phoneClean);
      await supabase.from('mensagens_whatsapp').insert({
        agendamento_id: lead.id,
        telefone: normalizedPhone,
        direcao: 'OUT',
        conteudo: mensagem,
        status_envio: resultado.success ? 'enviado' : 'erro',
        mensagem_externa_id: resultado.messageId || null,
        error_message: resultado.errorMessage || null,
        tipo_mensagem: 'boas_vindas',
      });

      if (resultado.success) {
        console.log('[criar-lead] ✓ Mensagem de boas-vindas enviada com sucesso');
      } else {
        console.error('[criar-lead] ✗ Falha ao enviar mensagem:', resultado.errorMessage);
      }
    } catch (whatsappError) {
      // Não falhar a criação do lead por erro no WhatsApp
      console.error('[criar-lead] Erro ao enviar WhatsApp (não-bloqueante):', whatsappError);
    }

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
