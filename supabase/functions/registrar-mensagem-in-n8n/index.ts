import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getN8nSharedSecret, timingSafeEqual } from "../_shared/n8nSecret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = await getN8nSharedSecret();
  const provided = req.headers.get("x-n8n-secret") ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
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

  // 1) Normaliza telefone via RPC
  const { data: telNorm, error: normErr } = await supabase.rpc("normalizar_telefone", {
    p_telefone: body.telefone,
  });
  if (normErr) return json({ error: normErr.message }, 500);
  const telefoneNormalizado = (telNorm as string) ?? body.telefone.replace(/\D/g, "");

  // 2) Busca agendamento mais recente por telefone normalizado
  const last8 = telefoneNormalizado.slice(-8);
  let agendamentoId: string | null = null;
  if (last8.length >= 8) {
    const { data: candidatos, error: selErr } = await supabase
      .from("agendamentos")
      .select("id, telefone_whatsapp, created_at, is_sandbox, data_agendamento")
      .order("created_at", { ascending: false })
      .limit(200);
    if (selErr) return json({ error: selErr.message }, 500);

    const match = (candidatos ?? [])
      .filter((a: any) => (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8))
      .sort((a: any, b: any) => {
        const sb = Number(a.is_sandbox ?? false) - Number(b.is_sandbox ?? false);
        if (sb !== 0) return sb;
        const da = Number(!!b.data_agendamento) - Number(!!a.data_agendamento);
        if (da !== 0) return da;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];
    agendamentoId = match?.id ?? null;
  }

  // Deriva nome do contato a partir de nome_contato ou de campos comuns no payload
  // (Evolution/WhatsApp expõe pushName/notifyName/sender.pushName)
  const payloadAny = (body.payload ?? {}) as Record<string, any>;
  const nomeBruto =
    (body.nome_contato ?? "").trim() ||
    (payloadAny.pushName ?? "").toString().trim() ||
    (payloadAny.notifyName ?? "").toString().trim() ||
    (payloadAny.sender?.pushName ?? "").toString().trim() ||
    (payloadAny.contact?.name ?? "").toString().trim() ||
    "";
  const ehNomePlaceholderEntrada =
    !nomeBruto ||
    /^lead\s*whatsapp$/i.test(nomeBruto) ||
    /^paciente$/i.test(nomeBruto) ||
    /^\+?\d[\d\s\-()]+$/.test(nomeBruto); // só números/telefone
  const nomeContato = ehNomePlaceholderEntrada ? "" : nomeBruto;
  let leadCriadoAgora = false;

  if (!agendamentoId && last8.length >= 8) {
    const insertLead = {
      nome_completo: nomeContato.length > 0 ? nomeContato : "Lead WhatsApp",
      telefone_whatsapp: telefoneNormalizado,
      tipo_atendimento: "Consulta",
      local_atendimento: "A definir",
      convenio: "Particular",
      status_crm: "NOVO LEAD",
      status_funil: "novo",
      estado_atendimento: "novo",
      origem: "whatsapp",
    };
    const { data: novoLead, error: leadErr } = await supabase
      .from("agendamentos")
      .insert(insertLead)
      .select("id")
      .single();
    if (leadErr) {
      // Race condition: outra mensagem do mesmo telefone pode ter criado o lead no mesmo instante.
      // Re-busca antes de prosseguir; se ainda assim falhar, segue sem agendamento_id.
      const { data: retry } = await supabase
        .from("agendamentos")
        .select("id, telefone_whatsapp, created_at, is_sandbox, data_agendamento")
        .order("created_at", { ascending: false })
        .limit(50);
      const m = (retry ?? []).find((a: any) =>
        (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8),
      );
      agendamentoId = m?.id ?? null;
    } else {
      agendamentoId = novoLead.id;
      leadCriadoAgora = true;
    }
  }

  // 2.6) Backfill de nome: se o lead já existe como "Lead WhatsApp" (placeholder)
  // e desta vez o n8n mandou um nome real, atualiza o cadastro.
  if (
    agendamentoId &&
    !leadCriadoAgora &&
    nomeContato.length > 1 &&
    !/^lead\s*whatsapp$/i.test(nomeContato)
  ) {
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


  // 3) Idempotência: se mensagem_externa_id já existe, retorna duplicada
  if (body.mensagem_externa_id) {
    const { data: existente, error: existErr } = await supabase
      .from("mensagens_whatsapp")
      .select("id, agendamento_id")
      .eq("mensagem_externa_id", body.mensagem_externa_id)
      .maybeSingle();
    if (existErr) return json({ error: existErr.message }, 500);
    if (existente) {
      return json({
        ok: true,
        mensagem_id: existente.id,
        agendamento_id: existente.agendamento_id ?? null,
        agendamento_encontrado: !!existente.agendamento_id,
        duplicada: true,
      });
    }
  }

  // 4) Insere mensagem
  const insertRow = {
    agendamento_id: agendamentoId,
    telefone: telefoneNormalizado,
    direcao: "IN",
    conteudo: body.conteudo,
    mensagem_externa_id: body.mensagem_externa_id ?? null,
    tipo_mensagem: body.tipo_mensagem ?? "whatsapp",
    status_envio: "recebida",
    payload: body.payload ?? { origem: "n8n_in" },
  };

  const { data: inserted, error: insErr } = await supabase
    .from("mensagens_whatsapp")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    // Race condition: outro request inseriu o mesmo mensagem_externa_id entre o check e o insert
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
        return json({
          ok: true,
          mensagem_id: existente.id,
          agendamento_id: existente.agendamento_id ?? null,
          agendamento_encontrado: !!existente.agendamento_id,
          duplicada: true,
        });
      }
    }
    return json({ error: insErr.message }, 500);
  }

  return json({
    ok: true,
    mensagem_id: inserted.id,
    agendamento_id: agendamentoId,
    agendamento_encontrado: !!agendamentoId,
    lead_criado: leadCriadoAgora,
    duplicada: false,
  });
});
