// ============================================================================
// registrar-mensagem-in-n8n
// Recebe mensagens IN vindas do n8n (originadas do ManyChat).
// Fluxo canônico:
//   1) requireN8nSecret (timing-safe) + x-request-id
//   2) Idempotência forte por mensagem_externa_id ANTES de qualquer mutação.
//      Se dup existir mas estiver órfã, tenta RPC de vinculação novamente.
//   3) Normaliza telefone (E.164). Erro da RPC → 500 sem PII.
//   4) Insere mensagens_whatsapp IN com agendamento_id=NULL,
//      provider='manychat', provider_message_id=externo e payload sanitizado.
//   5) Chama RPC public.vincular_mensagem_por_telefone(mensagem_id,nome).
//      Erro da RPC → responde 500 { error:'vinculo_falhou', persisted:true,
//      mensagem_id, request_id } para permitir retry idempotente pelo n8n
//      (a próxima tentativa cai em duplicata órfã e re-executa a RPC).
//   6) Backfill de nome quando o cadastro está com placeholder.
// NUNCA cria lead diretamente na Edge Function. NUNCA vaza PII no response.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  telefone: z.string().min(8),
  conteudo: z.string().min(1),
  mensagem_externa_id: z.string().optional(),
  tipo_mensagem: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  nome_contato: z.string().max(200).optional(),
  subscriber_id: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
});

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function derivarNomeContato(bodyNome: string | undefined, payload: Record<string, any>): string {
  const bruto =
    (bodyNome ?? "").trim() ||
    (payload.pushName ?? "").toString().trim() ||
    (payload.notifyName ?? "").toString().trim() ||
    (payload.sender?.pushName ?? "").toString().trim() ||
    (payload.contact?.name ?? "").toString().trim() ||
    "";
  const ehPlaceholder =
    !bruto ||
    /^lead\s*whatsapp$/i.test(bruto) ||
    /^paciente$/i.test(bruto) ||
    /^\+?\d[\d\s\-()]+$/.test(bruto);
  return ehPlaceholder ? "" : bruto;
}

function sanitizePayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (/token|secret|password|authorization|apikey/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Tenta vincular a mensagem via RPC. Retorna { ok, info } — nunca lança.
 * Em falha registra system_log SEM PII e devolve ok=false para o caller
 * decidir HTTP code.
 */
async function tentarVinculo(
  supabase: ReturnType<typeof createClient>,
  mensagemId: string,
  nomeContato: string,
  rid: string,
): Promise<{ ok: true; info: Record<string, any> } | { ok: false }> {
  const { data, error } = await supabase.rpc("vincular_mensagem_por_telefone", {
    p_mensagem_id: mensagemId,
    p_nome_contato: nomeContato || null,
  });
  if (error) {
    await supabase.from("system_logs").insert({
      level: "warn",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: "vinculo_falhou",
      details: {
        mensagem_id: mensagemId,
        request_id: rid,
        pg_code: (error as any).code ?? null,
      },
      request_id: rid,
    });
    return { ok: false };
  }
  return { ok: true, info: (data ?? {}) as Record<string, any> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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
    return json({ error: "invalid_json", request_id: rid }, 400, headers);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { error: "invalid_body", details: parsed.error.flatten(), request_id: rid },
      400,
      headers,
    );
  }
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const payloadIn = (body.payload ?? {}) as Record<string, any>;
  const nomeContato = derivarNomeContato(body.nome_contato, payloadIn);
  const providerMessageId = body.mensagem_externa_id?.trim() || null;

  // 1) Idempotência ANTES de qualquer mutação
  if (providerMessageId) {
    const { data: existente, error: dupErr } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("mensagem_externa_id", providerMessageId)
      .maybeSingle();
    if (dupErr) {
      return json({ error: "lookup_failed", request_id: rid }, 500, headers);
    }
    if (existente) {
      let agendamentoId: string | null = existente.agendamento_id ?? null;
      let info: Record<string, any> = {};
      if (!agendamentoId) {
        const v = await tentarVinculo(supabase, existente.id, nomeContato, rid);
        if (!v.ok) {
          return json(
            {
              error: "vinculo_falhou",
              persisted: true,
              mensagem_id: existente.id,
              request_id: rid,
            },
            500,
            headers,
          );
        }
        info = v.info;
        agendamentoId = info.agendamento_id ?? null;
      }
      return json(
        {
          ok: true,
          mensagem_id: existente.id,
          agendamento_id: agendamentoId,
          agendamento_encontrado: !!agendamentoId,
          ambiguo: !!info.ambiguo,
          total_matches: info.total_matches ?? null,
          duplicada: true,
          request_id: rid,
        },
        200,
        headers,
      );
    }
  }

  // 2) Normaliza telefone (E.164) — erro é fatal para o insert coerente
  const { data: telNorm, error: telErr } = await supabase.rpc("normalizar_telefone", {
    p_telefone: body.telefone,
  });
  if (telErr) {
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
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

  // 3) Payload sanitizado
  const payloadSanit = sanitizePayload({
    ...payloadIn,
    subscriber_id: body.subscriber_id ?? payloadIn.subscriber_id ?? null,
    origem: body.origem ?? payloadIn.origem ?? "n8n_manychat",
    request_id: rid,
  });

  const insertRow: Record<string, unknown> = {
    telefone: telefoneNormalizado,
    direcao: "IN",
    conteudo: body.conteudo,
    mensagem_externa_id: providerMessageId,
    tipo_mensagem: body.tipo_mensagem ?? "whatsapp",
    status_envio: "recebida",
    provider: "manychat",
    provider_message_id: providerMessageId,
    payload: payloadSanit,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mensagens_whatsapp")
    .insert(insertRow)
    .select("id, agendamento_id")
    .single();

  if (insErr) {
    // Race no UNIQUE (mensagem_externa_id OU provider/provider_message_id)
    if (providerMessageId && (insErr.code === "23505" || /duplicate key/i.test(insErr.message))) {
      const { data: existente } = await supabase
        .from("mensagens_whatsapp")
        .select("id, agendamento_id")
        .eq("mensagem_externa_id", providerMessageId)
        .maybeSingle();
      if (existente) {
        let agendamentoId: string | null = existente.agendamento_id ?? null;
        let info: Record<string, any> = {};
        if (!agendamentoId) {
          const v = await tentarVinculo(supabase, existente.id, nomeContato, rid);
          if (!v.ok) {
            return json(
              {
                error: "vinculo_falhou",
                persisted: true,
                mensagem_id: existente.id,
                request_id: rid,
              },
              500,
              headers,
            );
          }
          info = v.info;
          agendamentoId = info.agendamento_id ?? null;
        }
        return json(
          {
            ok: true,
            mensagem_id: existente.id,
            agendamento_id: agendamentoId,
            agendamento_encontrado: !!agendamentoId,
            ambiguo: !!info.ambiguo,
            total_matches: info.total_matches ?? null,
            duplicada: true,
            request_id: rid,
          },
          200,
          headers,
        );
      }
    }
    await supabase.from("system_logs").insert({
      level: "error",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: "insert_in_falhou",
      details: {
        request_id: rid,
        telefone_mask: maskTelefone(telefoneNormalizado),
        has_provider_msg_id: !!providerMessageId,
        pg_code: (insErr as any).code ?? null,
      },
      request_id: rid,
    });
    return json({ error: "insert_in_falhou", request_id: rid }, 500, headers);
  }

  // 4) Vinculação determinística via RPC.
  //    Falha aqui → mensagem já foi persistida; devolvemos 500 com persisted=true
  //    e mensagem_id para o n8n retentar idempotentemente.
  const v = await tentarVinculo(supabase, inserted.id, nomeContato, rid);
  if (!v.ok) {
    return json(
      {
        error: "vinculo_falhou",
        persisted: true,
        mensagem_id: inserted.id,
        request_id: rid,
      },
      500,
      headers,
    );
  }
  const info = v.info;
  const agendamentoId = info.agendamento_id ?? null;

  // 5) Backfill de nome quando placeholder
  if (agendamentoId && !info.criado && nomeContato.length > 1) {
    const { data: atual } = await supabase
      .from("agendamentos")
      .select("nome_completo")
      .eq("id", agendamentoId)
      .maybeSingle();
    const nomeAtual = (atual?.nome_completo ?? "").trim();
    const ehPlaceholder =
      !nomeAtual ||
      /^lead\s*whatsapp$/i.test(nomeAtual) ||
      /^paciente$/i.test(nomeAtual);
    if (ehPlaceholder) {
      await supabase
        .from("agendamentos")
        .update({ nome_completo: nomeContato })
        .eq("id", agendamentoId);
    }
  }

  return json(
    {
      ok: true,
      mensagem_id: inserted.id,
      agendamento_id: agendamentoId,
      agendamento_encontrado: !!agendamentoId,
      lead_criado: !!info.criado,
      ambiguo: !!info.ambiguo,
      total_matches: info.total_matches ?? null,
      duplicada: false,
      request_id: rid,
    },
    200,
    headers,
  );
});
