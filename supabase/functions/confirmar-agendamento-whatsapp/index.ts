import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { gerarMensagemDoTemplate, formatarData, formatarHora } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação - aceita agendamento_id OU agendamento_data diretamente
const requestSchemaById = z.object({
  agendamento_id: z.string().uuid(),
});

const agendamentoDataSchema = z.object({
  nome_completo: z.string().min(1),
  telefone_whatsapp: z.string().min(10),
  tipo_atendimento: z.string().optional(),
  local_atendimento: z.string().min(1),
  data_agendamento: z.string().min(1),
  hora_agendamento: z.string().min(1),
  convenio: z.string().optional(),
});

const requestSchemaByData = z.object({
  agendamento_data: agendamentoDataSchema,
});

function formatarTelefone(telefone: string): string {
  const apenasNumeros = telefone.replace(/\D/g, '');
  if (apenasNumeros.startsWith('55')) {
    return apenasNumeros;
  }
  return '55' + apenasNumeros;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[ConfirmarWhatsApp] Recebido pedido:', JSON.stringify(body));

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let agendamentoData: {
      nome_completo: string;
      telefone_whatsapp: string;
      tipo_atendimento?: string;
      local_atendimento: string;
      data_agendamento: string;
      hora_agendamento: string;
      aceita_contato_whatsapp_email?: boolean;
    };
    let agendamentoId: string | null = null;

    // Tentar primeiro com agendamento_data (para chamadas do formulário público)
    const byDataResult = requestSchemaByData.safeParse(body);
    
    if (byDataResult.success) {
      // Dados passados diretamente - não precisa buscar do banco
      agendamentoData = {
        ...byDataResult.data.agendamento_data,
        aceita_contato_whatsapp_email: true, // Assume true when data is passed directly
      };
      console.log('[ConfirmarWhatsApp] Usando dados diretos para:', agendamentoData.nome_completo);
    } else {
      // Tentar com agendamento_id (para chamadas do admin ou outras)
      const byIdResult = requestSchemaById.safeParse(body);
      
      if (!byIdResult.success) {
        console.error('[ConfirmarWhatsApp] Dados inválidos:', byDataResult.error, byIdResult.error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Dados inválidos: forneça agendamento_id ou agendamento_data' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agendamentoId = byIdResult.data.agendamento_id;
      console.log('[ConfirmarWhatsApp] Buscando agendamento por ID:', agendamentoId);

      // Buscar dados do agendamento
      const { data: agendamento, error: fetchError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('id', agendamentoId)
        .single();

      if (fetchError || !agendamento) {
        console.error('[ConfirmarWhatsApp] Erro ao buscar agendamento:', fetchError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Agendamento não encontrado' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agendamentoData = agendamento;
      console.log('[ConfirmarWhatsApp] Agendamento encontrado:', agendamento.nome_completo);
    }

    // Verificar se aceita contato WhatsApp (skip check if data was passed directly)
    if (agendamentoId && agendamentoData.aceita_contato_whatsapp_email === false) {
      console.log('[ConfirmarWhatsApp] Paciente não aceita contato WhatsApp');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Paciente não aceita contato por WhatsApp',
          skipped: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configurações da Evolution API
    const evolutionBaseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
    const evolutionToken = Deno.env.get('EVOLUTION_API_TOKEN');
    const evolutionInstance = Deno.env.get('EVOLUTION_API_INSTANCE') || 'Agente ia';

    if (!evolutionBaseUrl || !evolutionToken) {
      console.error('[ConfirmarWhatsApp] Variáveis de ambiente da Evolution não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da API WhatsApp não encontrada' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar telefone e gerar mensagem do template
    const telefoneFormatado = formatarTelefone(agendamentoData.telefone_whatsapp);
    
    // Buscar template do banco e renderizar
    const mensagem = await gerarMensagemDoTemplate('confirmacao_agendamento', {
      nome: agendamentoData.nome_completo,
      data: formatarData(agendamentoData.data_agendamento),
      hora: formatarHora(agendamentoData.hora_agendamento),
      local: agendamentoData.local_atendimento,
      tipo_atendimento: agendamentoData.tipo_atendimento,
    });

    console.log('[ConfirmarWhatsApp] Enviando para:', telefoneFormatado);

    // Enviar mensagem via Evolution API
    const baseUrlClean = evolutionBaseUrl.replace(/\/+$/, '');
    const evolutionUrl = `${baseUrlClean}/message/sendText/${evolutionInstance}`;
    console.log('[ConfirmarWhatsApp] Evolution URL:', evolutionUrl);
    
    const evolutionResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionToken,
      },
      body: JSON.stringify({
        number: telefoneFormatado,
        text: mensagem,
      }),
    });

    const evolutionResult = await evolutionResponse.json();
    console.log('[ConfirmarWhatsApp] Resposta Evolution:', JSON.stringify(evolutionResult));

    if (!evolutionResponse.ok) {
      throw new Error(`Evolution API error: ${JSON.stringify(evolutionResult)}`);
    }

    // Salvar mensagem no banco (sem agendamento_id se não temos)
    const { error: msgError } = await supabase
      .from('mensagens_whatsapp')
      .insert({
        agendamento_id: agendamentoId, // Pode ser null
        telefone: agendamentoData.telefone_whatsapp,
        direcao: 'OUT',
        conteudo: mensagem,
        status_envio: 'enviado',
        tipo_mensagem: 'confirmacao_automatica',
        mensagem_externa_id: evolutionResult?.key?.id || null,
      });

    if (msgError) {
      console.error('[ConfirmarWhatsApp] Erro ao salvar mensagem:', msgError);
    } else {
      console.log('[ConfirmarWhatsApp] Mensagem salva com sucesso');
    }

    // Atualizar agendamento com confirmacao_enviada = true (apenas se temos o ID)
    if (agendamentoId) {
      const { error: updateError } = await supabase
        .from('agendamentos')
        .update({ confirmacao_enviada: true })
        .eq('id', agendamentoId);

      if (updateError) {
        console.error('[ConfirmarWhatsApp] Erro ao atualizar agendamento:', updateError);
      }
    }

    console.log('[ConfirmarWhatsApp] ✅ Confirmação enviada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Confirmação enviada com sucesso',
        telefone: telefoneFormatado,
        mensagem_id: evolutionResult?.key?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ConfirmarWhatsApp] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});