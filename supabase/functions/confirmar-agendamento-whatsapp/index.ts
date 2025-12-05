import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de validação
const requestSchema = z.object({
  agendamento_id: z.string().uuid(),
  telefone: z.string().min(10).max(20),
  nome_completo: z.string().min(2).max(200),
  data_agendamento: z.string(),
  hora_agendamento: z.string(),
  local_atendimento: z.string(),
  tipo_atendimento: z.string().optional(),
});

function formatarTelefone(telefone: string): string {
  const apenasNumeros = telefone.replace(/\D/g, '');
  if (apenasNumeros.startsWith('55')) {
    return apenasNumeros;
  }
  return '55' + apenasNumeros;
}

function formatarData(dataStr: string): string {
  try {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch {
    return dataStr;
  }
}

function formatarHora(horaStr: string): string {
  return horaStr.slice(0, 5);
}

function gerarMensagemConfirmacao(dados: z.infer<typeof requestSchema>): string {
  const dataFormatada = formatarData(dados.data_agendamento);
  const horaFormatada = formatarHora(dados.hora_agendamento);
  
  return `Olá ${dados.nome_completo}! 👋

Recebemos seu pedido de agendamento na clínica *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* ${dataFormatada}
🕐 *Horário:* ${horaFormatada}
📍 *Local:* ${dados.local_atendimento}

Nossa equipe entrará em contato para confirmar seu horário.

Qualquer dúvida, responda esta mensagem!`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Recebido pedido de confirmação:', JSON.stringify(body));

    // Validar dados
    const dados = requestSchema.parse(body);
    console.log('Dados validados:', dados.agendamento_id);

    // Configurações da Evolution API
    const evolutionBaseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
    const evolutionToken = Deno.env.get('EVOLUTION_API_TOKEN');

    if (!evolutionBaseUrl || !evolutionToken) {
      console.error('Variáveis de ambiente da Evolution não configuradas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração da API WhatsApp não encontrada' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar telefone e mensagem
    const telefoneFormatado = formatarTelefone(dados.telefone);
    const mensagem = gerarMensagemConfirmacao(dados);

    console.log('Enviando mensagem para:', telefoneFormatado);

    // Enviar mensagem via Evolution API
    const evolutionUrl = `${evolutionBaseUrl}/message/sendText/Site`;
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
    console.log('Resposta Evolution:', JSON.stringify(evolutionResult));

    if (!evolutionResponse.ok) {
      throw new Error(`Evolution API error: ${JSON.stringify(evolutionResult)}`);
    }

    // Criar cliente Supabase para salvar mensagem
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Salvar mensagem no banco
    const { error: msgError } = await supabase
      .from('mensagens_whatsapp')
      .insert({
        agendamento_id: dados.agendamento_id,
        telefone: dados.telefone,
        direcao: 'OUT',
        conteudo: mensagem,
        status_envio: 'enviado',
        tipo_mensagem: 'confirmacao_automatica',
        mensagem_externa_id: evolutionResult?.key?.id || null,
      });

    if (msgError) {
      console.error('Erro ao salvar mensagem:', msgError);
    } else {
      console.log('Mensagem salva com sucesso');
    }

    // Atualizar agendamento com confirmacao_enviada = true
    const { error: updateError } = await supabase
      .from('agendamentos')
      .update({ confirmacao_enviada: true })
      .eq('id', dados.agendamento_id);

    if (updateError) {
      console.error('Erro ao atualizar agendamento:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Confirmação enviada com sucesso',
        mensagem_id: evolutionResult?.key?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função confirmar-agendamento-whatsapp:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
