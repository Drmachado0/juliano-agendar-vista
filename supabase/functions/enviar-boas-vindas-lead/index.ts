import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsappTextMessage, normalizePhoneNumber } from "../_shared/evolutionApiClient.ts";
import { buscarTemplate, renderizarTemplate } from "../_shared/templateRenderer.ts";

Deno.serve(async (req) => {
  // Autenticação via CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('[boas-vindas] Unauthorized');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar leads criados há mais de 5 minutos que ainda estão como 'lead'
    // e que NÃO possuem mensagem de boas_vindas enviada para o mesmo telefone
    const { data: leads, error } = await supabase
      .rpc('get_leads_sem_boas_vindas')
      .limit(10);

    // Fallback: query direta se a RPC não existir
    let leadsToProcess = leads;
    if (error) {
      console.log('[boas-vindas] RPC não encontrada, usando query direta...');

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: rawLeads, error: rawError } = await supabase
        .from('agendamentos')
        .select('id, nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio')
        .eq('status_funil', 'lead')
        .lt('created_at', fiveMinAgo)
        .order('created_at', { ascending: true })
        .limit(20);

      if (rawError) {
        console.error('[boas-vindas] Erro ao buscar leads:', rawError);
        return new Response(JSON.stringify({ error: rawError.message }), { status: 500 });
      }

      if (!rawLeads || rawLeads.length === 0) {
        console.log('[boas-vindas] Nenhum lead pendente.');
        return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
      }

      // Filtrar os que já receberam boas_vindas
      const phones = rawLeads.map(l => normalizePhoneNumber(l.telefone_whatsapp));
      const { data: jaEnviados } = await supabase
        .from('mensagens_whatsapp')
        .select('telefone')
        .eq('tipo_mensagem', 'boas_vindas')
        .eq('direcao', 'OUT')
        .in('telefone', phones);

      const phonesJaEnviados = new Set((jaEnviados || []).map(m => m.telefone));
      leadsToProcess = rawLeads.filter(l => !phonesJaEnviados.has(normalizePhoneNumber(l.telefone_whatsapp)));
    }

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log('[boas-vindas] Nenhum lead para enviar.');
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    console.log(`[boas-vindas] ${leadsToProcess.length} lead(s) para processar.`);

    const template = await buscarTemplate('boas_vindas_lead');
    const templateFinal = template || `Olá, {{nome}}! Aqui é da clínica *Dr. Juliano Machado - Oftalmologista*. 👋\n\nVimos seu interesse em agendar uma {{tipo_atendimento}} no local *{{local}}*.\n\nQual data e horário seriam melhores para você? 📅\n\nAguardamos seu retorno! 🙏`;

    let enviados = 0;

    for (const lead of leadsToProcess.slice(0, 10)) {
      try {
        const primeiroNome = lead.nome_completo.trim().split(' ')[0];
        const mensagem = renderizarTemplate(templateFinal, {
          nome: primeiroNome,
          tipo_atendimento: lead.tipo_atendimento.toLowerCase(),
          local: lead.local_atendimento,
          convenio: lead.convenio,
        });

        const phoneClean = lead.telefone_whatsapp.replace(/\D/g, '');
        const resultado = await sendWhatsappTextMessage(phoneClean, mensagem);
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
          // Mover lead para "AGUARDANDO" no CRM
          await supabase.from('agendamentos').update({ 
            status_crm: 'AGUARDANDO',
            updated_at: new Date().toISOString()
          }).eq('id', lead.id).eq('status_funil', 'lead');

          console.log(`[boas-vindas] ✓ Enviado para ${normalizedPhone} (lead ${lead.id}) → AGUARDANDO`);
          enviados++;
        } else {
          console.error(`[boas-vindas] ✗ Falha para ${normalizedPhone}:`, resultado.errorMessage);
        }
      } catch (err) {
        console.error(`[boas-vindas] Erro ao processar lead ${lead.id}:`, err);
      }
    }

    console.log(`[boas-vindas] Resumo: ${enviados}/${leadsToProcess.length} enviados.`);
    return new Response(JSON.stringify({ processed: enviados }), { status: 200 });

  } catch (err) {
    console.error('[boas-vindas] Erro geral:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 });
  }
});
