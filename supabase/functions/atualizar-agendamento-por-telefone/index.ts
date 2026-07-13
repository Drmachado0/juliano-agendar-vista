// ============================================================================
// atualizar-agendamento-por-telefone
// Atualiza campos do lead a partir do telefone. Endpoint n8n/ManyChat.
//
// Correção 2026-07-13 (bug 91991300174):
//   - requireN8nSecret timing-safe + x-request-id.
//   - Seleção por telefone_canonico EXATO (RPC + fallback). Zero last8/scan200.
//   - Só considera ativo: is_sandbox != true, status_crm NÃO terminal
//     (ATENDIDO/CANCELADO/COMPARECEU) E status_funil NÃO terminal
//     (cancelado/compareceu/faltou). Nunca reativa registro histórico cancelado.
//   - 0 ativos → cria novo lead. >1 → 409 ambiguo sem mutação. 1 → update.
//   - Erros sanitizados; PII mascarada em logs.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico as telefoneCanonicoLocal, maskTelefone } from "../_shared/telefoneCanonico.ts";
import { isFunilTerminal, isRegistroAtivo } from "../_shared/statusTerminais.ts";
import { sanitizeOptionalPayload } from "../_shared/sanitizeOptionalFields.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Schema mínimo: só telefone_whatsapp é obrigatório e validado por formato.
// Campos opcionais são higienizados fora do zod (podem vir como "undefined"/"null"
// vindos do $fromAI do n8n/ManyChat). Aplicamos limites de tamanho após sanitizar.
const BodySchema = z.object({
  telefone_whatsapp: z.string().min(8),
}).passthrough();

const LIMITES: Record<string, number> = {
  nome_completo: 200,
  convenio: 100,
  tipo_atendimento: 50,
  local_atendimento: 200,
  detalhe_exame_ou_cirurgia: 500,
  observacoes_internas: 2000,
  estado_atendimento: 60,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}




async function resolveTelefoneCanonico(
  supabase: ReturnType<typeof createClient>,
  input: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("telefone_canonico", { p_telefone: input });
    if (!error && typeof data === "string" && data.length > 0) return data;
  } catch (_e) {
    /* fallback */
  }
  return telefoneCanonicoLocal(input);
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
  const body = parsed.data;

  const url = Deno.env.get("SUPABASE_URL");
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !svc) return json({ error: "server_misconfigured", request_id: rid }, 500);
  const supabase = createClient(url, svc, { auth: { persistSession: false } });

  const telCanon = await resolveTelefoneCanonico(supabase, body.telefone_whatsapp);
  if (!telCanon) return json({ error: "telefone_invalido", request_id: rid }, 400);

  const { data: candidatos, error: selErr } = await supabase
    .from("agendamentos")
    .select("id, telefone_whatsapp, observacoes_internas, status_crm, status_funil, hora_agendamento, data_agendamento, created_at, is_sandbox")
    .eq("telefone_canonico", telCanon)
    .neq("is_sandbox", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (selErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "atualizar-agendamento-por-telefone",
      message: "agendamentos_lookup_failed",
      details: { request_id: rid, telefone_mask: maskTelefone(body.telefone_whatsapp), pg_code: (selErr as any).code ?? null },
      request_id: rid,
    });
    return json({ error: "agendamentos_lookup_failed", request_id: rid }, 500);
  }

  const ativos = (candidatos ?? []).filter(isRegistroAtivo);

  if (ativos.length > 1) {
    return json({ error: "ambiguo", request_id: rid, total_ativos: ativos.length }, 409);
  }

  const match = ativos[0] ?? null;

  if (!match) {
    // Cria novo lead — NUNCA atualiza histórico/cancelado.
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
    if (insErr) return json({ error: "agendamento_insert_failed", request_id: rid }, 500);

    await supabase.from("crm_audit_log").insert({
      agendamento_id: novoLead.id,
      user_id: null,
      user_email: "n8n@bot",
      user_name: "n8n (bot)",
      acao: "criar_lead_por_telefone_n8n",
      status_anterior: null,
      status_novo: "novo",
      detalhes: { telefone_mask: maskTelefone(body.telefone_whatsapp), campos: Object.keys(insertLead), request_id: rid },
    });

    return json({
      agendamento_id: novoLead.id,
      campos_atualizados: Object.keys(insertLead),
      lead_criado: true,
      request_id: rid,
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

  // Promoção automática de status_funil (nunca rebaixa, nunca toca terminais nem yag_laser)
  const statusAtual = ((match as any).status_funil as string) || "novo";
  let promocao: { de: string; para: string } | null = null;

  if (body.estado_atendimento === "yag_laser_belem" && statusAtual !== "yag_laser" && !isFunilTerminal(statusAtual)) {
    updates.status_funil = "yag_laser";
    updates.status_crm = "YAG_LASER";
    camposAtualizados.push("status_funil", "status_crm");
    promocao = { de: statusAtual, para: "yag_laser" };
  } else if (!isFunilTerminal(statusAtual) && statusAtual !== "agendado") {
    if (body.estado_atendimento === "aguardando_confirmacao" && statusAtual !== "aguardando_confirmacao") {
      updates.status_funil = "aguardando_confirmacao";
      promocao = { de: statusAtual, para: "aguardando_confirmacao" };
    } else if ((match as any).data_agendamento && (match as any).hora_agendamento && statusAtual !== "aguardando_confirmacao") {
      updates.status_funil = "aguardando_confirmacao";
      promocao = { de: statusAtual, para: "aguardando_confirmacao" };
    } else if (statusAtual === "novo") {
      updates.status_funil = "em_conversa";
      promocao = { de: "novo", para: "em_conversa" };
    }
  }

  if (camposAtualizados.length === 0 && !promocao) {
    return json({ agendamento_id: match.id, campos_atualizados: [], request_id: rid });
  }

  updates.updated_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("agendamentos")
    .update(updates)
    .eq("id", match.id);

  if (updErr) return json({ error: "agendamento_update_failed", request_id: rid }, 500);

  await supabase.from("crm_audit_log").insert({
    agendamento_id: match.id,
    user_id: null,
    user_email: "n8n@bot",
    user_name: "n8n (bot)",
    acao: "atualizar_por_telefone_n8n",
    status_anterior: null,
    status_novo: null,
    detalhes: { campos_atualizados: camposAtualizados, telefone_mask: maskTelefone(body.telefone_whatsapp), request_id: rid },
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
      detalhes: { motivo: "auto_n8n_update", telefone_mask: maskTelefone(body.telefone_whatsapp), request_id: rid },
    });
  }

  return json({
    agendamento_id: match.id,
    campos_atualizados: camposAtualizados,
    status_funil: promocao?.para ?? statusAtual,
    promovido: !!promocao,
    request_id: rid,
  });
});
