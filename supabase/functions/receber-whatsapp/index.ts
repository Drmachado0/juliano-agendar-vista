import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-evolution-signature",
};

// Rate limiter configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 60; // Max 60 requests per minute per IP

// In-memory rate limit store (resets on cold start, which is acceptable)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  record.count++;
  const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetIn };
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Zod schema for Evolution API webhook payload validation
const evolutionMessageSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  instance: z.string().optional(),
  apikey: z.string().optional(),
  data: z.any().optional(),
  key: z.any().optional(),
  message: z.any().optional(),
}).passthrough();

// Function to verify HMAC signature
async function verifyHMACSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
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

    const cleanSignature = signature.replace(/^sha256=/, "").toLowerCase();
    return cleanSignature === expectedSignature.toLowerCase();
  } catch (error) {
    console.error("Erro ao verificar assinatura HMAC:", error);
    return false;
  }
}

// Function to verify API key from body (Evolution API method)
function verifyApiKey(bodyApiKey: string | undefined, expectedApiKey: string): boolean {
  if (!bodyApiKey || !expectedApiKey) {
    return false;
  }
  return bodyApiKey === expectedApiKey;
}

// Normaliza número de telefone para formato brasileiro
function normalizePhoneNumber(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) {
      return '55' + digits;
    }
    return digits;
  }
  
  return digits;
}

