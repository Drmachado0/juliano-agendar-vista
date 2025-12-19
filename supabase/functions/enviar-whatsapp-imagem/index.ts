import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefone, imageBase64: rawImageBase64, imageUrl, caption } = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prefer imageUrl over base64 (more reliable and lighter)
    if (!imageUrl && !rawImageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageUrl ou imageBase64 é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Evolution API configuration
    const EVOLUTION_API_BASE_URL = Deno.env.get('EVOLUTION_API_BASE_URL');
    const EVOLUTION_API_INSTANCE = Deno.env.get('EVOLUTION_API_INSTANCE');
    const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN');

    if (!EVOLUTION_API_BASE_URL || !EVOLUTION_API_INSTANCE || !EVOLUTION_API_TOKEN) {
      console.error('Variáveis de ambiente da Evolution API não configuradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração da Evolution API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let telefoneFormatado = telefone.replace(/\D/g, '');
    if (!telefoneFormatado.startsWith('55')) {
      telefoneFormatado = '55' + telefoneFormatado;
    }

    console.log('=== DEBUG EVOLUTION API (IMAGEM) ===');
    console.log('EVOLUTION_API_BASE_URL:', EVOLUTION_API_BASE_URL);
    console.log('Token presente:', EVOLUTION_API_TOKEN ? 'Sim' : 'Não');
    console.log('Telefone formatado:', telefoneFormatado);
    console.log('Usando imageUrl:', !!imageUrl);
    console.log('Usando imageBase64:', !imageUrl && !!rawImageBase64);
    console.log('Tem caption:', !!caption);

    const evolutionUrl = `${EVOLUTION_API_BASE_URL}/message/sendMedia/${EVOLUTION_API_INSTANCE}`;
    console.log('URL completa da Evolution:', evolutionUrl);

    // Determine media source - prefer URL over base64
    let mediaSource: string;
    
    if (imageUrl) {
      // Use URL directly (preferred - lighter and more reliable)
      mediaSource = imageUrl;
      console.log('Enviando via URL:', imageUrl.substring(0, 100) + '...');
    } else {
      // Fallback to base64 if no URL provided
      let imageBase64 = rawImageBase64;
      if (rawImageBase64 && rawImageBase64.includes(';base64,')) {
        imageBase64 = rawImageBase64.split(';base64,')[1];
        console.log('Prefixo data URL removido do base64');
      }
      mediaSource = imageBase64;
      console.log('Tamanho base64:', imageBase64?.length);
    }

    // Build request body
    const requestBody: {
      number: string;
      mediatype: string;
      media: string;
      caption?: string;
    } = {
      number: telefoneFormatado,
      mediatype: 'image',
      media: mediaSource,
    };

    // Only add caption if provided
    if (caption) {
      requestBody.caption = caption;
      console.log('Caption preview:', caption.length > 100 ? caption.slice(0, 97) + '...' : caption);
    }

    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Resposta Evolution (Imagem):', responseText);

    if (!response.ok) {
      console.error('Erro da Evolution API:', response.status, responseText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro Evolution API: ${response.status}`, details: responseText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro ao enviar imagem WhatsApp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
