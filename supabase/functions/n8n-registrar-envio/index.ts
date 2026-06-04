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
  agendamento_id: z.string().uuid().nullable().optional(),
  telefone: z.string().min(8),
  tipo_mensagem: z.string().default("confirmacao_automatica"),
  canal: z.string().default("whatsapp_manychat"),
  status_envio: z.enum(["enviado", "falha_envio"]),
  subscriber_id: z.string().optional().nullable(),
  origem: z.string().optional().nullable(),
  conteudo: z.string().optional(),
  erro: z.string().optional().nullable(),
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
  if (!sharedSecret || provided !== sharedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: telNorm } = await supabase.rpc("normalizar_telefone", { p_telefone: body.telefone });
  const telefoneNormalizado = (telNorm as string) ?? body.telefone.replace(/\D/g, "");

  // Insere log da mensagem outbound
  const { error: msgErr } = await supabase.from("mensagens_whatsapp").insert({
    agendamento_id: body.agendamento_id ?? null,
    telefone: telefoneNormalizado,
    direcao: "OUT",
    conteudo: body.conteudo ?? "(enviado via ManyChat)",
    tipo_mensagem: body.tipo_mensagem,
    status_envio: body.status_envio,
    payload: {
      canal: body.canal,
      subscriber_id: body.subscriber_id ?? null,
      origem: body.origem ?? "n8n_manychat",
      erro: body.erro ?? null,
    },
  });
  if (msgErr) console.error("[n8n-registrar-envio] msg insert:", msgErr.message);

  // Atualiza agendamento, se houver
  if (body.agendamento_id) {
    const update: Record<string, unknown> = {};
    if (body.status_envio === "enviado") {
      update.confirmacao_enviada = true;
      update.confirmation_status = "aguardando_confirmacao";
      update.confirmation_sent_at = new Date().toISOString();
      update.confirmation_channel = "whatsapp";
    } else {
      update.confirmation_status = "falha_envio";
      update.confirmation_sent_at = new Date().toISOString();
    }
    const { error: updErr } = await supabase
      .from("agendamentos")
      .update(update)
      .eq("id", body.agendamento_id);
    if (updErr) console.error("[n8n-registrar-envio] update agend:", updErr.message);
  }

  return json({ ok: true });
});
