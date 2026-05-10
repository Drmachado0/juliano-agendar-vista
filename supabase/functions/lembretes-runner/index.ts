// Edge Function: lembretes-runner
// API segura para o agente externo (n8n) operar campanhas de lembretes anuais.
// Auth: header x-hermes-secret (compat) ou x-runner-secret comparado a
//   LEMBRETES_RUNNER_SECRET (preferido) ou HERMES_WEBHOOK_SECRET (fallback).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  sendWhatsappTextMessage,
  normalizePhoneNumber,
  sanitizePayload,
} from "../_shared/evolutionApiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hermes-secret, x-runner-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function checkSecret(req: Request): boolean {
  const provided =
    req.headers.get("x-hermes-secret") ||
    req.headers.get("x-runner-secret") ||
    "";
  const expected =
    Deno.env.get("LEMBRETES_RUNNER_SECRET") ||
    Deno.env.get("HERMES_WEBHOOK_SECRET") ||
    "";
  if (!provided || !expected) return false;
  return timingSafeEqual(provided, expected);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function makeAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function nowInBelem(): Date {
  // America/Belem = UTC-3 (sem horário de verão)
  const utc = Date.now();
  return new Date(utc - 3 * 60 * 60 * 1000);
}

function dentroDaJanela(cfg: any, agora: Date): boolean {
  const horaAtual = agora.getUTCHours() + agora.getUTCMinutes() / 60;
  const [hi] = String(cfg.janela_inicio || "09:00").split(":");
  const [hf] = String(cfg.janela_fim || "18:00").split(":");
  const ini = parseInt(hi, 10) || 9;
  const fim = parseInt(hf, 10) || 18;
  return horaAtual >= ini && horaAtual < fim;
}

function isBlackoutHoje(cfg: any, hoje: Date): boolean {
  const iso = hoje.toISOString().slice(0, 10);
  return Array.isArray(cfg.blackout_dates) && cfg.blackout_dates.includes(iso);
}

async function loadConfig(admin: ReturnType<typeof makeAdmin>) {
  const { data, error } = await admin
    .from("configuracoes_envio")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) {
    return { ok: false as const, motivo: `Falha ao ler configuracoes_envio: ${error?.message || "vazio"}` };
  }
  return { ok: true as const, cfg: data };
}

async function logEnvio(admin: ReturnType<typeof makeAdmin>, payload: Record<string, any>) {
  try {
    await admin.from("logs_envio_lembrete").insert({
      agente: "lembretes-runner",
      ...payload,
    });
  } catch (e) {
    console.error("[runner] log fail:", e);
  }
}

async function countEnviadosHoje(admin: ReturnType<typeof makeAdmin>): Promise<number> {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("logs_envio_lembrete")
    .select("*", { count: "exact", head: true })
    .eq("status", "sucesso")
    .gte("created_at", hoje.toISOString());
  return count || 0;
}

interface PreCheck {
  ok: boolean;
  status?: number;
  motivo?: string;
  cfg?: any;
}

async function preCheck(admin: ReturnType<typeof makeAdmin>): Promise<PreCheck> {
  const c = await loadConfig(admin);
  if (!c.ok) return { ok: false, status: 503, motivo: c.motivo };

  const cfg = c.cfg;
  if (cfg.status_global !== "ativo") {
    return {
      ok: false,
      status: 423,
      cfg,
      motivo:
        cfg.status_global === "bloqueado"
          ? `bloqueado:${cfg.motivo_bloqueio || ""}`
          : "pausado",
    };
  }
  const agora = nowInBelem();
  if (!dentroDaJanela(cfg, agora)) {
    return {
      ok: false,
      status: 423,
      cfg,
      motivo: `fora_janela:${cfg.janela_inicio}-${cfg.janela_fim}`,
    };
  }
  if (isBlackoutHoje(cfg, agora)) {
    return { ok: false, status: 423, cfg, motivo: "blackout_date" };
  }
  return { ok: true, cfg };
}

interface ProcessResult {
  request_id: string;
  ok: boolean;
  processados: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  duracao_ms: number;
}

