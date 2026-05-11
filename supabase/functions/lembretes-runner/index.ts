// Edge Function: lembretes-runner
// API segura para o agente externo (n8n) operar campanhas de lembretes anuais.
// Auth: header x-lembretes-secret comparado a LEMBRETES_RUNNER_SECRET via timingSafeEqual.
// NOTA HISTÓRICA: o antigo bot copiloto "Hermes" foi REMOVIDO em 2026-04-29 e
// NÃO deve ser recriado. Esta função é exclusiva do módulo de Lembretes Anuais.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  sendWhatsappTextMessage,
  normalizePhoneNumber,
  sanitizePayload,
} from "../_shared/evolutionApiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-lembretes-secret",
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
  const provided = req.headers.get("x-lembretes-secret") || "";
  const expected = Deno.env.get("LEMBRETES_RUNNER_SECRET") || "";
  if (!provided || !expected) return false;
  return timingSafeEqual(provided, expected);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_FALHAS_CONSECUTIVAS = 3;

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

interface Variacao {
  id: string;
  nome: string;
  conteudo: string;
  peso: number;
}

async function carregarVariacoes(
  admin: ReturnType<typeof makeAdmin>,
  tipo: string,
): Promise<Variacao[]> {
  const { data } = await admin
    .from("templates_whatsapp_variacoes")
    .select("id,nome,conteudo,peso")
    .eq("template_tipo", tipo)
    .eq("ativo", true);
  return (data as Variacao[] | null) ?? [];
}

const FALLBACK_VARIACAO: Variacao = {
  id: "00000000-0000-0000-0000-000000000000",
  nome: "fallback",
  conteudo:
    "Olá, {{nome}}! 👋\n\nJá faz cerca de 1 ano desde sua última consulta oftalmológica conosco. Manter os exames em dia é importante para a saúde dos seus olhos. 👀\n\nGostaria de agendar seu retorno?\n\n📱 Agende pelo nosso site:\n👉 https://drjulianomachado.com/agendamento\n\nAtenciosamente,\nDr. Juliano Machado\nOftalmologia",
  peso: 1,
};

function escolherVariacao(variacoes: Variacao[], lastId: string | null): Variacao {
  if (variacoes.length === 0) return FALLBACK_VARIACAO;
  // Tira a última usada para evitar repetição imediata, se houver alternativa
  const candidatas = variacoes.length > 1 && lastId
    ? variacoes.filter((v) => v.id !== lastId)
    : variacoes;
  const totalPeso = candidatas.reduce((s, v) => s + Math.max(1, v.peso || 1), 0);
  let r = Math.random() * totalPeso;
  for (const v of candidatas) {
    r -= Math.max(1, v.peso || 1);
    if (r <= 0) return v;
  }
  return candidatas[candidatas.length - 1];
}

function renderTemplate(tpl: string, dados: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => dados[k] ?? "");
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
  parado_por_falhas?: boolean;
}

