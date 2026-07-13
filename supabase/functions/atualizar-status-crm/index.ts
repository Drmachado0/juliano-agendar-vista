// ============================================================================
// atualizar-status-crm
// Atualiza status_crm de um agendamento existente. Endpoint n8n/ManyChat.
//
// Correção 2026-07-13 (bug 91991300174):
//   - requireN8nSecret timing-safe + x-request-id.
//   - Seleção por telefone_canonico EXATO (RPC + fallback). Zero last8, zero
//     scan de 200 registros.
//   - Filtro rigoroso de "ativo": is_sandbox != true, status_crm case-insensitive
//     NÃO em (ATENDIDO/CANCELADO/COMPARECEU) E status_funil case-insensitive NÃO
//     em (cancelado/compareceu/faltou). Isso evita reativar registro histórico
//     cancelado por reuso de telefone.
//   - 0 candidatos → 404 not_found. >1 → 409 ambiguo sem mutação. 1 → update.
//   - Se vier agendamento_id: valida is_sandbox != true e alvo NÃO terminal antes.
//   - Erros sanitizados (sem PII); logs com request_id e telefone mascarado.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico as telefoneCanonicoLocal, maskTelefone } from "../_shared/telefoneCanonico.ts";
import { isCrmTerminal, isFunilTerminal, isRegistroAtivo } from "../_shared/statusTerminais.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_VALIDOS = [
  "NOVO LEAD",
  "CLINICOR",
  "HGP",
  "BELÉM",
  "PRECISA_DE_HUMANO",
  "ATENDIDO",
  "YAG_LASER",
] as const;

const TERMINAIS_CRM = ["ATENDIDO", "CANCELADO", "COMPARECEU"];
const TERMINAIS_FUNIL = ["cancelado", "compareceu", "faltou"];

const BodySchema = z
  .object({
    agendamento_id: z.string().uuid().optional(),
    telefone_whatsapp: z.string().min(8).optional(),
    status_crm: z.enum(STATUS_VALIDOS),
    motivo: z.string().max(500).optional(),
  })
  .refine((d) => d.agendamento_id || d.telefone_whatsapp, {
    message: "informe_agendamento_id_ou_telefone",
  });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function isCrmTerminal(status: string | null | undefined): boolean {
  return TERMINAIS_CRM.includes(String(status ?? "").toUpperCase());
}
export function isFunilTerminal(status: string | null | undefined): boolean {
  return TERMINAIS_FUNIL.includes(String(status ?? "").toLowerCase());
}
export function isRegistroAtivo(r: { is_sandbox?: boolean | null; status_crm?: string | null; status_funil?: string | null }): boolean {
  if (r.is_sandbox === true) return false;
  if (isCrmTerminal(r.status_crm)) return false;
  if (isFunilTerminal(r.status_funil)) return false;
  return true;
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

  let agendamentoId = body.agendamento_id ?? null;

  // Ramo TELEFONE: busca por telefone_canonico exato
  if (!agendamentoId && body.telefone_whatsapp) {
    const telCanon = await resolveTelefoneCanonico(supabase, body.telefone_whatsapp);
    if (!telCanon) return json({ error: "telefone_invalido", request_id: rid }, 400);

    const { data: candidatos, error: selErr } = await supabase
      .from("agendamentos")
      .select("id, status_crm, status_funil, is_sandbox, created_at")
      .eq("telefone_canonico", telCanon)
      .neq("is_sandbox", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (selErr) {
      await supabase.from("system_logs").insert({
        level: "error",
        category: "edge_function",
        source: "atualizar-status-crm",
        message: "agendamentos_lookup_failed",
        details: { request_id: rid, telefone_mask: maskTelefone(body.telefone_whatsapp), pg_code: (selErr as any).code ?? null },
        request_id: rid,
      });
      return json({ error: "agendamentos_lookup_failed", request_id: rid }, 500);
    }

    const ativos = (candidatos ?? []).filter((r: any) => isRegistroAtivo(r));
    if (ativos.length === 0) {
      return json({ error: "agendamento_ativo_nao_encontrado", request_id: rid }, 404);
    }
    if (ativos.length > 1) {
      return json({ error: "ambiguo", request_id: rid, total_ativos: ativos.length }, 409);
    }
    agendamentoId = ativos[0].id as string;
  }

  // Ramo ID: valida sandbox + não terminal
  const { data: atual, error: getErr } = await supabase
    .from("agendamentos")
    .select("id, status_crm, status_funil, is_sandbox")
    .eq("id", agendamentoId!)
    .maybeSingle();
  if (getErr) {
    return json({ error: "agendamento_lookup_failed", request_id: rid }, 500);
  }
  if (!atual) return json({ error: "agendamento_nao_encontrado", request_id: rid }, 404);
  if ((atual as any).is_sandbox === true) {
    return json({ error: "sandbox_nao_permitido", request_id: rid }, 409);
  }
  if (isCrmTerminal((atual as any).status_crm) || isFunilTerminal((atual as any).status_funil)) {
    return json({ error: "registro_terminal", request_id: rid }, 409);
  }

  const statusAnterior = (atual as any).status_crm ?? null;
  const statusNovo = body.status_crm;
  const funilAtual = ((atual as any).status_funil as string) || "novo";

  // Espelhamento: YAG_LASER força status_funil='yag_laser' (a menos que esteja em estado final)
  const updates: Record<string, unknown> = {
    status_crm: statusNovo,
    updated_at: new Date().toISOString(),
  };
  let funilPromovido: { de: string; para: string } | null = null;
  if (statusNovo === "YAG_LASER" && funilAtual !== "yag_laser" && !isFunilTerminal(funilAtual)) {
    updates.status_funil = "yag_laser";
    funilPromovido = { de: funilAtual, para: "yag_laser" };
  }

  if (statusAnterior === statusNovo && !funilPromovido) {
    return json({
      agendamento_id: agendamentoId,
      status_crm_anterior: statusAnterior,
      status_crm_novo: statusNovo,
      noop: true,
      request_id: rid,
    });
  }

  const { error: updErr } = await supabase
    .from("agendamentos")
    .update(updates)
    .eq("id", agendamentoId!);
  if (updErr) {
    return json({ error: "agendamento_update_failed", request_id: rid }, 500);
  }

  if (funilPromovido) {
    await supabase.from("crm_audit_log").insert({
      agendamento_id: agendamentoId,
      user_id: null,
      user_email: "n8n@bot",
      user_name: "n8n (bot)",
      acao: "status_funil_promovido",
      status_anterior: funilPromovido.de,
      status_novo: funilPromovido.para,
      detalhes: { motivo: "espelhamento_yag_laser", origem: "atualizar-status-crm", request_id: rid },
    });
  }

  await supabase.from("crm_audit_log").insert({
    agendamento_id: agendamentoId,
    user_id: null,
    user_email: "n8n@bot",
    user_name: "n8n (bot)",
    acao: "status_change",
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    detalhes: { motivo: body.motivo ?? null, origem: "n8n", request_id: rid },
  });

  return json({
    agendamento_id: agendamentoId,
    status_crm_anterior: statusAnterior,
    status_crm_novo: statusNovo,
    request_id: rid,
  });
});
