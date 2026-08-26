// Re-tenta automaticamente o envio de boas-vindas que ficaram em status
// 'pendente' (PENDING / SERVER_ACK sem confirmação de entrega).
//
// Regras:
// - Considera "pendente" toda mensagem boas_vindas com status_envio='pendente'
//   há pelo menos PENDING_GRACE_MIN minutos (tempo para ack natural chegar).
// - Tenta no máximo MAX_TENTATIVAS vezes por lead (contadas via mensagens OUT
//   tipo_mensagem='boas_vindas' do mesmo agendamento).
// - Backoff: respeita intervalo mínimo BACKOFF_MIN_MIN minutos entre tentativas.
// - Se confirmar entrega → promove card para AGUARDANDO.
// - Se atingir MAX_TENTATIVAS sem confirmação → marca PRECISA_DE_HUMANO.
// - Card permanece em NOVO LEAD enquanto não houver confirmação confiável.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  sendWhatsappTextMessage,
  normalizePhoneNumber,
  sanitizePayload,
} from "../_shared/evolutionApiClient.ts";
import { requireCronSecret } from "../_shared/authGuards.ts";
import { envioAutomaticoLiberado } from "../_shared/envioStatusGlobal.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENDING_GRACE_MIN = 3; // espera mínima após envio antes de re-tentar
const BACKOFF_MIN_MIN = 5;   // intervalo mínimo entre tentativas
const MAX_TENTATIVAS = 4;    // máximo de envios OUT de boas_vindas por lead
const PROCESS_LIMIT = 25;    // máx leads por execução

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: CRON_SECRET (via Vault + timing-safe) ou JWT admin
  const authHeader = req.headers.get("Authorization") || "";
  const cronGuard = await requireCronSecret(req);
  const isCron = cronGuard.ok;



  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let isAdmin = false;
  if (!isCron && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const supabaseAuth = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        isAdmin = !!roleData;
      }
    } catch (e) {
      console.error("[retry-boas-vindas] auth error:", e);
    }
  }

  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // KILL SWITCH: o botao "Parar tudo agora" do admin precisa alcancar ESTE cron.
  // Ele ficou de fora quando o guard foi adicionado aos outros tres crons, e o
  // resultado foi um reenvio que a parada de emergencia nao conseguia conter.
  const killSwitch = await envioAutomaticoLiberado(supabase);
  if (!killSwitch.liberado) {
    console.warn(`[retry-boas-vindas] 🛑 Bloqueado pelo kill switch: ${killSwitch.motivo}`);
    return new Response(
      JSON.stringify({ processed: 0, retried: 0, confirmed: 0, escalated: 0, total_pending: 0, blocked: true, reason: killSwitch.motivo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const nowIso = new Date().toISOString();
  const cutoffPendingIso = new Date(
    Date.now() - PENDING_GRACE_MIN * 60_000,
  ).toISOString();

  try {
    // 1) Localiza últimas tentativas pendentes por agendamento (status_envio='pendente'
    //    e que ainda estão em NOVO LEAD).
    const { data: pendentes, error: errPend } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id, telefone, conteudo, created_at, status_envio, payload")
      .eq("tipo_mensagem", "boas_vindas")
      .eq("direcao", "OUT")
      .eq("status_envio", "pendente")
      .lt("created_at", cutoffPendingIso)
      .order("created_at", { ascending: false })
      .limit(200);

    if (errPend) {
      console.error("[retry-boas-vindas] erro ao buscar pendentes:", errPend);
      return new Response(JSON.stringify({ error: errPend.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendentes || pendentes.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, retried: 0, confirmed: 0, escalated: 0, total_pending: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplica: mantém apenas a última pendência por agendamento_id
    const seen = new Set<string>();
    const candidatos: typeof pendentes = [];
    for (const p of pendentes) {
      if (!p.agendamento_id || seen.has(p.agendamento_id)) continue;
      seen.add(p.agendamento_id);
      candidatos.push(p);
    }

    const agendamentoIds = candidatos.map((c) => c.agendamento_id!);

    // 2) Carrega leads correspondentes ainda em NOVO LEAD / status_funil='lead'
    const { data: leads } = await supabase
      .from("agendamentos")
      .select("id, nome_completo, telefone_whatsapp, status_crm, status_funil")
      .in("id", agendamentoIds)
      .eq("status_funil", "lead")
      .eq("status_crm", "NOVO LEAD");

    const leadsMap = new Map((leads || []).map((l: any) => [l.id, l]));

    let processed = 0;
    let retried = 0;
    let confirmed = 0;
    let escalated = 0;

    for (const cand of candidatos.slice(0, PROCESS_LIMIT)) {
      const lead = leadsMap.get(cand.agendamento_id!);
      if (!lead) continue; // já mudou de status, não re-tenta
      processed++;

      // Conta tentativas anteriores e checa backoff.
      //
      // O contador NAO pode sair do numero de linhas: o indice parcial
      // mensagens_whatsapp_boas_vindas_unique admite UMA linha boas_vindas OUT
      // por agendamento, entao a contagem por linhas ficava presa em 1 e o teto
      // de MAX_TENTATIVAS nunca era alcancado — o lead era reenviado para
      // sempre. A tentativa vive no payload da propria linha.
      const { data: tentativas } = await supabase
        .from("mensagens_whatsapp")
        .select("id, created_at, status_envio, payload")
        .eq("agendamento_id", cand.agendamento_id!)
        .eq("tipo_mensagem", "boas_vindas")
        .eq("direcao", "OUT")
        .order("created_at", { ascending: false });

      const totalTentativas = Math.max(
        tentativas?.length ?? 0,
        ...(tentativas ?? []).map((t: any) => Number(t.payload?.tentativa) || 0),
      );
      const ultima = tentativas?.[0];
      const ultimaMs = ultima ? new Date(ultima.created_at).getTime() : 0;
      const idadeMin = (Date.now() - ultimaMs) / 60_000;

      // Se alguma tentativa anterior já está como enviado/entregue/lido → promove
      const algumaConfirmada = (tentativas || []).some((t: any) =>
        ["enviado", "entregue", "lido"].includes((t.status_envio ?? "").toLowerCase())
      );
      if (algumaConfirmada) {
        await promoverParaAguardando(supabase, cand.agendamento_id!, lead.telefone_whatsapp, "auto_promote_after_ack");
        confirmed++;
        continue;
      }

      // Atingiu limite → escala para humano
      if (totalTentativas >= MAX_TENTATIVAS) {
        await escalarParaHumano(
          supabase,
          cand.agendamento_id!,
          lead.telefone_whatsapp,
          totalTentativas,
        );
        escalated++;
        continue;
      }

      // Respeita backoff
      if (idadeMin < BACKOFF_MIN_MIN) {
        continue;
      }

      // Re-envia
      const phoneClean = (lead.telefone_whatsapp || "").replace(/\D/g, "");
      const normalizedPhone = normalizePhoneNumber(phoneClean);
      const conteudo = cand.conteudo || "Olá! Gostaríamos de confirmar seu interesse em agendar uma consulta.";

      try {
        const resultado = await sendWhatsappTextMessage(phoneClean, conteudo);

        let statusEnvio: "enviado" | "entregue" | "lido" | "pendente" | "erro";
        let confirmadoEntrega = false;

        if (!resultado.success) {
          statusEnvio = "erro";
        } else {
          // O provedor atual (n8n -> ManyChat) nao devolve ack de entrega, entao
          // `confirmed` e sempre false aqui. Gravar "pendente" fazia toda
          // mensagem ENTREGUE voltar para a fila deste cron na rodada seguinte.
          // O status passa a refletir o despacho real; a promocao para
          // AGUARDANDO segue exigindo ack de verdade.
          statusEnvio = (resultado.deliveryStatus as any) ?? "enviado";
          confirmadoEntrega = resultado.confirmed === true && !!resultado.messageId;
        }

        // UPDATE, nao INSERT: o indice parcial unico so admite uma linha
        // boas_vindas OUT por agendamento, entao o insert batia em 23505 a cada
        // rodada — em silencio, porque o erro nunca era conferido — e a linha
        // original seguia "pendente", realimentando este mesmo cron.
        const { error: updateErr } = await supabase
          .from("mensagens_whatsapp")
          .update({
            telefone: normalizedPhone,
            status_envio: statusEnvio,
            mensagem_externa_id: resultado.messageId || null,
            error_message: resultado.errorMessage || null,
            payload: sanitizePayload({
              event: "boas_vindas_retry",
              tentativa: totalTentativas + 1,
              evolution_status: resultado.evolutionStatus ?? null,
              response: resultado.sanitizedResponse ?? null,
            }) as any,
          })
          .eq("id", cand.id);

        if (updateErr) {
          // Sem registrar a tentativa, o proximo ciclo reenviaria com o mesmo
          // contador. Escala para humano e para por aqui, em vez de repetir.
          console.error(
            `[retry-boas-vindas] falha ao registrar tentativa do lead ${cand.agendamento_id}:`,
            updateErr.message,
          );
          await escalarParaHumano(
            supabase,
            cand.agendamento_id!,
            lead.telefone_whatsapp,
            totalTentativas + 1,
          );
          escalated++;
          continue;
        }

        retried++;

        if (confirmadoEntrega) {
          await promoverParaAguardando(supabase, cand.agendamento_id!, lead.telefone_whatsapp, "retry_confirmed");
          confirmed++;
        } else if (statusEnvio === "erro") {
          // Se ainda dá margem, conta como tentativa; senão escala
          if (totalTentativas + 1 >= MAX_TENTATIVAS) {
            await escalarParaHumano(
              supabase,
              cand.agendamento_id!,
              lead.telefone_whatsapp,
              totalTentativas + 1,
            );
            escalated++;
          } else {
            await logSystem(supabase, "warn", "boas_vindas_retry_erro", cand.agendamento_id!, {
              tentativa: totalTentativas + 1,
              telefone_mascarado: "***" + normalizedPhone.slice(-4),
              evolution_status: resultado.evolutionStatus ?? null,
              error_message: resultado.errorMessage ?? null,
            });
          }
        } else {
          // Continua pendente; loga progresso
          await logSystem(supabase, "info", "boas_vindas_retry_pendente", cand.agendamento_id!, {
            tentativa: totalTentativas + 1,
            telefone_mascarado: "***" + normalizedPhone.slice(-4),
            evolution_status: resultado.evolutionStatus ?? null,
          });
        }
      } catch (err) {
        console.error(`[retry-boas-vindas] erro lead ${cand.agendamento_id}:`, err);
        await logSystem(supabase, "error", "boas_vindas_retry_excecao", cand.agendamento_id!, {
          error: String((err as any)?.message ?? err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        retried,
        confirmed,
        escalated,
        total_pending: candidatos.length,
        timestamp: nowIso,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[retry-boas-vindas] erro geral:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function promoverParaAguardando(
  supabase: any,
  agendamentoId: string,
  telefone: string,
  motivo: string,
) {
  const phoneNorm = normalizePhoneNumber((telefone || "").replace(/\D/g, ""));
  await supabase
    .from("agendamentos")
    .update({ status_crm: "AGUARDANDO", updated_at: new Date().toISOString() })
    .eq("id", agendamentoId)
    .eq("status_funil", "lead")
    .eq("status_crm", "NOVO LEAD");

  await supabase.from("crm_audit_log").insert({
    agendamento_id: agendamentoId,
    user_email: "system@boas-vindas-retry",
    user_name: "Sistema (retry boas-vindas)",
    acao: "boas_vindas_confirmada_via_retry",
    status_anterior: "NOVO LEAD",
    status_novo: "AGUARDANDO",
    detalhes: {
      motivo,
      telefone_mascarado: "***" + phoneNorm.slice(-4),
    },
  }).then(() => {}, () => {});
}

async function escalarParaHumano(
  supabase: any,
  agendamentoId: string,
  telefone: string,
  tentativas: number,
) {
  const phoneNorm = normalizePhoneNumber((telefone || "").replace(/\D/g, ""));
  await supabase
    .from("agendamentos")
    .update({ status_crm: "PRECISA_DE_HUMANO", updated_at: new Date().toISOString() })
    .eq("id", agendamentoId)
    .eq("status_funil", "lead")
    .eq("status_crm", "NOVO LEAD");

  await supabase.from("crm_audit_log").insert({
    agendamento_id: agendamentoId,
    user_email: "system@boas-vindas-retry",
    user_name: "Sistema (retry boas-vindas)",
    acao: "boas_vindas_escalada_humano",
    status_anterior: "NOVO LEAD",
    status_novo: "PRECISA_DE_HUMANO",
    detalhes: {
      motivo: "max_tentativas_sem_confirmacao",
      tentativas,
      telefone_mascarado: "***" + phoneNorm.slice(-4),
    },
  }).then(() => {}, () => {});

  await logSystem(supabase, "error", "boas_vindas_escalada_humano", agendamentoId, {
    tentativas,
    telefone_mascarado: "***" + phoneNorm.slice(-4),
  });
}

async function logSystem(
  supabase: any,
  level: "info" | "warn" | "error",
  event: string,
  agendamentoId: string,
  details: Record<string, unknown>,
) {
  await supabase.from("system_logs").insert({
    level,
    category: "whatsapp",
    source: "retentar-boas-vindas-pendentes",
    message: event,
    details: { event, ...details },
    agendamento_id: agendamentoId,
  }).then(() => {}, () => {});
}
