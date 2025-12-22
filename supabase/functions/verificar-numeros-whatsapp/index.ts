import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NumberCheckResult {
  telefone: string;
  telefoneFormatado: string;
  existeWhatsApp: boolean;
  jid?: string;
  fromCache?: boolean;
}

interface CachedVerification {
  telefone: string;
  existe_whatsapp: boolean;
  jid: string | null;
  verificado_em: string;
}

// Check Evolution API connection status before verifying
async function checkEvolutionConnection(
  baseUrl: string,
  instanceName: string,
  token: string
): Promise<{ connected: boolean; state: string; error?: string }> {
  try {
    const url = `${baseUrl}/instance/connectionState/${instanceName}`;
    console.log('Verificando conexão Evolution antes de verificar números:', url);
    
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

// Check if error is a connection error
function isConnectionError(statusCode: number, responseText: string, data: unknown): boolean {
  if (responseText.includes('Connection Closed')) return true;
  if (responseText.includes('Precondition Required')) return true;
  if (statusCode === 428) return true;
  
  // Check nested error structures
  const output = (data as { output?: { payload?: { message?: string } } })?.output;
  if (output?.payload?.message === 'Connection Closed') return true;
  
  const response = (data as { response?: { message?: string[] } })?.response;
  if (response?.message?.includes('Error: Connection Closed')) return true;
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telefones, forceRefresh = false } = await req.json();

    if (!telefones || !Array.isArray(telefones) || telefones.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lista de telefones é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (telefones.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Máximo de 50 números por verificação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let evolutionBaseUrl = Deno.env.get('EVOLUTION_API_BASE_URL');
    const EVOLUTION_API_INSTANCE = Deno.env.get('EVOLUTION_API_INSTANCE');
    const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!evolutionBaseUrl || !EVOLUTION_API_INSTANCE || !EVOLUTION_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração da Evolution API incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove trailing slash from base URL to prevent double slashes
    evolutionBaseUrl = evolutionBaseUrl.replace(/\/+$/, "");

    // Check connection FIRST before doing anything else
    console.log('=== VERIFICANDO CONEXÃO EVOLUTION ANTES DE VERIFICAR NÚMEROS ===');
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
          error: 'WhatsApp desconectado. Reconecte o WhatsApp nas configurações antes de verificar números.',
          isConnectionError: true,
          connectionState: connectionStatus.state
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Conexão OK, prosseguindo com verificação...');

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Format all phone numbers
    const numerosFormatados = telefones.map((tel: string) => {
      let formatted = tel.replace(/\D/g, '');
      if (!formatted.startsWith('55')) {
        formatted = '55' + formatted;
      }
      return { original: tel, formatted };
    });

    const results: NumberCheckResult[] = [];
    const numerosParaVerificar: { original: string; formatted: string }[] = [];

    // Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const telefonesParaBuscar = numerosFormatados.map(n => n.formatted);
      
      const { data: cached, error: cacheError } = await supabase
        .from('verificacoes_whatsapp')
        .select('telefone, existe_whatsapp, jid, verificado_em')
        .in('telefone', telefonesParaBuscar);

      if (cacheError) {
        console.error('Erro ao buscar cache:', cacheError);
      }

      const cacheMap = new Map<string, CachedVerification>();
      if (cached) {
        for (const item of cached) {
          cacheMap.set(item.telefone, item);
        }
      }

      // Separate cached and non-cached numbers
      for (const num of numerosFormatados) {
        const cachedItem = cacheMap.get(num.formatted);
        if (cachedItem) {
          // Use cached result (cache valid for 30 days)
          const verificadoEm = new Date(cachedItem.verificado_em);
          const diasDesdeVerificacao = (Date.now() - verificadoEm.getTime()) / (1000 * 60 * 60 * 24);
          
          if (diasDesdeVerificacao < 30) {
            results.push({
              telefone: num.original,
              telefoneFormatado: num.formatted,
              existeWhatsApp: cachedItem.existe_whatsapp,
              jid: cachedItem.jid || undefined,
              fromCache: true,
            });
            continue;
          }
        }
        numerosParaVerificar.push(num);
      }

      console.log(`Cache: ${results.length} encontrados, ${numerosParaVerificar.length} para verificar`);
    } else {
      numerosParaVerificar.push(...numerosFormatados);
    }

    // Verify remaining numbers with Evolution API
    if (numerosParaVerificar.length > 0) {
      // Deduplicate numbers before sending to Evolution API
      const uniqueFormattedNumbers = [...new Set(numerosParaVerificar.map(n => n.formatted))];
      console.log(`Verificando ${uniqueFormattedNumbers.length} números únicos (de ${numerosParaVerificar.length} total):`, uniqueFormattedNumbers);

      const evolutionUrl = `${evolutionBaseUrl}/chat/whatsappNumbers/${EVOLUTION_API_INSTANCE}`;
      
      const response = await fetch(evolutionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_TOKEN,
        },
        body: JSON.stringify({
          numbers: uniqueFormattedNumbers,
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
        // Check if this is a connection error - DO NOT save to cache or mark as invalid
        if (isConnectionError(response.status, text, data)) {
          console.error('Erro de conexão detectado - NÃO salvando no cache');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'WhatsApp desconectado. Reconecte o WhatsApp nas configurações antes de verificar números.',
              isConnectionError: true,
              connectionState: 'disconnected'
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.error('Erro ao verificar números:', response.status, text);
        // For other errors, return partial results but DON'T mark as invalid
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro na API: ${response.status}`,
            resultadosParciais: results,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Process API results - Evolution API returns { message: [...] } format
        const apiResults = Array.isArray(data) ? data : (data?.message || []);
        console.log(`API retornou ${apiResults.length} resultados`);
        
        const newVerifications: { telefone: string; existe_whatsapp: boolean; jid: string | null }[] = [];

        for (const num of numerosParaVerificar) {
          let exists = false;
          let jid: string | undefined;

          if (Array.isArray(apiResults)) {
            const found = apiResults.find((item: { jid?: string; exists?: boolean; number?: string }) => {
              const itemNumber = item.number || item.jid?.replace('@s.whatsapp.net', '');
              return itemNumber === num.formatted || itemNumber === num.formatted.replace(/^55/, '');
            });
            if (found) {
              exists = found.exists === true;
              jid = found.jid;
            }
          }

          results.push({
            telefone: num.original,
            telefoneFormatado: num.formatted,
            existeWhatsApp: exists,
            jid,
            fromCache: false,
          });

          // Prepare for cache upsert
          newVerifications.push({
            telefone: num.formatted,
            existe_whatsapp: exists,
            jid: jid || null,
          });
        }

        // Save to cache
        if (newVerifications.length > 0) {
          const { error: upsertError } = await supabase
            .from('verificacoes_whatsapp')
            .upsert(
              newVerifications.map(v => ({
                ...v,
                verificado_em: new Date().toISOString(),
              })),
              { onConflict: 'telefone' }
            );

          if (upsertError) {
            console.error('Erro ao salvar cache:', upsertError);
          } else {
            console.log(`Cache atualizado: ${newVerifications.length} números`);
          }
        }
      }
    }

    const validos = results.filter(r => r.existeWhatsApp);
    const invalidos = results.filter(r => !r.existeWhatsApp);
    const fromCache = results.filter(r => r.fromCache).length;

    console.log(`Verificação concluída: ${validos.length} válidos, ${invalidos.length} inválidos (${fromCache} do cache)`);

    return new Response(
      JSON.stringify({
        success: true,
        resultados: results,
        resumo: {
          total: results.length,
          validos: validos.length,
          invalidos: invalidos.length,
          doCache: fromCache,
          verificadosAgora: results.length - fromCache,
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
