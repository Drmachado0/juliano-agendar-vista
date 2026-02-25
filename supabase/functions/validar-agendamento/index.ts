import { validarDisponibilidade, ResultadoValidacao, criarClienteSupabase } from "../_shared/validarDisponibilidade.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { local_atendimento, data_agendamento, hora_agendamento } = body;

    console.log(`[validar-agendamento] Validando: ${data_agendamento} ${hora_agendamento} - ${local_atendimento}`);

    // Validate required fields
    if (!local_atendimento || !data_agendamento || !hora_agendamento) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: local_atendimento, data_agendamento, hora_agendamento',
          disponivel: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_agendamento)) {
      return new Response(
        JSON.stringify({ 
          error: 'Formato de data inválido. Use YYYY-MM-DD',
          disponivel: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate time format
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_agendamento)) {
      return new Response(
        JSON.stringify({ 
          error: 'Formato de hora inválido. Use HH:MM',
          disponivel: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform validation
    const supabase = criarClienteSupabase();
    const resultado: ResultadoValidacao = await validarDisponibilidade(
      supabase,
      data_agendamento,
      hora_agendamento,
      local_atendimento
    );

    console.log(`[validar-agendamento] Resultado:`, resultado);

    return new Response(
      JSON.stringify(resultado),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err) {
    console.error(`[validar-agendamento] Erro:`, err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao validar disponibilidade',
        disponivel: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
