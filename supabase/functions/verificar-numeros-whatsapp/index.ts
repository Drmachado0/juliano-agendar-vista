import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NumberCheckResult {
  telefone: string;
  telefoneFormatado: string;
  existeWhatsApp: boolean;
  jid?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefones } = await req.json();

    if (!telefones || !Array.isArray(telefones) || telefones.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lista de telefones é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 50 numbers per request to avoid timeouts
    if (telefones.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 50 números por verificação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const EVOLUTION_API_BASE_URL = Deno.env.get('EVOLUTION_API_BASE_URL');
    const EVOLUTION_API_INSTANCE = Deno.env.get('EVOLUTION_API_INSTANCE');
    const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN');

    if (!EVOLUTION_API_BASE_URL || !EVOLUTION_API_INSTANCE || !EVOLUTION_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração da Evolution API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format all phone numbers
    const numerosFormatados = telefones.map((tel: string) => {
      let formatted = tel.replace(/\D/g, '');
      if (!formatted.startsWith('55')) {
        formatted = '55' + formatted;
      }
      return { original: tel, formatted };
    });

    console.log('Verificando números:', numerosFormatados.map(n => n.formatted));

    // Use Evolution API's onWhatsApp endpoint to check numbers
    const evolutionUrl = `${EVOLUTION_API_BASE_URL}/chat/whatsappNumbers/${EVOLUTION_API_INSTANCE}`;
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN,
      },
      body: JSON.stringify({
        numbers: numerosFormatados.map(n => n.formatted),
      }),
    });

    const text = await response.text();
    console.log('Resposta Evolution:', response.status, text.substring(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error('Erro ao verificar números:', response.status, text);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar números na Evolution API' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process results
    const results: NumberCheckResult[] = numerosFormatados.map(({ original, formatted }) => {
      // Find this number in the API response
      let exists = false;
      let jid: string | undefined;

      if (Array.isArray(data)) {
        const found = data.find((item: { jid?: string; exists?: boolean; number?: string }) => {
          const itemNumber = item.number || item.jid?.replace('@s.whatsapp.net', '');
          return itemNumber === formatted || itemNumber === formatted.replace(/^55/, '');
        });
        if (found) {
          exists = found.exists === true;
          jid = found.jid;
        }
      }

      return {
        telefone: original,
        telefoneFormatado: formatted,
        existeWhatsApp: exists,
        jid,
      };
    });

    const validos = results.filter(r => r.existeWhatsApp);
    const invalidos = results.filter(r => !r.existeWhatsApp);

    console.log(`Verificação concluída: ${validos.length} válidos, ${invalidos.length} inválidos`);

    return new Response(
      JSON.stringify({
        success: true,
        resultados: results,
        resumo: {
          total: results.length,
          validos: validos.length,
          invalidos: invalidos.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro ao verificar números:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
