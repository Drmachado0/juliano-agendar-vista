import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarMensagemWhatsapp } from "../_shared/registrarMensagem.ts";
import { enviarTextoWhatsapp, enviarImagemWhatsapp } from "../_shared/whatsappSender.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { getN8nSharedSecret, timingSafeEqual } from "../_shared/n8nSecret.ts";


// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schema validation — contrato de entrada mantido + suporte opcional a imagem
const whatsAppRequestSchema = z.object({
  telefone: z.string().min(10).max(20).regex(/^[\d\s\-\(\)\+]+$/),
  mensagem: z.string().min(1).max(4096).optional().default(""),
  agendamento_id: z.string().uuid().optional().nullable(),
  tipo_mensagem: z.string().optional(),
  imagem_url: z.string().url().optional(),
  caption: z.string().max(4096).optional(),
});

type WhatsAppRequest = z.infer<typeof whatsAppRequestSchema>;

function normalizePhone(telefone: string): string {
  let phoneFormatted = telefone.replace(/\D/g, "");
  if (!phoneFormatted.startsWith("55")) {
    phoneFormatted = "55" + phoneFormatted;
  }
  return phoneFormatted;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[enviar-whatsapp] === NOVA REQUISIÇÃO (WhatsApp via n8n) ===");

  try {
    const body = await req.json();
    const validationResult = whatsAppRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("[enviar-whatsapp] Erro de validação:", validationResult.error.errors);
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          error: "VALIDATION_ERROR",
          erro: validationResult.error.errors.map(e => e.message).join(", "),
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { telefone, mensagem, agendamento_id, tipo_mensagem, imagem_url, caption }: WhatsAppRequest = validationResult.data;
    const phoneFormatted = normalizePhone(telefone);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isImage = !!imagem_url;
    console.log("[enviar-whatsapp] Enviando via n8n:", { isImage, phone: phoneFormatted });

    const result = isImage
      ? await enviarImagemWhatsapp(phoneFormatted, imagem_url!, caption ?? mensagem ?? "")
      : await enviarTextoWhatsapp(phoneFormatted, mensagem);

    const elapsed = Date.now() - startTime;
    console.log("[enviar-whatsapp] Resposta:", { ok: result.ok, status: result.status, elapsed: `${elapsed}ms`, messageId: result.messageId });

    if (!result.ok) {
      console.error("[enviar-whatsapp] ✗ Erro no envio:", result.erro);
      try {
        await registrarMensagemWhatsapp(supabase, {
          telefone,
          direcao: "OUT",
          conteudo: isImage ? `[imagem] ${caption ?? ""}` : mensagem,
          tipo_mensagem: (tipo_mensagem as any) ?? "manual",
          agendamento_id: agendamento_id ?? null,
          status_envio: "erro",
          error_message: `[WhatsApp] ${result.erro ?? "Erro desconhecido"}`,
        });
      } catch (e: any) {
        console.warn("[enviar-whatsapp] Falha ao registrar mensagem (erro) no CRM:", e?.message);
      }
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "SEND_ERROR", erro: result.erro, elapsed: `${elapsed}ms` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const messageId = result.messageId ?? null;
    const data = result.raw ?? null;
    console.log("[enviar-whatsapp] ✓ Mensagem enviada. messageId:", messageId);

    // Registrar no CRM (não bloqueia em caso de falha)
    try {
      await registrarMensagemWhatsapp(supabase, {
        telefone,
        direcao: "OUT",
        conteudo: isImage ? `[imagem] ${caption ?? ""}` : mensagem,
        tipo_mensagem: (tipo_mensagem as any) ?? "manual",
        agendamento_id: agendamento_id ?? null,
        status_envio: "enviado",
        mensagem_externa_id: messageId,
        payload: data ?? null,
      });
    } catch (e: any) {
      console.warn("[enviar-whatsapp] Falha ao registrar mensagem no CRM (não bloqueia):", e?.message);
    }

    // Pausa automática do bot quando humano (admin) envia mensagem manual
    const tipoNormalizado = ((tipo_mensagem as string) ?? "manual").toLowerCase();
    const ehManual = !tipoNormalizado || tipoNormalizado === "manual";
    if (ehManual && agendamento_id) {
      try {
        const { data: cfg } = await supabase
          .from("bot_config")
          .select("pausa_automatica_ativa, pausa_automatica_minutos")
          .eq("id", true)
          .maybeSingle();

        const ativa = cfg?.pausa_automatica_ativa ?? true;
        const minutos = Math.max(1, Math.min(cfg?.pausa_automatica_minutos ?? 30, 1440));

        if (ativa) {
          const pausadoAte = new Date(Date.now() + minutos * 60_000).toISOString();
          await supabase
            .from("agendamentos")
            .update({
              bot_ativo: false,
              bot_pausado_ate: pausadoAte,
              bot_pausa_motivo: "humano_respondeu",
            })
            .eq("id", agendamento_id);

          await supabase.from("crm_audit_log").insert({
            agendamento_id,
            acao: "bot_pausado_auto",
            detalhes: { minutos, pausado_ate: pausadoAte, motivo: "humano_respondeu" },
          });
        }
      } catch (e: any) {
        console.warn("[enviar-whatsapp] falha ao pausar bot (não bloqueia envio):", e?.message);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, success: true, messageId, data, elapsed: `${elapsed}ms` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("[enviar-whatsapp] Erro fatal:", error?.message);
    return new Response(
      JSON.stringify({ ok: false, success: false, error: "INTERNAL_ERROR", erro: error?.message, elapsed: `${elapsed}ms` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
