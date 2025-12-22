import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check Evolution API connection status before sending
async function checkEvolutionConnection(
  baseUrl: string,
  instanceName: string,
  token: string
): Promise<{ connected: boolean; state: string; error?: string }> {
  try {
    const url = `${baseUrl}/instance/connectionState/${instanceName}`;
    console.log('Verificando conexão Evolution:', url);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': token,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Erro ao verificar conexão:', response.status, text);
      return { connected: false, state: 'error', error: text };
    }
    
    const data = await response.json();
    console.log('Status da conexão:', data);
    
    // Check connection state
    const state = data?.instance?.state || data?.state || 'unknown';
    const connected = state === 'open' || state === 'connected';
    
    return { connected, state };
  } catch (error) {
    console.error('Erro ao verificar conexão Evolution:', error);
    return { 
      connected: false, 
      state: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

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
    let evolutionBaseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
    const EVOLUTION_API_INSTANCE = Deno.env.get('EVOLUTION_API_INSTANCE');
    const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN');

    if (!evolutionBaseUrl || !EVOLUTION_API_INSTANCE || !EVOLUTION_API_TOKEN) {
      console.error('Variáveis de ambiente da Evolution API não configuradas');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração da Evolution API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove trailing slash from base URL to prevent double slashes
    evolutionBaseUrl = evolutionBaseUrl.replace(/\/+$/, "");

    // Check connection before sending
    console.log('=== VERIFICANDO CONEXÃO EVOLUTION ANTES DE ENVIAR ===');
    const connectionStatus = await checkEvolutionConnection(
      evolutionBaseUrl,
      EVOLUTION_API_INSTANCE,
      EVOLUTION_API_TOKEN
    );

    if (!connectionStatus.connected) {
      console.error('WhatsApp desconectado:', connectionStatus.state);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp desconectado. Reconecte o WhatsApp nas configurações antes de enviar mensagens.',
          isConnectionError: true,
          connectionState: connectionStatus.state
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Conexão OK, prosseguindo com envio...');

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

    const evolutionUrl = `${evolutionBaseUrl}/message/sendMedia/${EVOLUTION_API_INSTANCE}`;

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
      
      // Check for specific error types
      let userFriendlyError = `Erro Evolution API: ${result.status}`;
      let isConnectionError = false;
      
      const errorText = result.text.toLowerCase();
      const responseMessage = result.data?.response?.message;
      
      // Check for connection closed error
      if (errorText.includes('connection closed') || 
          (Array.isArray(responseMessage) && responseMessage.some((m: string) => 
            typeof m === 'string' && m.toLowerCase().includes('connection closed')))) {
        userFriendlyError = 'WhatsApp desconectado. Reconecte o WhatsApp nas configurações da Evolution API antes de enviar mensagens.';
        isConnectionError = true;
      }
      // Check if it's a "number doesn't exist on WhatsApp" error
      else if (responseMessage) {
        const messages = responseMessage;
        if (Array.isArray(messages) && messages.some((m: { exists?: boolean }) => m.exists === false)) {
          userFriendlyError = 'Número não encontrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.';
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userFriendlyError, 
          details: result.text,
          isConnectionError 
        }),
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