// Função para enviar mensagem via Evolution API
async function sendWhatsappTextMessage(phone: string, body: string): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    const baseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
    const instance = Deno.env.get('EVOLUTION_API_INSTANCE') || 'Agente ia';
    const token = Deno.env.get('EVOLUTION_API_TOKEN');

    if (!baseUrl || !token) {
      console.error('[Evolution API] Variáveis de ambiente não configuradas');
      return { success: false, errorMessage: 'Evolution API não configurada' };
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${instance}`;

    console.log(`[Evolution API] Enviando resposta automática para ${normalizedPhone}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Evolution API] Erro HTTP ${response.status}:`, errorText);
      return { success: false, errorMessage: `HTTP ${response.status}` };
    }

    console.log('[Evolution API] Resposta automática enviada com sucesso');
    return { success: true };
  } catch (error) {
    console.error('[Evolution API] Exceção:', error);
    return { success: false, errorMessage: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check - use IP or forwarded IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("x-real-ip") || 
                   "unknown";
  
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000)
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000))
        } 
      }
    );
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    console.log("=== WEBHOOK RECEBIDO ===");
    console.log("Evento:", body.event || body.type);
    console.log("Instância:", body.instance);
    console.log(`Rate limit remaining: ${rateLimit.remaining}`);

    // Get secrets for authentication - MANDATORY
    const webhookSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
    const evolutionApiToken = Deno.env.get("EVOLUTION_API_TOKEN");
    
    // SECURITY: Require at least one authentication secret to be configured
    if (!webhookSecret && !evolutionApiToken) {
      console.error("❌ CRITICAL: No authentication secrets configured for webhook");
      return new Response(
        JSON.stringify({ success: false, error: "Webhook authentication not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Try multiple authentication methods
    let isAuthenticated = false;
    
    // Method 1: HMAC signature in header
    const signature = 
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-evolution-signature") ||
      req.headers.get("x-hub-signature-256") ||
      req.headers.get("x-signature");
    
    if (webhookSecret && signature) {
      isAuthenticated = await verifyHMACSignature(rawBody, signature, webhookSecret);
      if (isAuthenticated) {
        console.log("✓ Autenticado via assinatura HMAC");
      }
    }
    
    // Method 2: API key in body (Evolution API default method)
    if (!isAuthenticated && body.apikey) {
      // Check against webhook secret first, then API token
      if (webhookSecret && verifyApiKey(body.apikey, webhookSecret)) {
        isAuthenticated = true;
        console.log("✓ Autenticado via apikey no body (webhook secret)");
      } else if (evolutionApiToken && verifyApiKey(body.apikey, evolutionApiToken)) {
        isAuthenticated = true;
        console.log("✓ Autenticado via apikey no body (API token)");
      }
    }
    
    // SECURITY: Reject unauthenticated requests
    if (!isAuthenticated) {
      console.error(`❌ Authentication failed for IP: ${clientIP} - invalid apikey or signature`);
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate payload structure with Zod
    const parseResult = evolutionMessageSchema.safeParse(body);
    if (!parseResult.success) {
      console.error("Payload inválido:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ success: false, error: "Formato de payload inválido" }),
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
    const isFromMe = messageData?.key?.fromMe;
    if (isFromMe) {
      console.log("Mensagem enviada por nós, ignorando");
      return new Response(
        JSON.stringify({ success: true, message: "Mensagem própria ignorada" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extract phone number - Evolution may use remoteJid or remoteJidAlt
    let telefone = messageData?.key?.remoteJidAlt || messageData?.key?.remoteJid || "";
    telefone = telefone.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");
    
    // If telefone still has @lid format, try to get from remoteJidAlt
    if (telefone.includes("@") || !/^\d+$/.test(telefone.replace(/\D/g, ""))) {
      const altPhone = messageData?.key?.remoteJidAlt || "";
      if (altPhone) {
        telefone = altPhone.replace("@s.whatsapp.net", "").replace("@g.us", "");
      }
    }
    
    // Extract message content
    const conteudo = message?.conversation || message?.extendedTextMessage?.text || "";

    console.log("Telefone extraído:", telefone);
    console.log("Conteúdo:", conteudo ? conteudo.substring(0, 100) : "(vazio)");

    if (!telefone || !conteudo) {
      console.log("Dados incompletos - telefone:", telefone, "conteudo:", !!conteudo);
      return new Response(
        JSON.stringify({ success: false, error: "Dados incompletos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate phone number format (should be digits only, 10-15 chars)
    const phoneDigits = telefone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      console.error("Formato de telefone inválido:", telefone);
      return new Response(
        JSON.stringify({ success: false, error: "Formato de telefone inválido" }),
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
    let telefoneBusca = phoneDigits;
    if (telefoneBusca.startsWith("55")) {
      telefoneBusca = telefoneBusca.substring(2);
    }
    
    // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    let telefoneFormatado = telefoneBusca;
    let telefoneFormatadoAlternativo = "";
    
    if (telefoneBusca.length === 11) {
      // Standard 11-digit format
      telefoneFormatado = `(${telefoneBusca.substring(0, 2)}) ${telefoneBusca.substring(2, 7)}-${telefoneBusca.substring(7)}`;
    } else if (telefoneBusca.length === 10) {
      // 10-digit format - might be missing the leading 9 for mobile
      telefoneFormatado = `(${telefoneBusca.substring(0, 2)}) ${telefoneBusca.substring(2, 6)}-${telefoneBusca.substring(6)}`;
      // Also try with added 9 for mobile (Brazilian mobile numbers start with 9)
      const areaCode = telefoneBusca.substring(0, 2);
      const restOfNumber = telefoneBusca.substring(2);
      telefoneFormatadoAlternativo = `(${areaCode}) 9${restOfNumber.substring(0, 4)}-${restOfNumber.substring(4)}`;
    }

    console.log("Telefone formatado para DB:", telefoneFormatado);
    if (telefoneFormatadoAlternativo) {
      console.log("Telefone alternativo (com 9):", telefoneFormatadoAlternativo);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get last 8 digits for flexible matching
    const last8Digits = telefoneBusca.slice(-8);
    // Also get last 4 digits for even more flexible matching (will match any phone with same ending)
    const last4Digits = telefoneBusca.slice(-4);
    console.log("Últimos 8 dígitos para busca:", last8Digits);
    console.log("Últimos 4 dígitos para busca:", last4Digits);

    // Find agendamento by phone number
    // Search using last 4 digits pattern to work around formatting issues
    // Format: search for phones ending with the same 4 digits
    const { data: agendamentos, error: agendamentoError } = await supabase
      .from("agendamentos")
      .select("id, telefone_whatsapp, confirmation_status, data_agendamento, nome_completo")
      .ilike("telefone_whatsapp", `%${last4Digits}`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (agendamentoError) {
      console.error("Erro ao buscar agendamento:", agendamentoError);
    }

    // Find the best match by comparing more digits
    let agendamento = null;
    if (agendamentos && agendamentos.length > 0) {
      for (const ag of agendamentos) {
        const agDigits = ag.telefone_whatsapp.replace(/\D/g, "");
        const agLast8 = agDigits.slice(-8);
        if (agLast8 === last8Digits) {
          agendamento = ag;
          break;
        }
      }
      // If no exact match on 8 digits, use first match on 4 digits
      if (!agendamento) {
        agendamento = agendamentos[0];
      }
    }

    // If found, use the phone from agendamento for consistency
    const telefoneParaSalvar = agendamento?.telefone_whatsapp || telefoneFormatadoAlternativo || telefoneFormatado;
    console.log("Agendamento encontrado:", agendamento?.id || "Nenhum");
    console.log("Telefone para salvar:", telefoneParaSalvar);

    // Extract external message ID
    const mensagemExternaId = messageData?.key?.id || null;

    // Insert message into database with full payload for logging
    const { data: novaMensagem, error: insertError } = await supabase
      .from("mensagens_whatsapp")
      .insert({
        agendamento_id: agendamento?.id || null,
        telefone: telefoneParaSalvar,
        direcao: "IN",
        conteudo: conteudo,
        status_envio: null, // null for incoming messages
        mensagem_externa_id: mensagemExternaId,
        lida: false,
        payload: body, // Salvar payload completo para auditoria
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

    console.log("✓ Mensagem salva com sucesso:", novaMensagem.id);

    // ============= PROCESSAMENTO DE RESPOSTA DE CONFIRMAÇÃO =============
    // Verificar se é uma resposta para confirmação de agendamento (1 ou 2)
    const conteudoLimpo = conteudo.trim().toLowerCase();
    const primeiroCaractere = conteudoLimpo.charAt(0);
    
    // Verificar se há agendamento aguardando confirmação
    if (agendamento && agendamento.confirmation_status === 'aguardando_confirmacao') {
      const today = new Date().toISOString().split('T')[0];
      
      // Só processar se o agendamento é futuro ou hoje
      if (agendamento.data_agendamento >= today) {
        let acao: 'confirmar' | 'cancelar' | null = null;
        
        // Verificar resposta do paciente
        if (primeiroCaractere === '1' || conteudoLimpo.startsWith('sim') || conteudoLimpo.startsWith('confirmar') || conteudoLimpo.startsWith('confirmo')) {
          acao = 'confirmar';
        } else if (primeiroCaractere === '2' || conteudoLimpo.startsWith('cancelar') || conteudoLimpo.startsWith('cancelo') || conteudoLimpo.startsWith('não')) {
          acao = 'cancelar';
        }
        
        if (acao) {
          console.log(`[Confirmação] Ação detectada: ${acao} para agendamento ${agendamento.id}`);
          
          // Atualizar status do agendamento
          const updateData: Record<string, unknown> = {
            confirmation_response_at: new Date().toISOString(),
          };
          
          let mensagemResposta = '';
          
          if (acao === 'confirmar') {
            updateData.confirmation_status = 'confirmado';
            mensagemResposta = `✅ Sua presença foi *confirmada*!

