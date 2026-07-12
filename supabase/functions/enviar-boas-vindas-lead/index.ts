import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsappTextMessage, normalizePhoneNumber, sanitizePayload } from "../_shared/evolutionApiClient.ts";
import { buscarTemplate, renderizarTemplate } from "../_shared/templateRenderer.ts";
import { isKnownInvalidWhatsapp } from "../_shared/whatsappGuards.ts";
import { podeEnviarOutbound, LIMITES_PADRAO, logarBloqueioRateLimit } from "../_shared/rateLimitOutbound.ts";
import { envioAutomaticoLiberado } from "../_shared/envioStatusGlobal.ts";
import { requireCronSecret } from "../_shared/authGuards.ts";


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

    // KILL SWITCH: se admin acionou "Parar tudo agora", bloqueia envios automáticos.
    const killSwitch = await envioAutomaticoLiberado(supabase);
    if (!killSwitch.liberado) {
      console.warn(`[boas-vindas] 🛑 Bloqueado pelo kill switch: ${killSwitch.motivo}`);
      return new Response(
        JSON.stringify({ processed: 0, skipped: 0, total_pending: 0, blocked: true, reason: killSwitch.motivo }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Modo manual (admin) processa lote maior; cron mantém lote menor
    const fetchLimit = isAdmin ? 100 : 50;
    const processLimit = isAdmin ? 30 : 10;

    // Modo manual ignora janela de 5min para destravar leads antigos
    const cutoffMinutes = isAdmin ? 0 : 5;
    const cutoffISO = new Date(Date.now() - cutoffMinutes * 60 * 1000).toISOString();

    // Buscar leads que ainda estão como NOVO LEAD e que NÃO possuem mensagem
    // de boas_vindas (independente de status_envio: enviado/pendente/erro).
    // Isso evita reenvios em loop quando uma tentativa anterior ficou pendente
    // ou com erro — esses casos vão para PRECISA_DE_HUMANO/retry separado.
    const { data: leads, error } = await supabase
      .rpc('get_leads_sem_boas_vindas', { p_cutoff_minutes: cutoffMinutes })
      .limit(fetchLimit);

    let leadsToProcess: any[] | null = leads ?? null;

    if (error) {
      console.log('[boas-vindas] RPC indisponível, usando query direta:', error.message);

      const { data: rawLeads, error: rawError } = await supabase
        .from('agendamentos')
        .select('id, nome_completo, telefone_whatsapp, tipo_atendimento, local_atendimento, convenio')
        .eq('status_funil', 'lead')
        .eq('status_crm', 'NOVO LEAD')
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

      // Dedup por agendamento_id (NÃO por telefone) — uma só tentativa por lead
      const leadIds = rawLeads.map((l) => l.id);
      const { data: jaEnviados } = await supabase
        .from('mensagens_whatsapp')
        .select('agendamento_id')
        .eq('tipo_mensagem', 'boas_vindas')
        .eq('direcao', 'OUT')
        .in('agendamento_id', leadIds);

      const idsJaEnviados = new Set(
        (jaEnviados || [])
          .map((m: any) => m.agendamento_id)
          .filter((v: string | null) => !!v),
      );
      leadsToProcess = rawLeads.filter((l) => !idsJaEnviados.has(l.id));
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
        const normalizedPhone = normalizePhoneNumber(phoneClean);

        // GUARD #0: rate-limit anti-loop (telefone)
        const rl = await podeEnviarOutbound(supabase, phoneClean, [LIMITES_PADRAO.boas_vindas]);
        if (!rl.ok) {
          console.warn(`[boas-vindas] 🚫 Rate limit ${normalizedPhone} lead ${lead.id}: ${rl.motivo}`);
          await logarBloqueioRateLimit(supabase, 'enviar-boas-vindas-lead', phoneClean, lead.id, rl);
          falhas++;
          continue;
        }

        // GUARD #1: cache de verificações WhatsApp — se sabemos que o número
        // não tem WhatsApp, não tenta enviar (evita HTTP 400 da Evolution).
        const numeroInvalido = await isKnownInvalidWhatsapp(supabase, phoneClean);
        if (numeroInvalido) {
          console.warn(`[boas-vindas] ⛔ ${normalizedPhone} sem WhatsApp (cache) — lead ${lead.id} → PRECISA_DE_HUMANO`);
          await supabase
            .from('agendamentos')
            .update({
              status_crm: 'PRECISA_DE_HUMANO',
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
            .eq('status_funil', 'lead')
            .eq('status_crm', 'NOVO LEAD');

          await supabase.from('mensagens_whatsapp').insert({
            agendamento_id: lead.id,
            telefone: normalizedPhone,
            direcao: 'OUT',
            conteudo: mensagem,
            tipo_mensagem: 'boas_vindas',
            status_envio: 'erro',
            error_message: 'Numero sem WhatsApp (cache verificacoes_whatsapp)',
          });
          falhas++;
          continue;
        }

        // CLAIM ANTECIPADO: insere placeholder 'pendente' ANTES de chamar Evolution.
        // Unique index parcial mensagens_whatsapp_boas_vindas_unique garante que
        // SOMENTE UM envio por agendamento_id ocorre, mesmo com execução concorrente.
        const { data: claim, error: claimError } = await supabase
          .from('mensagens_whatsapp')
          .insert({
            agendamento_id: lead.id,
            telefone: normalizedPhone,
            direcao: 'OUT',
            conteudo: mensagem,
            tipo_mensagem: 'boas_vindas',
            status_envio: 'pendente',
          })
          .select('id')
          .single();

        if (claimError) {
          // 23505 = unique_violation → já existe envio, pulamos com segurança
          if ((claimError as any).code === '23505') {
            console.log(`[boas-vindas] ⏭️  lead ${lead.id} já possui boas_vindas — skip (claim conflict)`);
            continue;
          }
          console.error(`[boas-vindas] Falha no claim do lead ${lead.id}:`, claimError.message);
          falhas++;
          continue;
        }

        const claimId = claim?.id;
        const resultado = await sendWhatsappTextMessage(phoneClean, mensagem);

        let statusEnvio: 'enviado' | 'entregue' | 'lido' | 'pendente' | 'erro';
        let confirmadoEntrega = false;

        if (!resultado.success) {
          statusEnvio = 'erro';
          confirmadoEntrega = false;
        } else if (resultado.confirmed && resultado.messageId) {
          statusEnvio = resultado.deliveryStatus ?? 'enviado';
          confirmadoEntrega = true;
        } else {
          statusEnvio = 'pendente';
          confirmadoEntrega = false;
        }

        // Atualiza o claim com o resultado real (NÃO insere de novo — dedup garantida)
        const { error: updateMsgError } = await supabase
          .from('mensagens_whatsapp')
          .update({
            status_envio: statusEnvio,
            mensagem_externa_id: resultado.messageId || null,
            error_message: resultado.errorMessage || null,
            payload: sanitizePayload({
              evolution_status: resultado.evolutionStatus ?? null,
              response: resultado.sanitizedResponse ?? null,
            }) as any,
          })
          .eq('id', claimId);

        if (updateMsgError) {
          console.error(`[boas-vindas] Falha ao atualizar mensagem do lead ${lead.id}:`, updateMsgError.message);
        }

        if (confirmadoEntrega) {
          // Só promove para AGUARDANDO + marca "Boas-vindas enviada" quando há
          // confirmação clara de entrega ao paciente.
          const { error: updErr } = await supabase
            .from('agendamentos')
            .update({
              status_crm: 'AGUARDANDO',
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
            .eq('status_funil', 'lead')
            .eq('status_crm', 'NOVO LEAD');

          if (updErr) {
            console.error(`[boas-vindas] Falha ao promover lead ${lead.id}:`, updErr.message);
          } else {
            console.log(`[boas-vindas] ✓ Confirmado (${statusEnvio}) ${normalizedPhone} (lead ${lead.id}) → AGUARDANDO`);
          }

          await supabase.from('crm_audit_log').insert({
            agendamento_id: lead.id,
            user_email: 'system@boas-vindas',
            user_name: 'Sistema (boas-vindas)',
            acao: 'boas_vindas_confirmada',
            status_anterior: 'NOVO LEAD',
            status_novo: 'AGUARDANDO',
            detalhes: {
              telefone_mascarado: '***' + normalizedPhone.slice(-4),
              status_envio: statusEnvio,
              evolution_status: resultado.evolutionStatus ?? null,
              mensagem_externa_id: resultado.messageId ?? null,
            },
          }).then(() => {}, () => {});

          enviados++;
        } else if (statusEnvio === 'pendente') {
          // Sem confirmação clara → mantém NOVO LEAD; equipe verá "WhatsApp pendente"
          console.warn(`[boas-vindas] ⏳ Pendente (sem ack) ${normalizedPhone} (lead ${lead.id}) — mantém NOVO LEAD`);
          await supabase.from('system_logs').insert({
            level: 'warn',
            category: 'whatsapp',
            source: 'enviar-boas-vindas-lead',
            message: 'Boas-vindas enviada sem confirmação de entrega',
            details: {
              event: 'boas_vindas_pendente',
              agendamento_id: lead.id,
              telefone_mascarado: '***' + normalizedPhone.slice(-4),
              evolution_status: resultado.evolutionStatus ?? null,
              mensagem_externa_id: resultado.messageId ?? null,
            },
            agendamento_id: lead.id,
          }).then(() => {}, () => {});
          falhas++;
        } else {
          // Falha técnica de envio (provedor/webhook) — NÃO escala para humano.
          // O claim já foi gravado em mensagens_whatsapp com status_envio='erro'
          // e a função `retentar-boas-vindas-pendentes` cuidará do retry
          // controlado. Só após MAX_TENTATIVAS sem confirmação o lead é
          // promovido a PRECISA_DE_HUMANO (motivo: max_tentativas_sem_confirmacao).
          console.error(`[boas-vindas] ✗ Erro técnico ${normalizedPhone} (lead ${lead.id}) — mantém NOVO LEAD para retry:`, resultado.errorMessage);

          await supabase.from('system_logs').insert({
            level: 'warn',
            category: 'whatsapp',
            source: 'enviar-boas-vindas-lead',
            message: 'Falha técnica no envio de boas-vindas — mantido em NOVO LEAD para retry',
            details: {
              event: 'boas_vindas_falha_tecnica',
              motivo_status: 'falha_tecnica_envio_whatsapp',
              agendamento_id: lead.id,
              telefone_mascarado: '***' + normalizedPhone.slice(-4),
              evolution_status: resultado.evolutionStatus ?? null,
              error_message: resultado.errorMessage ?? null,
            },
            agendamento_id: lead.id,
          }).then(() => {}, () => {});
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