async function processarPacientes(
  admin: ReturnType<typeof makeAdmin>,
  pacientes: any[],
  cfgInicial: any,
  request_id: string,
  limiteSessao: number,
): Promise<ProcessResult> {
  const t0 = Date.now();
  let processados = 0;
  let enviados = 0;
  let falhas = 0;
  let ignorados = 0;
  let parado_por_falhas = false;
  let falhasConsecutivas = 0;

  const enviadosHojeInicial = await countEnviadosHoje(admin);
  let restanteDiario = Math.max(0, cfgInicial.limite_diario - enviadosHojeInicial);

  const tipoTemplate = "lembrete_anual";
  const variacoes = await carregarVariacoes(admin, tipoTemplate);
  let ultimaVariacaoId: string | null = null;

  // Limites de intervalo (com fallback seguro)
  const intMin = Math.max(30, Number(cfgInicial.intervalo_min_segundos ?? 75));
  const intMaxRaw = Number(cfgInicial.intervalo_max_segundos ?? 210);
  const intMax = Math.max(intMin, intMaxRaw);

  for (let i = 0; i < pacientes.length; i++) {
    const pac = pacientes[i];

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
        status_global_no_envio: cfgInicial.status_global,
      });
      ignorados++;
      continue;
    }

    // Re-checar status_global a cada paciente para honrar pausas em tempo real
    const reCheck = await preCheck(admin);
    if (!reCheck.ok) {
      await logEnvio(admin, {
        status: "bloqueado",
        motivo: reCheck.motivo,
        telefone: pac.telefone,
        nome: pac.nome,
        campanha_id: pac.campanha_id,
        remessa_id: pac.remessa_id,
        paciente_campanha_id: pac.id,
        request_id,
        status_global_no_envio: reCheck.cfg?.status_global ?? null,
      });
      ignorados++;
      break;
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

    const variacao = escolherVariacao(variacoes, ultimaVariacaoId);
    ultimaVariacaoId = variacao.id;

    const mensagem = renderTemplate(variacao.conteudo, {
      nome: pac.primeiro_nome || pac.nome || "paciente",
      primeiro_nome: pac.primeiro_nome || pac.nome || "paciente",
    });

    const tStart = Date.now();
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

    // delay aleatório (será aplicado depois deste envio se houver próximo)
    const delayDepoisMs =
      i < pacientes.length - 1 && processados + 1 < limiteSessao && restanteDiario - 1 > 0
        ? (intMin + Math.floor(Math.random() * (intMax - intMin + 1))) * 1000
        : 0;

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
      variacao_id: variacao.id !== FALLBACK_VARIACAO.id ? variacao.id : null,
      variacao_nome: variacao.nome,
      delay_antes_ms: 0,
      delay_depois_ms: delayDepoisMs,
      status_global_no_envio: reCheck.cfg?.status_global ?? cfgInicial.status_global,
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
      falhasConsecutivas = 0;
    } else {
      falhas++;
      falhasConsecutivas++;
      if (falhasConsecutivas >= MAX_FALHAS_CONSECUTIVAS) {
        parado_por_falhas = true;
        await logEnvio(admin, {
          status: "bloqueado",
          motivo: `parado_falhas_consecutivas:${falhasConsecutivas}`,
          request_id,
          campanha_id: pac.campanha_id,
          remessa_id: pac.remessa_id,
          status_global_no_envio: reCheck.cfg?.status_global ?? null,
        });
        break;
      }
    }

    if (delayDepoisMs > 0) {
      await new Promise((r) => setTimeout(r, delayDepoisMs));
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
    parado_por_falhas,
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
      const { data: janelas, error: errJ } = await admin
        .from("vw_status_janelas_atual")
        .select("*");
      if (errJ) return json({ error: errJ.message }, 500);
      return json({ data, janelas: janelas ?? [], request_id });
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
          status_global_no_envio: pre.cfg?.status_global ?? null,
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
          status_global_no_envio: pre.cfg?.status_global ?? null,
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

    // ----- EXECUTAR JANELA -----
    if (req.method === "POST" && path === "/executar-janela") {
      const body = await req.json().catch(() => ({}));
      const janela_atendimento_id = body?.janela_atendimento_id;
      const limite = Math.max(1, Math.min(parseInt(body?.limite ?? "10", 10) || 10, 100));

      if (!janela_atendimento_id) {
        return json({ error: "janela_atendimento_id obrigatorio" }, 400);
      }

      const pre = await preCheck(admin);
      if (!pre.ok) {
        await logEnvio(admin, {
          status: "bloqueado",
          motivo: pre.motivo,
          request_id,
          payload: { janela_atendimento_id },
          status_global_no_envio: pre.cfg?.status_global ?? null,
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

      const { data: remessas, error: errR } = await admin
        .from("lembretes_campanha_remessas")
        .select("id")
        .eq("janela_atendimento_id", janela_atendimento_id);
      if (errR) return json({ error: errR.message }, 500);

      const remessaIds = (remessas as any[] | null)?.map((r) => r.id) ?? [];
      if (remessaIds.length === 0) {
        return json({ request_id, ok: true, mensagem: "nenhuma remessa para esta janela" });
      }

      const { data: pacientes } = await admin
        .from("lembretes_campanha_pacientes")
        .select("*")
        .in("remessa_id", remessaIds)
        .eq("status", "pendente")
        .limit(limite);

      const result = await processarPacientes(
        admin,
        (pacientes as any[]) || [],
        pre.cfg,
        request_id,
        Math.min(limite, pre.cfg.limite_sessao),
      );
      return json({ ...result, janela_atendimento_id });
    }

    return json({ error: "not_found", path }, 404);
  } catch (e: any) {
    console.error("[lembretes-runner] erro:", e);
    return json({ error: e?.message || "internal_error", request_id }, 500);
  }
});