Obrigado por confirmar, ${agendamento.nome_completo}. Aguardamos você no horário marcado.

Se precisar reagendar, entre em contato conosco. 📞`;
          } else {
            updateData.confirmation_status = 'cancelado_pelo_paciente';
            mensagemResposta = `❌ Seu agendamento foi *cancelado*.

Caso queira remarcar, entre em contato conosco pelo WhatsApp ou ligue para a clínica.

Obrigado pela compreensão! 🙏`;
          }
          
          // Atualizar no banco
          const { error: updateError } = await supabase
            .from('agendamentos')
            .update(updateData)
            .eq('id', agendamento.id);
          
          if (updateError) {
            console.error('[Confirmação] Erro ao atualizar agendamento:', updateError);
          } else {
            console.log(`[Confirmação] Agendamento ${agendamento.id} atualizado para: ${updateData.confirmation_status}`);
            
            // Enviar resposta automática
            const sendResult = await sendWhatsappTextMessage(telefoneParaSalvar, mensagemResposta);
            
            // Salvar a resposta automática na tabela de mensagens
            await supabase.from('mensagens_whatsapp').insert({
              agendamento_id: agendamento.id,
              telefone: telefoneParaSalvar,
              direcao: 'OUT',
              conteudo: mensagemResposta,
              tipo_mensagem: 'resposta_automatica',
              status_envio: sendResult.success ? 'enviado' : 'erro',
              error_message: sendResult.errorMessage || null,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { id: novaMensagem.id } }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Erro no webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
