import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log("=== WEBHOOK RECEBIDO ===");
    console.log("Body completo:", JSON.stringify(body, null, 2));

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
    console.log("Conteúdo:", conteudo);

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
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Mensagem salva com sucesso:", novaMensagem.id);

    return new Response(
      JSON.stringify({ success: true, data: novaMensagem }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
