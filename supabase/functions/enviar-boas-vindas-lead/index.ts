import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsappTextMessage, normalizePhoneNumber } from "../_shared/evolutionApiClient.ts";
import { buscarTemplate, renderizarTemplate } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceita CRON_SECRET (cron job) OU JWT de admin (chamada manual do CRM)
  const authHeader = req.headers.get('Authorization') || '';
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let isAdmin = false;
  if (!isCron && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      if (user) {
        const supabaseService = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const { data: roleData } = await supabaseService
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!roleData;
      }
    } catch (e) {
      console.error('[boas-vindas] Auth check error:', e);
    }
  }

  if (!isCron && !isAdmin) {
    console.error('[boas-vindas] Unauthorized');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Modo manual (admin) processa lote maior; cron mantém lote menor
    const fetchLimit = isAdmin ? 100 : 50;
    const processLimit = isAdmin ? 30 : 10;

    // Modo manual ignora janela de 5min para destravar leads antigos
    const cutoffMinutes = isAdmin ? 0 : 5;
    const cutoffISO = new Date(Date.now() - cutoffMinutes * 60 * 1000).toISOString();

    // Buscar leads que ainda estão como 'lead' e que NÃO possuem mensagem de boas_vindas
    const { data: leads, error } = await supabase
      .rpc('get_leads_sem_boas_vindas')
      .limit(fetchLimit);

    let leadsToProcess = leads;
    if (error) {
      console.log('[boas-vindas] RPC não encontrada, usando query direta...');

      const { data: rawLeads, error: rawError } = await supabase
        .from('agendamentos')
        .select('id, nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio')
        .eq('status_funil', 'lead')
        .lt('created_at', cutoffISO)
        .order('created_at', { ascending: true })
        .limit(fetchLimit);

      if (rawError) {
        console.error('[boas-vindas] Erro ao buscar leads:', rawError);
        return new Response(JSON.stringify({ error: rawError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!rawLeads || rawLeads.length === 0) {
        console.log('[boas-vindas] Nenhum lead pendente.');
        return new Response(JSON.stringify({ processed: 0, skipped: 0, total_pending: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
      console.log(`[boas-vindas] ${rawLeads.length} candidatos, ${rawLeads.length - leadsToProcess.length} já receberam, ${leadsToProcess.length} a processar.`);
    }

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log('[boas-vindas] Nenhum lead para enviar.');
      return new Response(JSON.stringify({ processed: 0, skipped: 0, total_pending: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalPending = leadsToProcess.length;
    console.log(`[boas-vindas] ${totalPending} lead(s) pendentes (modo: ${isAdmin ? 'manual' : 'cron'}).`);

    const template = await buscarTemplate('boas_vindas_lead');
    const templateFinal = template || `Olá, {{nome}}! Aqui é da clínica *Dr. Juliano Machado - Oftalmologista*. 👋\n\nVimos seu interesse em agendar uma {{tipo_atendimento}} no local *{{local}}*.\n\nQual data e horário seriam melhores para você? 📅\n\nAguardamos seu retorno! 🙏`;

    let enviados = 0;
    let falhas = 0;

    for (const lead of leadsToProcess.slice(0, processLimit)) {
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
          await supabase.from('agendamentos').update({ 
            status_crm: 'AGUARDANDO',
            updated_at: new Date().toISOString()
          }).eq('id', lead.id).eq('status_funil', 'lead');

          console.log(`[boas-vindas] ✓ Enviado para ${normalizedPhone} (lead ${lead.id}) → AGUARDANDO`);
          enviados++;
        } else {
          console.error(`[boas-vindas] ✗ Falha para ${normalizedPhone}:`, resultado.errorMessage);
          falhas++;
        }
      } catch (err) {
        console.error(`[boas-vindas] Erro ao processar lead ${lead.id}:`, err);
        falhas++;
      }
    }

    console.log(`[boas-vindas] Resumo: ${enviados} enviados, ${falhas} falhas, ${totalPending} pendentes total.`);
    return new Response(
      JSON.stringify({ processed: enviados, failed: falhas, total_pending: totalPending }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[boas-vindas] Erro geral:', err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
