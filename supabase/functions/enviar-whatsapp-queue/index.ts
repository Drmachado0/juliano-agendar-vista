import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getEvolutionConfigAsync } from "../_shared/evolutionApiClient.ts";

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

    // 2. Get Evolution API config (tabela com fallback p/ env vars)
    let evolutionBaseUrl: string;
    let evolutionToken: string;
    let instanceName: string;
    try {
      const cfg = await getEvolutionConfigAsync();
      evolutionBaseUrl = cfg.baseUrl;
      evolutionToken = cfg.token;
      instanceName = cfg.instance;
    } catch (_e) {
      console.error("[enviar-whatsapp-queue] Configuração Evolution ausente");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "CONFIG_ERROR",
          message: "Evolution API não configurada" 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[enviar-whatsapp-queue] Config:", { baseUrl: evolutionBaseUrl, instance: instanceName });

    // 3. Send directly to Evolution API - NO connection check, NO retries
    console.log("[enviar-whatsapp-queue] Enviando para Evolution API...");
    
    const evolutionUrl = `${evolutionBaseUrl}/message/sendText/${instanceName}`;
    const evolutionResponse = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionToken,
      },
      body: JSON.stringify({
        number: phoneFormatted,
        text: mensagem,
      }),
    });

    const elapsed = Date.now() - startTime;
    const responseText = await evolutionResponse.text();
    
    console.log("[enviar-whatsapp-queue] Resposta Evolution:", {
      status: evolutionResponse.status,
      elapsed: `${elapsed}ms`,
      response: responseText.substring(0, 200)
    });

    // 4. Return result based on Evolution response
    if (evolutionResponse.ok || evolutionResponse.status === 202) {
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      const externalId = responseData?.key?.id || responseData?.id || null;
      console.log("[enviar-whatsapp-queue] ✓ Mensagem enviada com sucesso");

      // Persist success log (fire-and-forget)
      logEnvio({
        telefone: phoneFormatted,
        conteudo: mensagem,
        status: "enviado",
        campaign,
        externalId,
        payload: { campaign, priority, elapsed_ms: elapsed },
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
