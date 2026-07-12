// ============================================================================
// registrar-mensagem-in-n8n
// Recebe mensagens IN vindas do n8n, insere em mensagens_whatsapp de forma
// idempotente e vincula ao agendamento correto via RPC determinística
// (vincular_mensagem_por_telefone, que usa telefone_canonico).
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";

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

  const payloadAny = (body.payload ?? {}) as Record<string, any>;
  const nomeContato = derivarNomeContato(body.nome_contato, payloadAny);

  // 1) Idempotência: se mensagem_externa_id já existe, retorna existente.
  if (body.mensagem_externa_id) {
    const { data: existente } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("mensagem_externa_id", body.mensagem_externa_id)
      .maybeSingle();
    if (existente) {
      return json(
        {
          ok: true,
          mensagem_id: existente.id,
          agendamento_id: existente.agendamento_id ?? null,
          agendamento_encontrado: !!existente.agendamento_id,
          duplicada: true,
        },
        200,
        headers,
      );
    }
  }

  // 2) Insere mensagem sem agendamento_id (vinculamos em seguida via RPC).
  const insertRow = {
    telefone: body.telefone,
    direcao: "IN",
    conteudo: body.conteudo,
    mensagem_externa_id: body.mensagem_externa_id ?? null,
    tipo_mensagem: body.tipo_mensagem ?? "whatsapp",
    status_envio: "recebida",
    payload: { ...(body.payload ?? {}), request_id: rid },
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mensagens_whatsapp")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    // Race no mensagem_externa_id (UNIQUE constraint).
    if (
      body.mensagem_externa_id &&
      (insErr.code === "23505" || /duplicate key/i.test(insErr.message))
    ) {
      const { data: existente } = await supabase
        .from("mensagens_whatsapp")
        .select("id, agendamento_id")
        .eq("mensagem_externa_id", body.mensagem_externa_id)
        .maybeSingle();
      if (existente) {
        return json(
          {
            ok: true,
            mensagem_id: existente.id,
            agendamento_id: existente.agendamento_id ?? null,
            agendamento_encontrado: !!existente.agendamento_id,
            duplicada: true,
          },
          200,
          headers,
        );
      }
    }
    return json({ error: insErr.message }, 500, headers);
  }

  // 3) Vinculação determinística via RPC (usa telefone_canonico + lock).
  const { data: vinc, error: vErr } = await supabase.rpc(
    "vincular_mensagem_por_telefone",
    { p_mensagem_id: inserted.id, p_nome_contato: nomeContato || null },
  );

  if (vErr) {
    // Não falha o request — mensagem já foi persistida; deixamos como órfã.
    await supabase.from("system_logs").insert({
      level: "warn",
      category: "edge_function",
      source: "registrar-mensagem-in-n8n",
      message: `Falha ao vincular mensagem: ${vErr.message}`,
      details: { mensagem_id: inserted.id, request_id: rid },
      request_id: rid,
    });
  }

  const info = (vinc ?? {}) as Record<string, any>;
  const agendamentoId = info.agendamento_id ?? null;

  // 4) Backfill de nome quando o cadastro está com placeholder e temos nome real.
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
