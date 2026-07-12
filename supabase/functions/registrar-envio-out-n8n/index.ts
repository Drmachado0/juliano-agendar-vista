// ============================================================================
// registrar-envio-out-n8n
// Endpoint canônico chamado pelo n8n APÓS o sucesso do sendFlow do ManyChat.
// Registra a mensagem OUT em mensagens_whatsapp de forma idempotente
// (provider + provider_message_id) e opcionalmente vincula ao agendamento
// pelo telefone_canonico quando existe match único.
//
// NUNCA altera confirmation_status para mensagens genéricas (bot_agente,
// manual, boas_vindas, etc.). Apenas tipos explícitos de confirmação
// atualizam o funil.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { telefoneCanonico as canonicalFallback, maskTelefone } from "../_shared/telefoneCanonico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tipos que autorizam alterar campos de confirmação do agendamento
const CONFIRMATION_TYPES = new Set([
  "confirmacao_automatica",
  "confirmacao_consulta",
]);

const BodySchema = z.object({
  telefone: z.string().min(8),
  agendamento_id: z.string().uuid().nullable().optional(),
  conteudo: z.string().optional(),
  tipo_mensagem: z.string().default("bot_agente"),
  canal: z.string().optional(),
  provider: z.string().optional(),
  provider_message_id: z.string().optional().nullable(),
  subscriber_id: z.string().optional().nullable(),
  flow_ns: z.string().optional().nullable(),
  status: z
    .enum(["solicitado", "enviado", "entregue", "lido", "erro"])
    .default("enviado"),
  origem: z.string().optional().nullable(),
  request_id: z.string().optional().nullable(),
  erro: z.string().optional().nullable(),
});

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function sanitizePayload(input: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    // remove chaves potencialmente sensíveis
    if (/token|secret|password|authorization/i.test(k)) continue;
    clone[k] = v;
  }
  return clone;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rid = requestId(req);
  const headers = { "x-request-id": rid };

  const guard = await requireN8nSecret(req);
  if (!guard.ok) {
    return unauthorizedResponse(guard.reason ?? "unauthorized", { ...corsHeaders, ...headers });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400, headers);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400, headers);
  }
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const provider = (body.provider || body.canal || "manychat").toLowerCase();
  const providerMessageId = body.provider_message_id?.trim() || null;

  // 1) Idempotência via (provider, provider_message_id)
  if (providerMessageId) {
    const { data: dup, error: dupErr } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("provider", provider)
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    if (dupErr) {
      return json({ error: "lookup_failed", request_id: rid }, 500, headers);
    }
    if (dup) {
      return json(
        {
          ok: true,
          mensagem_id: dup.id,
          agendamento_id: dup.agendamento_id ?? null,
          duplicada: true,
        },
        200,
        headers,
      );
    }
  }

  // 2) Normalizar telefone
  //    - telefoneNormalizado (E.164 sem símbolos) → mensagens_whatsapp.telefone
  //    - telefoneCanonico    (BR sem DDI)          → agendamentos.telefone_canonico
  const { data: telNorm, error: telErr } = await supabase.rpc("normalizar_telefone", {
    p_telefone: body.telefone,
  });
  if (telErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-envio-out-n8n",
      message: "normalizar_telefone_falhou",
      details: { request_id: rid, pg_code: (telErr as any).code ?? null },
      request_id: rid,
    });
    return json({ error: "normalizar_telefone_falhou", request_id: rid }, 500, headers);
  }
  const telefoneNormalizado =
    (typeof telNorm === "string" && telNorm.length > 0
      ? telNorm
      : body.telefone.replace(/\D/g, ""));

  // telefone_canonico: RPC opcional; erro NÃO fatal — usa fallback local
  let telefoneCanon: string | null = null;
  const { data: telC, error: telCErr } = await supabase.rpc("telefone_canonico", {
    p_tel: body.telefone,
  });
  if (telCErr) {
    console.warn("[registrar-envio-out-n8n] telefone_canonico RPC falhou; usando fallback");
  } else if (typeof telC === "string" && telC.length > 0) {
    telefoneCanon = telC;
  }
  if (!telefoneCanon) telefoneCanon = canonicalFallback(body.telefone);

  // 3) Resolver agendamento
  //    a) explícito: validar existência + telefone_canonico compatível (409 no mismatch)
  //    b) sem explícito: match ÚNICO por telefone_canonico entre ATIVOS não-sandbox
  //       (mesma regra da RPC vincular_mensagem_por_telefone: exclui terminais
  //       ATENDIDO/CANCELADO/COMPARECEU case-insensitive)
  let agendamentoId: string | null = body.agendamento_id ?? null;
  let ambiguo = false;

  if (agendamentoId) {
    const { data: agend, error: agErr } = await supabase
      .from("agendamentos")
      .select("id, telefone_canonico")
      .eq("id", agendamentoId)
      .maybeSingle();
    if (agErr) {
      return json({ error: "agendamento_lookup_failed", request_id: rid }, 500, headers);
    }
    if (!agend) {
      return json(
        { error: "agendamento_not_found", agendamento_id: agendamentoId, request_id: rid },
        404,
        headers,
      );
    }
    if (telefoneCanon && agend.telefone_canonico && agend.telefone_canonico !== telefoneCanon) {
      await supabase.from("system_logs").insert({
        level: "warn",
        category: "edge_function",
        source: "registrar-envio-out-n8n",
        message: "telefone_agendamento_mismatch",
        details: {
          request_id: rid,
          agendamento_id: agendamentoId,
          telefone_mask: maskTelefone(telefoneNormalizado),
          provider,
        },
        request_id: rid,
      });
      return json(
        { error: "telefone_agendamento_mismatch", agendamento_id: agendamentoId, request_id: rid },
        409,
        headers,
      );
    }
  } else if (telefoneCanon) {
    // Ativos = não sandbox E status_crm NÃO terminal (case-insensitive)
    const TERMINAIS = ["ATENDIDO", "CANCELADO", "COMPARECEU"];
    const { data: matches, error: mErr } = await supabase
      .from("agendamentos")
      .select("id, status_crm, is_sandbox, created_at")
      .eq("telefone_canonico", telefoneCanon)
      .order("created_at", { ascending: false })
      .limit(20);
    if (mErr) {
      return json({ error: "agendamentos_lookup_failed", request_id: rid }, 500, headers);
    }
    const ativos = (matches ?? []).filter(
      (r) =>
        r.is_sandbox !== true &&
        !TERMINAIS.includes(String(r.status_crm ?? "").toUpperCase()),
    );
    if (ativos.length === 1) {
      agendamentoId = ativos[0].id;
    } else if (ativos.length > 1) {
      ambiguo = true;
    }
  }

  // 4) Mapeia status_envio (nomes internos)
  const statusEnvio = body.status === "erro" ? "erro" : body.status;

  const payload = sanitizePayload({
    provider,
    provider_message_id: providerMessageId,
    canal: body.canal ?? provider,
    subscriber_id: body.subscriber_id ?? null,
    flow_ns: body.flow_ns ?? null,
    origem: body.origem ?? "n8n_manychat",
    request_id: body.request_id ?? rid,
    erro: body.erro ?? null,
  });

  const insertRow: Record<string, unknown> = {
    agendamento_id: agendamentoId,
    telefone: telefoneNormalizado,
    direcao: "OUT",
    conteudo: body.conteudo ?? "(enviado via ManyChat)",
    tipo_mensagem: body.tipo_mensagem,
    status_envio: statusEnvio,
    mensagem_externa_id: providerMessageId,
    provider,
    provider_message_id: providerMessageId,
    payload,
    error_message: body.erro ?? null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mensagens_whatsapp")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    // Race no UNIQUE (provider, provider_message_id)
    if (
      providerMessageId &&
      (insErr.code === "23505" || /duplicate key/i.test(insErr.message))
    ) {
      const { data: dup } = await supabase
        .from("mensagens_whatsapp")
        .select("id, agendamento_id")
        .eq("provider", provider)
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (dup) {
        return json(
          {
            ok: true,
            mensagem_id: dup.id,
            agendamento_id: dup.agendamento_id ?? null,
            duplicada: true,
          },
          200,
          headers,
        );
      }
    }
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-envio-out-n8n",
      message: "insert_out_falhou",
      details: {
        request_id: rid,
        telefone_mask: maskTelefone(telefoneNormalizado),
        provider,
        has_provider_msg_id: !!providerMessageId,
        pg_code: (insErr as any).code ?? null,
      },
      request_id: rid,
    });
    return json({ error: "insert_out_falhou", request_id: rid }, 500, headers);
  }

  // 5) Atualizar campos de confirmação SOMENTE para tipos explícitos
  //    e nunca em status='erro'.
  if (
    agendamentoId &&
    CONFIRMATION_TYPES.has(body.tipo_mensagem) &&
    statusEnvio !== "erro"
  ) {
    const update: Record<string, unknown> = {
      confirmacao_enviada: true,
      confirmation_status: "aguardando_confirmacao",
      confirmation_sent_at: new Date().toISOString(),
      confirmation_channel: "whatsapp",
    };
    const { error: updErr } = await supabase
      .from("agendamentos")
      .update(update)
      .eq("id", agendamentoId);
    if (updErr) {
      console.error("[registrar-envio-out-n8n] update agend:", updErr.message);
    }
  }

  return json(
    {
      ok: true,
      mensagem_id: inserted.id,
      agendamento_id: agendamentoId,
      ambiguo,
      duplicada: false,
    },
    200,
    headers,
  );
});
