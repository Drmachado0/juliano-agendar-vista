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
    const { telefone, imageBase64, imageUrl, caption } = await req.json();

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageBase64 ou imageUrl é obrigatório' }),
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
    console.log('Tem imageBase64:', !!imageBase64);
    console.log('Tem imageUrl:', !!imageUrl);

    const evolutionUrl = `${EVOLUTION_API_BASE_URL}/message/sendMedia/${EVOLUTION_API_INSTANCE}`;
    console.log('URL completa da Evolution:', evolutionUrl);

    // Build request body
    const requestBody: {
      number: string;
      mediatype: string;
      media: string;
      caption?: string;
    } = {
      number: telefoneFormatado,
      mediatype: 'image',
      media: imageUrl || imageBase64,
    };

    // Only add caption if provided
    if (caption) {
      requestBody.caption = caption;
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
        JSON.stringify({ success: false, error: `Erro Evolution API: ${response.status}` }),
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
