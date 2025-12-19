import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendToEvolution(
  evolutionUrl: string,
  token: string,
  telefone: string,
  media: string,
  caption?: string
): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const requestBody: {
    number: string;
    mediatype: string;
    media: string;
    caption?: string;
  } = {
    number: telefone,
    mediatype: 'image',
    media: media,
  };

  if (caption) {
    requestBody.caption = caption;
  }

  const response = await fetch(evolutionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': token,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { ok: response.ok, status: response.status, data, text };
}

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
    console.log('Telefone formatado:', telefoneFormatado);
    console.log('Tem imageUrl:', !!imageUrl);
    console.log('Tem imageBase64:', !!rawImageBase64);
    console.log('Tem caption:', !!caption);

    const evolutionUrl = `${EVOLUTION_API_BASE_URL}/message/sendMedia/${EVOLUTION_API_INSTANCE}`;

    // Clean base64 if needed
    let imageBase64 = rawImageBase64;
    if (rawImageBase64 && rawImageBase64.includes(';base64,')) {
      imageBase64 = rawImageBase64.split(';base64,')[1];
    }

    // Strategy: Try URL first, fallback to base64 if URL fails
    let result: { ok: boolean; status: number; data: any; text: string };
    let usedMethod = '';

    if (imageUrl) {
      // Try URL first
      console.log('Tentando enviar via URL:', imageUrl.substring(0, 80) + '...');
      result = await sendToEvolution(evolutionUrl, EVOLUTION_API_TOKEN, telefoneFormatado, imageUrl, caption);
      usedMethod = 'URL';

      // Check if URL method failed with connection error - fallback to base64
      if (!result.ok && imageBase64) {
        const errorText = result.text.toLowerCase();
        if (errorText.includes('connection closed') || errorText.includes('timeout') || errorText.includes('fetch')) {
          console.log('URL falhou com erro de conexão, tentando base64 como fallback...');
          result = await sendToEvolution(evolutionUrl, EVOLUTION_API_TOKEN, telefoneFormatado, imageBase64, caption);
          usedMethod = 'base64 (fallback)';
        }
      }
    } else {
      // No URL, use base64 directly
      console.log('Enviando via base64 (sem URL disponível)');
      result = await sendToEvolution(evolutionUrl, EVOLUTION_API_TOKEN, telefoneFormatado, imageBase64!, caption);
      usedMethod = 'base64';
    }

    console.log('Método usado:', usedMethod);
    console.log('Resposta Evolution:', result.status, result.text.substring(0, 200));

    if (!result.ok) {
      console.error('Erro da Evolution API:', result.status, result.text);
      
      // Check if it's a "number doesn't exist on WhatsApp" error
      let userFriendlyError = `Erro Evolution API: ${result.status}`;
      if (result.data?.response?.message) {
        const messages = result.data.response.message;
        if (Array.isArray(messages) && messages.some((m: { exists?: boolean }) => m.exists === false)) {
          userFriendlyError = 'Número não encontrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.';
        }
      }
      
      return new Response(
        JSON.stringify({ success: false, error: userFriendlyError, details: result.text }),
        { status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Imagem enviada com sucesso via', usedMethod);

    return new Response(
      JSON.stringify({ success: true, data: result.data, method: usedMethod }),
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
