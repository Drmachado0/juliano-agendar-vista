import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_VALIDOS = [
  "NOVO LEAD",
  "CLINICOR",
  "HGP",
  "BELÉM",
  "PRECISA_DE_HUMANO",
  "ATENDIDO",
] as const;

const BodySchema = z
  .object({
    agendamento_id: z.string().uuid().optional(),
    telefone_whatsapp: z.string().min(8).optional(),
    status_crm: z.enum(STATUS_VALIDOS),
    motivo: z.string().max(500).optional(),
  })
  .refine((d) => d.agendamento_id || d.telefone_whatsapp, {
    message: "Informe agendamento_id ou telefone_whatsapp",
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

  let agendamentoId = body.agendamento_id ?? null;

  if (!agendamentoId && body.telefone_whatsapp) {
    const last8 = body.telefone_whatsapp.replace(/\D/g, "").slice(-8);
    if (last8.length < 8) return json({ error: "Telefone inválido" }, 400);

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

    if (!match) return json({ error: "Agendamento não encontrado" }, 404);
    agendamentoId = match.id;
  }

  // Lê status atual
  const { data: atual, error: getErr } = await supabase
    .from("agendamentos")
    .select("id, status_crm")
    .eq("id", agendamentoId!)
    .maybeSingle();
  if (getErr) return json({ error: getErr.message }, 500);
  if (!atual) return json({ error: "Agendamento não encontrado" }, 404);

  const statusAnterior = (atual as any).status_crm ?? null;
  const statusNovo = body.status_crm;

  if (statusAnterior === statusNovo) {
    return json({
      agendamento_id: agendamentoId,
      status_crm_anterior: statusAnterior,
      status_crm_novo: statusNovo,
      noop: true,
    });
  }

  const { error: updErr } = await supabase
    .from("agendamentos")
    .update({ status_crm: statusNovo, updated_at: new Date().toISOString() })
    .eq("id", agendamentoId!);
  if (updErr) return json({ error: updErr.message }, 500);

  await supabase.from("crm_audit_log").insert({
    agendamento_id: agendamentoId,
    user_id: null,
    user_email: "n8n@bot",
    user_name: "n8n (bot)",
    acao: "status_change",
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    detalhes: { motivo: body.motivo ?? null, origem: "n8n" },
  });

  return json({
    agendamento_id: agendamentoId,
    status_crm_anterior: statusAnterior,
    status_crm_novo: statusNovo,
  });
});
