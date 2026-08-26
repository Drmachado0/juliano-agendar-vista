import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { gerarMensagemDoTemplate, formatarData, formatarHora } from "../_shared/templateRenderer.ts";
import { sendWhatsappTextMessage, normalizePhoneNumber, sanitizePayload } from "../_shared/evolutionApiClient.ts";
import { isBotPaused, isKnownInvalidWhatsapp } from "../_shared/whatsappGuards.ts";
import { podeEnviarOutbound, LIMITES_PADRAO, logarBloqueioRateLimit } from "../_shared/rateLimitOutbound.ts";
import { envioAutomaticoLiberado } from "../_shared/envioStatusGlobal.ts";
import { isRegistroAtivo } from "../_shared/statusTerminais.ts";
import { dataAmanhaBelem } from "../_shared/dataBelem.ts";
import { pacienteJaRespondeu } from "../_shared/confirmationStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[lembrete-consulta] Iniciando processamento de lembretes...");

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("authorization");

    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "Configuração de segurança ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const killSwitch = await envioAutomaticoLiberado(supabase);
    if (!killSwitch.liberado) {
      console.warn(`[lembrete-consulta] 🛑 Bloqueado pelo kill switch: ${killSwitch.motivo}`);
      return new Response(JSON.stringify({ blocked: true, reason: killSwitch.motivo }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar consultas de amanhã, pelo calendário de Belém.
    //
    // `new Date()` aqui é UTC: depois das 21:00 de Belém o dia UTC já virou,
    // e somar 1 dia daria depois de amanhã — o paciente de amanhã ficaria sem
    // lembrete e outro receberia com dois dias de antecedência.
    const tomorrowStr = dataAmanhaBelem();

    console.log(`[lembrete-consulta] Buscando consultas para: ${tomorrowStr}`);

    const { data: agendamentos, error: fetchError } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("data_agendamento", tomorrowStr)
      .eq("aceita_contato_whatsapp_email", true);

    if (fetchError) throw fetchError;

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma consulta para amanhã", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GUARD #3: dedup — buscar quem já recebeu lembrete_24h
    const ids = agendamentos.map((a) => a.id);
    const { data: jaRecebidos } = await supabase
      .from("mensagens_whatsapp")
      .select("agendamento_id")
      .eq("tipo_mensagem", "lembrete_24h")
      .eq("direcao", "OUT")
      .in("agendamento_id", ids);
    const idsJaRecebidos = new Set((jaRecebidos || []).map((m: any) => m.agendamento_id));

    let enviados = 0;
    let erros = 0;
    let pulados = 0;

    for (const agendamento of agendamentos) {
      try {
        // GUARD #3: já recebeu lembrete
        if (idsJaRecebidos.has(agendamento.id)) {
          console.log(`[lembrete-consulta] ⏭️  ${agendamento.id} já recebeu lembrete_24h`);
          pulados++;
          continue;
        }

        // GUARD #0: registro terminal ou de teste não recebe lembrete.
        //
        // Sem isto, quem cancelou, faltou ou já foi atendido recebia
        // "Este é um lembrete do seu agendamento... Até amanhã!", e
        // registros is_sandbox mandavam mensagem para número real.
        if (!isRegistroAtivo(agendamento)) {
          console.log(
            `[lembrete-consulta] ⏭️  ${agendamento.id} inativo` +
              ` (crm=${agendamento.status_crm} funil=${agendamento.status_funil}` +
              ` sandbox=${agendamento.is_sandbox})`,
          );
          pulados++;
          continue;
        }

        // GUARD #6: o paciente já respondeu — confirmando ou cancelando.
        //
        // Antes só olhava o literal "confirmado", valor que nunca era
        // gravado (o writer usava um nome que a CHECK constraint recusava),
        // e nao havia caso para cancelado: quem tinha cancelado pelo
        // WhatsApp recebia o lembrete assim mesmo.
        if (pacienteJaRespondeu(agendamento.confirmation_status)) {
          console.log(
            `[lembrete-consulta] ⏭️  ${agendamento.id} já respondeu` +
              ` (${agendamento.confirmation_status})`,
          );
          pulados++;
          continue;
        }

        // GUARD #4: bot pausado
        if (isBotPaused(agendamento)) {
          console.log(`[lembrete-consulta] ⏭️  ${agendamento.id} com bot pausado`);
          pulados++;
          continue;
        }

        // GUARD #1: número conhecido como sem WhatsApp
        if (await isKnownInvalidWhatsapp(supabase, agendamento.telefone_whatsapp)) {
          console.warn(`[lembrete-consulta] ⛔ ${agendamento.id} número sem WhatsApp (cache)`);
          pulados++;
          continue;
        }

        const mensagem = await gerarMensagemDoTemplate("lembrete_24h", {
          nome: agendamento.nome_completo,
          data: formatarData(tomorrowStr),
          hora: formatarHora(agendamento.hora_agendamento),
          local: agendamento.local_atendimento,
          tipo_atendimento: agendamento.tipo_atendimento,
          link_status: `https://drjulianomachado.com/status/${agendamento.id}`,
        });

        // Rate-limit anti-loop
        const rl = await podeEnviarOutbound(supabase, agendamento.telefone_whatsapp, [LIMITES_PADRAO.lembrete_24h]);
        if (!rl.ok) {
          console.warn(`[lembrete-consulta] 🚫 Rate limit ${agendamento.id}: ${rl.motivo}`);
          await logarBloqueioRateLimit(supabase, 'lembrete-consulta-whatsapp', agendamento.telefone_whatsapp, agendamento.id, rl);
          pulados++;
          continue;
        }

        // Item #2: usa cliente compartilhado (sanitização + status mapeado)
        const result = await sendWhatsappTextMessage(agendamento.telefone_whatsapp, mensagem);
        const normalizedPhone = normalizePhoneNumber(agendamento.telefone_whatsapp);

        await supabase.from("mensagens_whatsapp").insert({
          agendamento_id: agendamento.id,
          telefone: normalizedPhone,
          direcao: "OUT",
          conteudo: mensagem,
          tipo_mensagem: "lembrete_24h",
          status_envio: result.success ? (result.deliveryStatus ?? "enviado") : "erro",
          mensagem_externa_id: result.messageId || null,
          error_message: result.errorMessage || null,
          payload: sanitizePayload({
            evolution_status: result.evolutionStatus ?? null,
            response: result.sanitizedResponse ?? null,
          }) as any,
        });

        if (result.success) {
          enviados++;
        } else {
          erros++;
          console.error(`[lembrete-consulta] Falha ${normalizedPhone}: ${result.errorMessage}`);
        }
      } catch (err) {
        console.error(`[lembrete-consulta] Erro agendamento ${agendamento.id}:`, err);
        erros++;
      }
    }

    console.log(`[lembrete-consulta] Final: ${enviados} enviados, ${erros} erros, ${pulados} pulados`);

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        erros,
        pulados,
        total: agendamentos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[lembrete-consulta] Erro geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
