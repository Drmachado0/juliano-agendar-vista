import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { registrarMensagemWhatsapp } from "../_shared/registrarMensagem.ts";

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
  console.log("[enviar-whatsapp] === NOVA REQUISIÇÃO (Z-API) ===");

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

    // Z-API config
    const baseUrlRaw = Deno.env.get("ZAPI_BASE_URL") ?? "https://api.z-api.io";
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");
    const instance = Deno.env.get("ZAPI_INSTANCE");
    const token = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instance || !token || !clientToken) {
      console.error("[enviar-whatsapp] Z-API não configurada (faltam secrets)");
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "CONFIG_ERROR", erro: "Z-API não configurada" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isImage = !!imagem_url;
    const endpoint = isImage ? "send-image" : "send-text";
    const url = `${baseUrl}/instances/${instance}/token/${token}/${endpoint}`;
    const payload: Record<string, unknown> = isImage
      ? { phone: phoneFormatted, image: imagem_url, caption: caption ?? mensagem ?? "" }
      : { phone: phoneFormatted, message: mensagem };

    console.log("[enviar-whatsapp] Enviando via Z-API:", { endpoint, phone: phoneFormatted });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const elapsed = Date.now() - startTime;
    let data: any;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    console.log("[enviar-whatsapp] Resposta Z-API:", { status: response.status, elapsed: `${elapsed}ms`, preview: responseText.substring(0, 300) });

    if (!response.ok) {
      console.error("[enviar-whatsapp] ✗ Erro Z-API:", responseText);
      try {
        await registrarMensagemWhatsapp(supabase, {
          telefone,
          direcao: "OUT",
          conteudo: isImage ? `[imagem] ${caption ?? ""}` : mensagem,
          tipo_mensagem: (tipo_mensagem as any) ?? "manual",
          agendamento_id: agendamento_id ?? null,
          status_envio: "erro",
          error_message: `[ZAPI_${response.status}] ${responseText.slice(0, 300)}`,
        });
      } catch (e: any) {
        console.warn("[enviar-whatsapp] Falha ao registrar mensagem (erro) no CRM:", e?.message);
      }
      return new Response(
        JSON.stringify({ ok: false, success: false, error: "ZAPI_ERROR", erro: data, elapsed: `${elapsed}ms` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const messageId = data?.messageId ?? data?.id ?? null;
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
