import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function emptyResponseCompleto(telefone: string) {
  return {
    paciente: null,
    agendamento_ativo: null,
    status_crm: null,
    estado_atendimento: null,
    ultimas_mensagens: [],
    telefone_normalizado: telefone,
  };
}

// Remove chaves null/undefined/"" recursivamente em objetos planos
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
  // Hora atual em America/Belem (UTC-3, sem DST)
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  let idade = agora.getUTCFullYear() - d.getUTCFullYear();
  const m = agora.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && agora.getUTCDate() < d.getUTCDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

function diasAte(dataAg: string | null): number | null {
  if (!dataAg) return null;
  // Belém UTC-3
  const agoraBelem = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hoje = Date.UTC(
    agoraBelem.getUTCFullYear(),
    agoraBelem.getUTCMonth(),
    agoraBelem.getUTCDate(),
  );
  const [y, mo, d] = dataAg.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const alvo = Date.UTC(y, mo - 1, d);
  return Math.round((alvo - hoje) / 86400000);
}

function truncar(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret =
    Deno.env.get("N8N_SHARED_SECRET") ?? Deno.env.get("LOVABLE_N8N_SECRET");
  const provided = req.headers.get("x-n8n-secret");
  if (!secret || !provided || provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const telefoneInput = parsed.data.telefone_whatsapp;
  const formato = parsed.data.formato;
  const norm = telefoneInput.replace(/\D/g, "");
  const last8 = norm.slice(-8);
  const geradoEm = new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (last8.length < 8) {
    return json(
      formato === "compacto"
        ? { conhecido: false, telefone_normalizado: norm, gerado_em: geradoEm }
        : emptyResponseCompleto(norm),
    );
  }

  const { data: candidatos, error: selErr } = await supabase
    .from("agendamentos")
    .select(
      "id, nome_completo, telefone_whatsapp, data_nascimento, email, convenio, convenio_outro, tipo_atendimento, local_atendimento, detalhe_exame_ou_cirurgia, observacoes_internas, origem, status_crm, status_funil, estado_atendimento, data_agendamento, hora_agendamento, created_at, is_sandbox",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (selErr) {
    console.error("Erro buscando agendamentos:", selErr);
    return json(
      formato === "compacto"
        ? { conhecido: false, telefone_normalizado: norm, gerado_em: geradoEm }
        : emptyResponseCompleto(norm),
    );
  }

  const agendamentoMaisRecente = (candidatos ?? [])
    .filter((a: any) =>
      (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8),
    )
    .sort((a: any, b: any) => {
      const sb = Number(a.is_sandbox ?? false) - Number(b.is_sandbox ?? false);
      if (sb !== 0) return sb;
      const da = Number(!!b.data_agendamento) - Number(!!a.data_agendamento);
      if (da !== 0) return da;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];

  const limMsgs = formato === "compacto" ? 6 : 10;
  const { data: msgsRaw } = await supabase
    .from("mensagens_whatsapp")
    .select("tipo_mensagem, conteudo, created_at, direcao, telefone")
    .ilike("telefone", `%${last8}`)
    .order("created_at", { ascending: false })
    .limit(limMsgs);

  // ---------- COMPACTO ----------
  if (formato === "compacto") {
    const ultimas_mensagens_resumo = (msgsRaw ?? []).map((m: any) => ({
      de: (m.direcao ?? "").toString().toLowerCase() === "out" ? "leticia" : "paciente",
      quando: m.created_at,
      texto: truncar(m.conteudo, 200),
    }));

    if (!agendamentoMaisRecente) {
      const resp: Record<string, any> = {
        conhecido: false,
        telefone_normalizado: norm,
        gerado_em: geradoEm,
      };
      if (ultimas_mensagens_resumo.length) {
        resp.ultimas_mensagens_resumo = ultimas_mensagens_resumo;
      }
      return json(resp);
    }

    const a: any = agendamentoMaisRecente;
    const conv =
      a.convenio === "Outro" && a.convenio_outro ? a.convenio_outro : a.convenio;
    const primeiroNome = (a.nome_completo ?? "").trim().split(/\s+/)[0] || null;

    const paciente = stripNulls({
      primeiro_nome: primeiroNome,
      nome_completo: a.nome_completo ?? null,
      convenio: conv ?? null,
      tipo_atendimento: a.tipo_atendimento ?? null,
      local: a.local_atendimento ?? null,
      idade: calcularIdade(a.data_nascimento),
    });

    const agendamento_ativo = a.data_agendamento
      ? stripNulls({
          id: a.id,
          data: a.data_agendamento,
          hora: a.hora_agendamento,
          status: a.status_funil ?? null,
          dias_ate: diasAte(a.data_agendamento),
        })
      : null;

    const resp: Record<string, any> = stripNulls({
      conhecido: true,
      paciente: Object.keys(paciente).length ? paciente : null,
      agendamento_ativo,
      estado_atendimento: a.estado_atendimento ?? "novo",
      status_crm: a.status_crm ?? null,
      telefone_normalizado: norm,
      gerado_em: geradoEm,
    });
    if (ultimas_mensagens_resumo.length) {
      resp.ultimas_mensagens_resumo = ultimas_mensagens_resumo;
    }
    return json(resp);
  }

  // ---------- COMPLETO (compat: igual ao comportamento anterior) ----------
  const ultimas_mensagens = (msgsRaw ?? []).map((m: any) => ({
    tipo: m.tipo_mensagem ?? "whatsapp",
    conteudo: m.conteudo,
    criado_em: m.created_at,
    direcao: (m.direcao ?? "").toString().toLowerCase() === "out" ? "out" : "in",
  }));

  if (!agendamentoMaisRecente) {
    return json({ ...emptyResponseCompleto(norm), ultimas_mensagens });
  }

  const a: any = agendamentoMaisRecente;
  const conv =
    a.convenio === "Outro" && a.convenio_outro ? a.convenio_outro : a.convenio;

  return json({
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
    agendamento_ativo: a.data_agendamento
      ? {
          id: a.id,
          data: a.data_agendamento,
          hora: a.hora_agendamento,
          status: a.status_funil ?? null,
          local: a.local_atendimento ?? null,
          criado_em: a.created_at,
        }
      : null,
    status_crm: a.status_crm ?? null,
    estado_atendimento: a.estado_atendimento ?? "novo",
    ultimas_mensagens,
    telefone_normalizado: norm,
    agendamento_id: a.id,
  });
});
