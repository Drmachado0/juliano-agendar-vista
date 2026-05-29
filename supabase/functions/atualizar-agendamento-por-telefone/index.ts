import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  telefone_whatsapp: z.string().min(8),
  nome_completo: z.string().min(1).max(200).optional(),
  convenio: z.string().max(100).optional(),
  tipo_atendimento: z.string().max(50).optional(),
  local_atendimento: z.string().max(200).optional(),
  detalhe_exame_ou_cirurgia: z.string().max(500).optional(),
  observacoes_internas: z.string().max(2000).optional(),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado_atendimento: z.string().max(60).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const provided = req.headers.get("x-n8n-secret");
  if (!sharedSecret || !provided || provided !== sharedSecret) {
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
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Busca agendamento mais recente por telefone normalizado (últimos 8 dígitos)
  const norm = body.telefone_whatsapp.replace(/\D/g, "");
  const last8 = norm.slice(-8);
  if (last8.length < 8) return json({ error: "Telefone inválido" }, 400);

  const { data: candidatos, error: selErr } = await supabase
    .from("agendamentos")
    .select("id, telefone_whatsapp, observacoes_internas, status_crm, status_funil, hora_agendamento, created_at, is_sandbox, data_agendamento")
    .order("created_at", { ascending: false })
    .limit(200);

  if (selErr) return json({ error: selErr.message }, 500);

  const match = (candidatos ?? [])
    .filter((a: any) => (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8))
    .sort((a: any, b: any) => {
      // não-sandbox primeiro, com data primeiro, mais recente primeiro
      const sb = Number(a.is_sandbox ?? false) - Number(b.is_sandbox ?? false);
      if (sb !== 0) return sb;
      const da = Number(!!b.data_agendamento) - Number(!!a.data_agendamento);
      if (da !== 0) return da;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];

  if (!match) {
    // UPSERT: cria um lead novo (SEM data/hora). Schema Zod já bloqueia data_agendamento/hora_agendamento.
    const insertLead: Record<string, unknown> = {
      nome_completo: body.nome_completo?.trim() || "Lead WhatsApp",
      telefone_whatsapp: body.telefone_whatsapp,
      tipo_atendimento: body.tipo_atendimento || "Consulta",
      local_atendimento: body.local_atendimento || "A definir",
      convenio: body.convenio || "Particular",
      detalhe_exame_ou_cirurgia: body.detalhe_exame_ou_cirurgia ?? null,
      data_nascimento: body.data_nascimento ?? null,
      estado_atendimento: body.estado_atendimento || "novo",
      status_crm: "NOVO LEAD",
      status_funil: "novo",
      origem: "whatsapp",
    };
    if (body.observacoes_internas && body.observacoes_internas.trim().length > 0) {
      const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      insertLead.observacoes_internas = `[${stamp} · n8n] ${body.observacoes_internas.trim()}`;
    }
    const { data: novoLead, error: insErr } = await supabase
      .from("agendamentos")
      .insert(insertLead)
      .select("id")
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    await supabase.from("crm_audit_log").insert({
      agendamento_id: novoLead.id,
      user_id: null,
      user_email: "n8n@bot",
      user_name: "n8n (bot)",
      acao: "criar_lead_por_telefone_n8n",
      status_anterior: null,
      status_novo: "novo",
      detalhes: { telefone_input: body.telefone_whatsapp, campos: Object.keys(insertLead) },
    });

    return json({
      agendamento_id: novoLead.id,
      campos_atualizados: Object.keys(insertLead),
      lead_criado: true,
    });
  }

  const updates: Record<string, unknown> = {};
  const camposAtualizados: string[] = [];

  const passthrough: (keyof typeof body)[] = [
    "nome_completo",
    "convenio",
    "tipo_atendimento",
    "local_atendimento",
    "detalhe_exame_ou_cirurgia",
    "data_nascimento",
    "estado_atendimento",
  ];
  for (const k of passthrough) {
    if (body[k] !== undefined && body[k] !== null && String(body[k]).length > 0) {
      updates[k] = body[k];
      camposAtualizados.push(k);
    }
  }

  // observacoes_internas: APPEND com timestamp
  if (body.observacoes_internas && body.observacoes_internas.trim().length > 0) {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const linhaNova = `[${stamp} · n8n] ${body.observacoes_internas.trim()}`;
    const atual = (match as any).observacoes_internas;
    const base = atual && atual !== "[ENCRYPTED]" ? `${atual}\n` : "";
    updates.observacoes_internas = `${base}${linhaNova}`;
    camposAtualizados.push("observacoes_internas");
  }

  // Promoção automática de status_funil (nunca rebaixa, nunca toca estados finais)
  const FINAIS = new Set(["agendado", "compareceu", "faltou", "cancelado"]);
  const statusAtual = ((match as any).status_funil as string) || "novo";
  let promocao: { de: string; para: string } | null = null;
  if (!FINAIS.has(statusAtual)) {
    // 1) n8n sinalizou que está apresentando resumo para confirmação
    if (body.estado_atendimento === "aguardando_confirmacao" && statusAtual !== "aguardando_confirmacao") {
      updates.status_funil = "aguardando_confirmacao";
      promocao = { de: statusAtual, para: "aguardando_confirmacao" };
    }
    // 2) data/hora já preenchidos (fallback de segurança)
    else if ((match as any).data_agendamento && (match as any).hora_agendamento && statusAtual !== "aguardando_confirmacao") {
      updates.status_funil = "aguardando_confirmacao";
      promocao = { de: statusAtual, para: "aguardando_confirmacao" };
    }
    // 3) primeiro contato → em conversa
    else if (statusAtual === "novo") {
      updates.status_funil = "em_conversa";
      promocao = { de: "novo", para: "em_conversa" };
    }
  }

  if (camposAtualizados.length === 0 && !promocao) {
    return json({ agendamento_id: match.id, campos_atualizados: [] });
  }

  updates.updated_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("agendamentos")
    .update(updates)
    .eq("id", match.id);

  if (updErr) return json({ error: updErr.message }, 500);

  // Audit log via RPC (SECURITY DEFINER exige role admin → usamos insert direto via service role)
  await supabase.from("crm_audit_log").insert({
    agendamento_id: match.id,
    user_id: null,
    user_email: "n8n@bot",
    user_name: "n8n (bot)",
    acao: "atualizar_por_telefone_n8n",
    status_anterior: null,
    status_novo: null,
    detalhes: { campos_atualizados: camposAtualizados, telefone_input: body.telefone_whatsapp },
  });

  if (promocao) {
    await supabase.from("crm_audit_log").insert({
      agendamento_id: match.id,
      user_id: null,
      user_email: "n8n@bot",
      user_name: "n8n (bot)",
      acao: "status_funil_promovido",
      status_anterior: promocao.de,
      status_novo: promocao.para,
      detalhes: { motivo: "auto_n8n_update", telefone_input: body.telefone_whatsapp },
    });
  }

  return json({
    agendamento_id: match.id,
    campos_atualizados: camposAtualizados,
    status_funil: promocao?.para ?? statusAtual,
    promovido: !!promocao,
  });
});
