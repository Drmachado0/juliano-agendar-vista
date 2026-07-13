// ============================================================================
// buscar-contexto-paciente
// Retorna contexto operacional do paciente para o agente (n8n/ManyChat).
//
// Regras críticas (correção 2026-07-13):
//   1) requireN8nSecret timing-safe + x-request-id.
//   2) Normalização por telefone_canonico (RPC + fallback local). SEM scan
//      dos últimos 200 e SEM match por últimos 8 dígitos.
//   3) Ignora is_sandbox=true em TODO contexto operacional.
//   4) Lead ativo = status_crm NÃO terminal (case-insensitive), excluindo
//      ATENDIDO/CANCELADO/COMPARECEU. 0 → sem paciente; 1 → contexto; >1 →
//      ambiguo=true e agendamento_ativo/paciente = null.
//   5) agendamento_ativo só existe quando data_agendamento >= hoje America/
//      Belem E status não terminal. Data passada NUNCA retorna como ativa.
//   6) Lead ativo sem data → paciente/status/estado, agendamento_ativo=null.
//   7) Histórico separado: ultimo_atendimento_historico (nunca sandbox,
//      nunca dentro de agendamento_ativo).
//   8) Mensagens buscadas por telefone_canonico exato.
//   9) Erros de RPC/query → 500 sanitizado (sem PII) para permitir retry.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico as telefoneCanonicoLocal, maskTelefone } from "../_shared/telefoneCanonico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TERMINAIS = ["ATENDIDO", "CANCELADO", "COMPARECEU"];

