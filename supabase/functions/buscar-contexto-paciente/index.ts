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
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emptyResponse(telefone: string) {
  return {
    paciente: null,
    agendamento_ativo: null,
    status_crm: null,
    estado_atendimento: null,
    ultimas_mensagens: [],
    telefone_normalizado: telefone,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: aceita N8N_SHARED_SECRET (padrão atual) ou LOVABLE_N8N_SECRET (alias)
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
  const norm = telefoneInput.replace(/\D/g, "");
  const last8 = norm.slice(-8);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (last8.length < 8) {
    return json(emptyResponse(norm));
  }

  // Busca agendamento mais recente por telefone (match por últimos 8 dígitos)
  const { data: candidatos, error: selErr } = await supabase
    .from("agendamentos")
    .select(
      "id, nome_completo, telefone_whatsapp, data_nascimento, email, convenio, convenio_outro, tipo_atendimento, local_atendimento, detalhe_exame_ou_cirurgia, observacoes_internas, origem, status_crm, status_funil, estado_atendimento, data_agendamento, hora_agendamento, created_at, is_sandbox",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (selErr) {
    console.error("Erro buscando agendamentos:", selErr);
    return json(emptyResponse(norm));
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

  // Últimas 10 mensagens — telefone armazenado já normalizado (ver registrar-mensagem-in-n8n)
  const { data: msgsRaw } = await supabase
    .from("mensagens_whatsapp")
    .select("tipo_mensagem, conteudo, created_at, direcao, telefone")
    .ilike("telefone", `%${last8}`)
    .order("created_at", { ascending: false })
    .limit(10);

  const ultimas_mensagens = (msgsRaw ?? []).map((m: any) => ({
    tipo: m.tipo_mensagem ?? "whatsapp",
    conteudo: m.conteudo,
    criado_em: m.created_at,
    direcao: (m.direcao ?? "").toString().toLowerCase() === "out" ? "out" : "in",
  }));

  if (!agendamentoMaisRecente) {
    return json({
      ...emptyResponse(norm),
      ultimas_mensagens,
    });
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
