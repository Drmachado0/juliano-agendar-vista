import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-evolution-signature",
};

// Zod schema for Evolution API webhook payload validation
const evolutionMessageSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  data: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean().optional(),
      id: z.string().optional(),
    }).optional(),
    message: z.object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({
        text: z.string().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
  key: z.object({
    remoteJid: z.string(),
    fromMe: z.boolean().optional(),
    id: z.string().optional(),
  }).optional(),
  message: z.object({
    conversation: z.string().optional(),
    extendedTextMessage: z.object({
      text: z.string().optional(),
    }).optional(),
  }).optional(),
}).passthrough();

// Function to verify HMAC signature
async function verifyHMACSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.log("Nenhuma assinatura fornecida no request");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const data = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Support both raw signature and prefixed formats (sha256=...)
    const cleanSignature = signature.replace(/^sha256=/, "").toLowerCase();
    const isValid = cleanSignature === expectedSignature.toLowerCase();

    console.log("Validação de assinatura:", isValid ? "VÁLIDA" : "INVÁLIDA");
    return isValid;
  } catch (error) {
    console.error("Erro ao verificar assinatura HMAC:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    console.log("=== WEBHOOK RECEBIDO ===");
    console.log("Body completo:", JSON.stringify(body, null, 2));

    // Get webhook secret and validate signature
    const webhookSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
    
    if (webhookSecret) {
      // Check multiple possible signature headers (Evolution API may use different headers)
      const signature = 
        req.headers.get("x-webhook-signature") ||
        req.headers.get("x-evolution-signature") ||
        req.headers.get("x-hub-signature-256") ||
        req.headers.get("x-signature");

      const isValidSignature = await verifyHMACSignature(rawBody, signature, webhookSecret);
      
      if (!isValidSignature) {
        console.error("Assinatura do webhook inválida ou ausente");
        return new Response(
          JSON.stringify({ success: false, error: "Assinatura inválida" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      console.log("✓ Assinatura do webhook validada com sucesso");
    } else {
      console.warn("⚠️ EVOLUTION_WEBHOOK_SECRET não configurado - validação de assinatura desabilitada");
    }

    // Validate payload structure with Zod
    const parseResult = evolutionMessageSchema.safeParse(body);
    if (!parseResult.success) {
      console.error("Payload inválido:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ success: false, error: "Formato de payload inválido", details: parseResult.error.errors }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Evolution API sends different event types
    const event = body.event || body.type;
    
    // Only process incoming messages
    if (event !== "messages.upsert" && event !== "message") {
      console.log("Evento ignorado:", event);
      return new Response(
        JSON.stringify({ success: true, message: "Evento ignorado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract message data from Evolution API format
    const messageData = body.data || body;
    const message = messageData.message || messageData;
    
    // Check if it's an incoming message (not sent by us)
    const isFromMe = message?.key?.fromMe || messageData?.key?.fromMe;
    if (isFromMe) {
      console.log("Mensagem enviada por nós, ignorando");
      return new Response(
        JSON.stringify({ success: true, message: "Mensagem própria ignorada" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract phone number (remove @s.whatsapp.net suffix)
    let telefone = message?.key?.remoteJid || messageData?.key?.remoteJid || "";
    telefone = telefone.replace("@s.whatsapp.net", "").replace("@g.us", "");
    
    // Validate phone number format
    if (!/^\d{10,15}$/.test(telefone.replace(/\D/g, ""))) {
      console.error("Formato de telefone inválido:", telefone);
      return new Response(
        JSON.stringify({ success: false, error: "Formato de telefone inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Extract message content
    const conteudo = 
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      messageData?.message?.conversation ||
      messageData?.message?.extendedTextMessage?.text ||
      "";

    if (!telefone || !conteudo) {
      console.log("Dados incompletos - telefone:", telefone, "conteudo:", conteudo);
      return new Response(
        JSON.stringify({ success: false, error: "Dados incompletos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate message content length
    if (conteudo.length > 10000) {
      console.error("Mensagem muito longa:", conteudo.length);
      return new Response(
        JSON.stringify({ success: false, error: "Mensagem muito longa" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format phone for database lookup (Brazilian format)
    let telefoneBusca = telefone;
    if (telefoneBusca.startsWith("55")) {
      telefoneBusca = telefoneBusca.substring(2);
    }
    
    // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    let telefoneFormatado = telefoneBusca;
    if (telefoneBusca.length === 11) {
      telefoneFormatado = `(${telefoneBusca.substring(0, 2)}) ${telefoneBusca.substring(2, 7)}-${telefoneBusca.substring(7)}`;
    } else if (telefoneBusca.length === 10) {
      telefoneFormatado = `(${telefoneBusca.substring(0, 2)}) ${telefoneBusca.substring(2, 6)}-${telefoneBusca.substring(6)}`;
    }

    console.log("Telefone original:", telefone);
    console.log("Telefone formatado:", telefoneFormatado);
    console.log("Conteúdo:", conteudo.substring(0, 100) + (conteudo.length > 100 ? "..." : ""));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find agendamento by phone number (try multiple formats)
    const { data: agendamento, error: agendamentoError } = await supabase
      .from("agendamentos")
      .select("id")
      .or(`telefone_whatsapp.eq.${telefoneFormatado},telefone_whatsapp.eq.${telefoneBusca},telefone_whatsapp.ilike.%${telefoneBusca.substring(telefoneBusca.length - 8)}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (agendamentoError && agendamentoError.code !== "PGRST116") {
      console.error("Erro ao buscar agendamento:", agendamentoError);
    }

    console.log("Agendamento encontrado:", agendamento?.id || "Nenhum");

    // Extract external message ID
    const mensagemExternaId = message?.key?.id || messageData?.key?.id || null;

    // Insert message into database
    const { data: novaMensagem, error: insertError } = await supabase
      .from("mensagens_whatsapp")
      .insert({
        agendamento_id: agendamento?.id || null,
        telefone: telefoneFormatado,
        direcao: "IN",
        conteudo: conteudo,
        status_envio: "recebido",
        mensagem_externa_id: mensagemExternaId,
        lida: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir mensagem:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar mensagem" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Mensagem salva com sucesso:", novaMensagem.id);

    return new Response(
      JSON.stringify({ success: true, data: { id: novaMensagem.id } }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