const BodySchema = z.object({
  telefone_whatsapp: z.string().min(8),
  formato: z.enum(["completo", "compacto"]).optional().default("completo"),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripNulls<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

function calcularIdade(dataNasc: string | null): number | null {
  if (!dataNasc) return null;
  const d = new Date(dataNasc);
  if (isNaN(d.getTime())) return null;
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000); // Belém UTC-3
  let idade = agora.getUTCFullYear() - d.getUTCFullYear();
  const m = agora.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && agora.getUTCDate() < d.getUTCDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

/** YYYY-MM-DD do dia atual em America/Belem (UTC-3, sem DST). */
function hojeBelemISO(): string {
  const belem = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${belem.getUTCFullYear()}-${String(belem.getUTCMonth() + 1).padStart(2, "0")}-${String(belem.getUTCDate()).padStart(2, "0")}`;
}

function diasAte(dataAg: string | null, hojeISO: string): number | null {
  if (!dataAg) return null;
  const [hy, hm, hd] = hojeISO.split("-").map(Number);
  const [y, mo, d] = dataAg.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const alvo = Date.UTC(y, mo - 1, d);
  const hoje = Date.UTC(hy, hm - 1, hd);
  return Math.round((alvo - hoje) / 86400000);
}

function truncar(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function isTerminal(status: string | null | undefined): boolean {
  return TERMINAIS.includes(String(status ?? "").toUpperCase());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  const rid = requestId(req);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "invalid_json", request_id: rid }, 400);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "invalid_body", request_id: rid }, 400);
  }

  const telefoneInput = parsed.data.telefone_whatsapp;
  const formato = parsed.data.formato;
  const geradoEm = new Date().toISOString();

  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) return json({ error: "server_misconfigured", request_id: rid }, 500);
  const supabase = createClient(url, svc, { auth: { persistSession: false } });

  // 1) telefone_canonico (RPC + fallback local)
  let telCanon: string | null = null;
  try {
    const { data, error } = await supabase.rpc("telefone_canonico", { p_telefone: telefoneInput });
    if (!error && typeof data === "string" && data.length > 0) telCanon = data;
  } catch (_e) {
    /* fallback abaixo */
  }
  if (!telCanon) telCanon = telefoneCanonicoLocal(telefoneInput);
  if (!telCanon) {
    return json(
      formato === "compacto"
        ? { conhecido: false, telefone_canonico: null, gerado_em: geradoEm, request_id: rid }
        : {
            paciente: null,
            agendamento_ativo: null,
            ultimo_atendimento_historico: null,
            status_crm: null,
            estado_atendimento: null,
            ultimas_mensagens: [],
            telefone_canonico: null,
            request_id: rid,
          },
    );
  }

  // 2) Busca por telefone_canonico exato, sem sandbox
  const { data: candidatos, error: selErr } = await supabase
    .from("agendamentos")
    .select(
      "id, nome_completo, telefone_whatsapp, telefone_canonico, data_nascimento, email, convenio, convenio_outro, tipo_atendimento, local_atendimento, detalhe_exame_ou_cirurgia, observacoes_internas, origem, status_crm, status_funil, estado_atendimento, data_agendamento, hora_agendamento, created_at, is_sandbox",
    )
    .eq("telefone_canonico", telCanon)
    .neq("is_sandbox", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (selErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "buscar-contexto-paciente",
      message: "agendamentos_lookup_failed",
      details: { request_id: rid, telefone_mask: maskTelefone(telefoneInput), pg_code: (selErr as any).code ?? null },
      request_id: rid,
    });
    return json({ error: "agendamentos_lookup_failed", request_id: rid }, 500);
  }

  const registros = (candidatos ?? []).filter((r: any) => r.is_sandbox !== true);
  const ativos = registros.filter((r: any) => !isTerminal(r.status_crm));

  const hojeISO = hojeBelemISO();

  // 3) mensagens por telefone_canonico exato
  const limMsgs = formato === "compacto" ? 6 : 10;
  const { data: msgsRaw, error: msgErr } = await supabase
    .from("mensagens_whatsapp")
    .select("tipo_mensagem, conteudo, created_at, direcao, telefone_canonico")
    .eq("telefone_canonico", telCanon)
    .order("created_at", { ascending: false })
    .limit(limMsgs);

  if (msgErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "buscar-contexto-paciente",
      message: "mensagens_lookup_failed",
      details: { request_id: rid, telefone_mask: maskTelefone(telefoneInput), pg_code: (msgErr as any).code ?? null },
      request_id: rid,
    });
    return json({ error: "mensagens_lookup_failed", request_id: rid }, 500);
  }

  // 4) Ambíguo se >1 ativo
  const ambiguo = ativos.length > 1;

  // 5) Escolhe lead ativo único (quando aplicável)
  const leadAtivo = !ambiguo && ativos.length === 1 ? ativos[0] : null;

  // 6) agendamento_ativo apenas com data >= hoje e status não terminal
  let agendamentoAtivo: any = null;
  if (leadAtivo && leadAtivo.data_agendamento && leadAtivo.data_agendamento >= hojeISO) {
    agendamentoAtivo = {
      id: leadAtivo.id,
      data: leadAtivo.data_agendamento,
      hora: leadAtivo.hora_agendamento,
      status: leadAtivo.status_funil ?? null,
      local: leadAtivo.local_atendimento ?? null,
      dias_ate: diasAte(leadAtivo.data_agendamento, hojeISO),
    };
  }

  // 7) histórico: último atendimento terminal OU data passada (não sandbox)
  const historico =
    registros
      .filter(
        (r: any) =>
          (isTerminal(r.status_crm) || (r.data_agendamento && r.data_agendamento < hojeISO)) &&
          r.data_agendamento,
      )
      .sort((a: any, b: any) => (a.data_agendamento < b.data_agendamento ? 1 : -1))[0] ?? null;

  const ultimoAtendimentoHistorico = historico
    ? stripNulls({
        data: historico.data_agendamento,
        hora: historico.hora_agendamento,
        local: historico.local_atendimento ?? null,
        status: historico.status_crm ?? null,
        tipo_atendimento: historico.tipo_atendimento ?? null,
      })
    : null;

  // ---------- COMPACTO ----------
  if (formato === "compacto") {
    const ultimas_mensagens_resumo = (msgsRaw ?? []).map((m: any) => ({
      de: (m.direcao ?? "").toString().toLowerCase() === "out" ? "leticia" : "paciente",
      quando: m.created_at,
      texto: truncar(m.conteudo, 200),
    }));

    if (ambiguo) {
      const resp: Record<string, any> = {
        conhecido: true,
        ambiguo: true,
        total_ativos: ativos.length,
        paciente: null,
        agendamento_ativo: null,
        telefone_canonico: telCanon,
        gerado_em: geradoEm,
        request_id: rid,
      };
      if (ultimas_mensagens_resumo.length) resp.ultimas_mensagens_resumo = ultimas_mensagens_resumo;
      return json(resp);
    }

    if (!leadAtivo) {
      const resp: Record<string, any> = {
        conhecido: false,
        telefone_canonico: telCanon,
        gerado_em: geradoEm,
        request_id: rid,
      };
      if (ultimoAtendimentoHistorico) resp.ultimo_atendimento_historico = ultimoAtendimentoHistorico;
      if (ultimas_mensagens_resumo.length) resp.ultimas_mensagens_resumo = ultimas_mensagens_resumo;
      return json(resp);
    }

    const a: any = leadAtivo;
    const conv = a.convenio === "Outro" && a.convenio_outro ? a.convenio_outro : a.convenio;
    const primeiroNome = (a.nome_completo ?? "").trim().split(/\s+/)[0] || null;

    const paciente = stripNulls({
      primeiro_nome: primeiroNome,
      nome_completo: a.nome_completo ?? null,
      convenio: conv ?? null,
      tipo_atendimento: a.tipo_atendimento ?? null,
      local: a.local_atendimento ?? null,
      idade: calcularIdade(a.data_nascimento),
    });

    const resp: Record<string, any> = stripNulls({
      conhecido: true,
      ambiguo: false,
      paciente: Object.keys(paciente).length ? paciente : null,
      agendamento_ativo: agendamentoAtivo,
      estado_atendimento: a.estado_atendimento ?? "novo",
      status_crm: a.status_crm ?? null,
      telefone_canonico: telCanon,
      gerado_em: geradoEm,
      request_id: rid,
    });
    if (ultimoAtendimentoHistorico) resp.ultimo_atendimento_historico = ultimoAtendimentoHistorico;
    if (ultimas_mensagens_resumo.length) resp.ultimas_mensagens_resumo = ultimas_mensagens_resumo;
    return json(resp);
  }

  // ---------- COMPLETO ----------
  const ultimas_mensagens = (msgsRaw ?? []).map((m: any) => ({
    tipo: m.tipo_mensagem ?? "whatsapp",
    conteudo: m.conteudo,
    criado_em: m.created_at,
    direcao: (m.direcao ?? "").toString().toLowerCase() === "out" ? "out" : "in",
  }));

  if (ambiguo) {
    return json({
      conhecido: true,
      ambiguo: true,
      total_ativos: ativos.length,
      paciente: null,
      agendamento_ativo: null,
      ultimo_atendimento_historico: ultimoAtendimentoHistorico,
      status_crm: null,
      estado_atendimento: null,
      ultimas_mensagens,
      telefone_canonico: telCanon,
      request_id: rid,
    });
  }

  if (!leadAtivo) {
    return json({
      conhecido: false,
      ambiguo: false,
      paciente: null,
      agendamento_ativo: null,
      ultimo_atendimento_historico: ultimoAtendimentoHistorico,
      status_crm: null,
      estado_atendimento: null,
      ultimas_mensagens,
      telefone_canonico: telCanon,
      request_id: rid,
    });
  }

  const a: any = leadAtivo;
  const conv = a.convenio === "Outro" && a.convenio_outro ? a.convenio_outro : a.convenio;

  return json({
    conhecido: true,
    ambiguo: false,
    paciente: {
      nome_completo: a.nome_completo ?? null,
      data_nascimento: a.data_nascimento ?? null,
      convenio: conv ?? null,
      tipo_atendimento: a.tipo_atendimento ?? null,
      local_atendimento: a.local_atendimento ?? null,
      email: a.email ?? null,
      origem: a.origem ?? null,
      observacoes_internas:
        a.observacoes_internas && a.observacoes_internas !== "[ENCRYPTED]"
          ? a.observacoes_internas
          : null,
    },
    agendamento_ativo: agendamentoAtivo,
    ultimo_atendimento_historico: ultimoAtendimentoHistorico,
    status_crm: a.status_crm ?? null,
    estado_atendimento: a.estado_atendimento ?? "novo",
    ultimas_mensagens,
    telefone_canonico: telCanon,
    agendamento_id: agendamentoAtivo?.id ?? null,
    request_id: rid,
  });
});