async function processarPacientes(
  admin: ReturnType<typeof makeAdmin>,
  pacientes: any[],
  cfg: any,
  request_id: string,
  limiteSessao: number,
): Promise<ProcessResult> {
  const t0 = Date.now();
  let processados = 0;
  let enviados = 0;
  let falhas = 0;
  let ignorados = 0;

  const enviadosHojeInicial = await countEnviadosHoje(admin);
  let restanteDiario = Math.max(0, cfg.limite_diario - enviadosHojeInicial);

  for (const pac of pacientes) {
    if (processados >= limiteSessao) break;
    if (restanteDiario <= 0) {
      await logEnvio(admin, {
        status: "bloqueado",
        motivo: "limite_diario_atingido",
        telefone: pac.telefone,
        nome: pac.nome,
        campanha_id: pac.campanha_id,
        remessa_id: pac.remessa_id,
        paciente_campanha_id: pac.id,
        request_id,
      });
      ignorados++;
      continue;
    }

    // claim lock
    const { data: lockData, error: lockErr } = await admin.rpc("claim_paciente_campanha", {
      p_paciente_id: pac.id,
      p_processador: `runner:${request_id}`,
      p_ttl_seconds: 120,
    });
    const lockToken = lockData as string | null;
    if (lockErr || !lockToken) {
      ignorados++;
      await logEnvio(admin, {
        status: "ignorado",
        motivo: "lock_busy_ou_processado",
        telefone: pac.telefone,
        nome: pac.nome,
        campanha_id: pac.campanha_id,
        remessa_id: pac.remessa_id,
        paciente_campanha_id: pac.id,
        request_id,
      });
      continue;
    }

    const tStart = Date.now();
    const mensagem =
      `Olá, ${pac.primeiro_nome || pac.nome || "paciente"}! 👋\n\n` +
      `Já faz cerca de 1 ano desde sua última consulta oftalmológica conosco. ` +
      `Manter os exames em dia é importante para a saúde dos seus olhos. 👀\n\n` +
      `Gostaria de agendar seu retorno?\n\n` +
      `📱 Agende pelo nosso site:\n👉 https://drjulianomachado.com/agendamento\n\n` +
      `Atenciosamente,\nDr. Juliano Machado\nOftalmologia`;

    let success = false;
    let errMsg: string | null = null;
    let result: any = null;
    try {
      result = await sendWhatsappTextMessage(pac.telefone, mensagem);
      success = !!result.success;
      if (!success) errMsg = result.errorMessage || "envio_falhou";
    } catch (e: any) {
      errMsg = e?.message || "exception";
    }

    const latencia = Date.now() - tStart;
    const normalized = normalizePhoneNumber(pac.telefone);

    await logEnvio(admin, {
      status: success ? "sucesso" : "falha",
      motivo: success ? null : errMsg,
      telefone: normalized,
      nome: pac.nome,
      mensagem_renderizada: mensagem,
      lembrete_id: pac.lembrete_id,
      campanha_id: pac.campanha_id,
      remessa_id: pac.remessa_id,
      paciente_campanha_id: pac.id,
      latencia_ms: latencia,
      request_id,
      payload: result ? sanitizePayload({ response: result.sanitizedResponse ?? null }) : null,
    });

    // Update paciente status
    await admin
      .from("lembretes_campanha_pacientes")
      .update({
        status: success ? "enviado" : "falha",
        ultimo_envio_em: new Date().toISOString(),
        motivo_falha: success ? null : errMsg,
      })
      .eq("id", pac.id);

    // Release lock
    await admin.rpc("release_paciente_campanha", {
      p_paciente_id: pac.id,
      p_lock_token: lockToken,
    });

    // Mark lembrete sent on success
    if (success && pac.lembrete_id) {
      await admin
        .from("lembretes_anuais")
        .update({ lembrete_enviado: true, lembrete_enviado_em: new Date().toISOString() })
        .eq("id", pac.lembrete_id);
    }

    processados++;
    if (success) {
      enviados++;
      restanteDiario--;
    } else {
      falhas++;
    }

    // delay anti-spam aleatório 45-120s entre envios
    if (processados < pacientes.length && processados < limiteSessao && restanteDiario > 0) {
      const delay = 45_000 + Math.floor(Math.random() * 75_000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return {
    request_id,
    ok: true,
    processados,
    enviados,
    falhas,
    ignorados,
    bloqueado: false,
    motivo_bloqueio: null,
    duracao_ms: Date.now() - t0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/lembretes-runner/, "") || "/";

  // /health permite ser checado sem secret? Não — exige secret também.
  if (!checkSecret(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = makeAdmin();
  const request_id = crypto.randomUUID();

  try {
    // ----- HEALTH -----
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      const t = Date.now();
      const { error } = await admin.from("configuracoes_envio").select("id").eq("id", true).maybeSingle();
      const db_latency_ms = Date.now() - t;
      return json({ ok: !error, ts: new Date().toISOString(), db_latency_ms, request_id });
    }

    // ----- STATUS CAMPANHA -----
    if (req.method === "GET" && path === "/status-campanha") {
      const { data, error } = await admin.from("vw_status_campanha_atual").select("*").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ data, request_id });
    }

    // ----- PAUSAR -----
    if (req.method === "POST" && path === "/pausar") {
      const body = await req.json().catch(() => ({}));
      const motivo = body?.motivo ?? null;
      const { error } = await admin
        .from("configuracoes_envio")
        .update({ status_global: "pausado", motivo_bloqueio: motivo })
        .eq("id", true);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, status_global: "pausado", motivo, request_id });
    }

    // ----- RETOMAR -----
    if (req.method === "POST" && path === "/retomar") {
      const { data: cur } = await admin
        .from("configuracoes_envio")
        .select("status_global")
        .eq("id", true)
        .maybeSingle();
      if (cur && (cur as any).status_global === "bloqueado") {
        return json({ error: "config_bloqueada", request_id }, 423);
      }
      const { error } = await admin
        .from("configuracoes_envio")
        .update({ status_global: "ativo", motivo_bloqueio: null })
        .eq("id", true);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, status_global: "ativo", request_id });
    }

    // ----- PROCESSAR FILA (próxima remessa do dia) -----
    if (req.method === "POST" && path === "/processar-fila") {
      const body = await req.json().catch(() => ({}));
      const limite = Math.max(1, Math.min(parseInt(body?.limite ?? "10", 10) || 10, 100));

      const pre = await preCheck(admin);
      if (!pre.ok) {
        await logEnvio(admin, {
          status: "bloqueado",
          motivo: pre.motivo,
          request_id,
        });
        return json(
          {
            request_id,
            ok: false,
            bloqueado: true,
            motivo_bloqueio: pre.motivo,
            processados: 0,
            enviados: 0,
            falhas: 0,
            ignorados: 0,
          },
          pre.status ?? 423,
        );
      }

      // Buscar próxima remessa com status agendada/em_andamento e data <= hoje
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: remessa } = await admin
        .from("lembretes_campanha_remessas")
        .select("*")
        .lte("data_programada", hoje)
        .in("status", ["agendada", "em_andamento"])
        .order("data_programada", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!remessa) {
        return json({ request_id, ok: true, mensagem: "nenhuma remessa pendente hoje" });
      }

      const { data: pacientes } = await admin
        .from("lembretes_campanha_pacientes")
        .select("*")
        .eq("remessa_id", (remessa as any).id)
        .eq("status", "pendente")
        .limit(limite);

      const result = await processarPacientes(
        admin,
        (pacientes as any[]) || [],
        pre.cfg,
        request_id,
        Math.min(limite, pre.cfg.limite_sessao),
      );
      return json(result);
    }

    // ----- EXECUTAR REMESSA específica -----
    if (req.method === "POST" && path === "/executar-remessa") {
      const body = await req.json().catch(() => ({}));
      const campanha_id = body?.campanha_id;
      const numero_remessa = body?.numero_remessa;
      const limite = Math.max(1, Math.min(parseInt(body?.limite ?? "10", 10) || 10, 100));

      if (!campanha_id || !numero_remessa) {
        return json({ error: "campanha_id e numero_remessa obrigatorios" }, 400);
      }

      const pre = await preCheck(admin);
      if (!pre.ok) {
        await logEnvio(admin, {
          status: "bloqueado",
          motivo: pre.motivo,
          campanha_id,
          request_id,
        });
        return json(
          {
            request_id,
            ok: false,
            bloqueado: true,
            motivo_bloqueio: pre.motivo,
            processados: 0,
            enviados: 0,
            falhas: 0,
            ignorados: 0,
          },
          pre.status ?? 423,
        );
      }

      const { data: remessa } = await admin
        .from("lembretes_campanha_remessas")
        .select("*")
        .eq("campanha_id", campanha_id)
        .eq("numero_remessa", numero_remessa)
        .maybeSingle();

      if (!remessa) return json({ error: "remessa nao encontrada" }, 404);

      const { data: pacientes } = await admin
        .from("lembretes_campanha_pacientes")
        .select("*")
        .eq("remessa_id", (remessa as any).id)
        .eq("status", "pendente")
        .limit(limite);

      const result = await processarPacientes(
        admin,
        (pacientes as any[]) || [],
        pre.cfg,
        request_id,
        Math.min(limite, pre.cfg.limite_sessao),
      );
      return json(result);
    }

    return json({ error: "not_found", path }, 404);
  } catch (e: any) {
    console.error("[lembretes-runner] erro:", e);
    return json({ error: e?.message || "internal_error", request_id }, 500);
  }
});
