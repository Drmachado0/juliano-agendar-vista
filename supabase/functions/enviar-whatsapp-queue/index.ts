import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendWhatsappTextMessage } from "../_shared/evolutionApiClient.ts";


const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function logEnvio(opts: {
  telefone: string;
  conteudo: string;
  status: "enviado" | "erro";
  campaign?: string;
  errorMessage?: string;
  externalId?: string | null;
  payload?: any;
}) {
  try {
    await supabaseAdmin.rpc("registrar_mensagem_whatsapp", {
      p_telefone: opts.telefone,
      p_direcao: "OUT",
      p_conteudo: opts.conteudo,
      p_tipo_mensagem: opts.campaign === "boas-vindas" ? "boas_vindas"
        : opts.campaign === "lembrete-anual" ? "lembrete_anual"
        : opts.campaign === "avaliacao" ? "avaliacao"
        : opts.campaign === "lembrete-24h" ? "lembrete_24h"
        : "manual",
      p_status_envio: opts.status,
      p_mensagem_externa_id: opts.externalId ?? null,
      p_error_message: opts.errorMessage ?? null,
      p_payload: opts.payload ?? null,
    });
  } catch (e) {
    console.error("[enviar-whatsapp-queue] Falha ao gravar log:", e);
  }
}

// CORS configuration
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schema validation - minimal
const requestSchema = z.object({
  telefone: z.string().min(10).max(15),
  mensagem: z.string().min(1).max(4096),
  campaign: z.string().optional(),
  priority: z.enum(["high", "normal", "low"]).optional(),
});

function normalizePhone(telefone: string): string {
  let phone = telefone.replace(/\D/g, "");
  if (!phone.startsWith("55")) {
    phone = "55" + phone;
  }
  return phone;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[enviar-whatsapp-queue] === NOVA REQUISIÇÃO (Fire & Forget) ===");

  try {
    // 1. Parse and validate request
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      console.error("[enviar-whatsapp-queue] Validação falhou:", validation.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "VALIDATION_ERROR",
          message: "Dados inválidos" 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { telefone, mensagem, campaign, priority } = validation.data;
    const phoneFormatted = normalizePhone(telefone);

    console.log("[enviar-whatsapp-queue] Dados:", { 
      telefone: phoneFormatted, 
      mensagemPreview: mensagem.substring(0, 50) + "...",
      campaign: campaign || "default",
      priority: priority || "normal"
    });
    // 2. Send via Z-API (helper compartilhado)
    console.log("[enviar-whatsapp-queue] Enviando via Z-API...");

    const sendResult = await sendWhatsappTextMessage(phoneFormatted, mensagem);
    const elapsed = Date.now() - startTime;

    console.log("[enviar-whatsapp-queue] Resposta Z-API:", {
      success: sendResult.success,
      elapsed: `${elapsed}ms`,
      messageId: sendResult.messageId,
    });

    if (sendResult.success) {
      const externalId = sendResult.messageId ?? null;
      console.log("[enviar-whatsapp-queue] ✓ Mensagem enviada com sucesso");

      // Persist success log (fire-and-forget)
      logEnvio({
        telefone: phoneFormatted,
        conteudo: mensagem,
        status: "enviado",
        campaign,
        externalId,
        payload: { campaign, priority, elapsed_ms: elapsed, response: sendResult.sanitizedResponse ?? null },
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: "sent",
          messageId: externalId,
          elapsed: `${elapsed}ms`
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Z-API returned error - log and return error (no retry)
    const errMsg = sendResult.errorMessage ?? "Erro desconhecido";
    console.error("[enviar-whatsapp-queue] ✗ Falha no envio:", errMsg);

    const lowerResponse = errMsg.toLowerCase();
    let userMessage = "Erro ao enviar mensagem";
    if (lowerResponse.includes("exists") && lowerResponse.includes("false")) {
      userMessage = "Número não encontrado no WhatsApp";
    } else if (lowerResponse.includes("not connected") || lowerResponse.includes("disconnected")) {
      userMessage = "WhatsApp desconectado. Verifique a instância Z-API.";
    } else if (lowerResponse.includes("401") || lowerResponse.includes("unauthorized")) {
      userMessage = "Erro de autenticação com Z-API";
    }

    // Persist failure log (fire-and-forget)
    logEnvio({
      telefone: phoneFormatted,
      conteudo: mensagem,
      status: "erro",
      campaign,
      errorMessage: `${userMessage} · ${errMsg.slice(0, 300)}`,
      payload: { campaign, priority, elapsed_ms: elapsed, raw: errMsg.slice(0, 500) },
    });

    return new Response(
      JSON.stringify({
        success: false,
        status: "failed",
        error: "SEND_FAILED",
        message: userMessage,
        elapsed: `${elapsed}ms`
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

    }

    // Evolution API returned error - log and return error (no retry)
    console.error("[enviar-whatsapp-queue] ✗ Falha no envio:", responseText);
    
    // Parse error to give user-friendly message
    let userMessage = "Erro ao enviar mensagem";
    const lowerResponse = responseText.toLowerCase();
    
    if (lowerResponse.includes('"exists":false') || lowerResponse.includes('"exists": false')) {
      userMessage = "Número não encontrado no WhatsApp";
    } else if (lowerResponse.includes("not connected") || lowerResponse.includes("disconnected") || lowerResponse.includes("connection closed")) {
      userMessage = "WhatsApp desconectado. Escaneie o QR Code em /admin/configuracoes/evolution.";
    } else if (evolutionResponse.status === 401) {
      userMessage = "Erro de autenticação com Evolution API";
    } else if (evolutionResponse.status === 404) {
      userMessage = "Instância do WhatsApp não encontrada";
    }

    // Persist failure log (fire-and-forget)
    logEnvio({
      telefone: phoneFormatted,
      conteudo: mensagem,
      status: "erro",
      campaign,
      errorMessage: `[${evolutionResponse.status}] ${userMessage} · ${responseText.substring(0, 300)}`,
      payload: { campaign, priority, http_status: evolutionResponse.status, elapsed_ms: elapsed, raw: responseText.substring(0, 500) },
    });

    return new Response(
      JSON.stringify({ 
        success: false, 
        status: "failed",
        error: "SEND_FAILED",
        message: userMessage,
        elapsed: `${elapsed}ms`
      }),
      { status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("[enviar-whatsapp-queue] Erro fatal:", error.message);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "INTERNAL_ERROR",
        message: "Erro interno. Tente novamente.",
        elapsed: `${elapsed}ms`
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
