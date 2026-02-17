import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data_atendimento } = await req.json();
    if (!data_atendimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_atendimento)) {
      return new Response(JSON.stringify({ error: 'data_atendimento inválida (formato: YYYY-MM-DD)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const n8nUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nUrl) {
      console.error('[buscar-pacientes-n8n] N8N_WEBHOOK_URL não configurado');
      return new Response(JSON.stringify({ error: 'Webhook não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Usar URL específico para avaliações (diferente do notificar-n8n)
    const avaliacaoUrl = n8nUrl.replace(/\/webhook\/[^/]+$/, '/webhook/avaliacao-google-lovable');

    console.log(`[buscar-pacientes-n8n] Buscando pacientes para ${data_atendimento}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const n8nResponse = await fetch(avaliacaoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_atendimento }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error(`[buscar-pacientes-n8n] n8n retornou ${n8nResponse.status}: ${errorText}`);
        return new Response(JSON.stringify({ error: `n8n retornou erro: ${n8nResponse.status}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await n8nResponse.json();
      console.log(`[buscar-pacientes-n8n] Sucesso - ${JSON.stringify(data).substring(0, 200)}`);

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        console.error('[buscar-pacientes-n8n] Timeout ao chamar n8n');
        return new Response(JSON.stringify({ error: 'Timeout: n8n não respondeu em 30s' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[buscar-pacientes-n8n] Erro:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
