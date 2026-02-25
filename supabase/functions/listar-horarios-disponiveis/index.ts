import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Local helpers (not imported from shared to avoid missing export errors)
function getClinicaSlugsFromLocal(local: string): string[] {
  const l = local.toLowerCase().trim();
  if (l.includes("clinicor")) return ["clinicor"];
  if (l.includes("hgp") || l.includes("hospital geral")) return ["hgp"];
  if (l.includes("iob")) return ["iob"];
  if (l.includes("vitria")) return ["vitria"];
  if (l.includes("belém") || l.includes("belem")) return ["iob", "vitria"];
  return [];
}

function gerarSlots(horaInicio: string, horaFim: string, intervaloMin: number): string[] {
  const slots: string[] = [];
  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFim.split(":").map(Number);
  let min = hI * 60 + mI;
  const fim = hF * 60 + mF;
  while (min + intervaloMin <= fim) {
    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    min += intervaloMin;
  }
  return slots;
}

function horarioDentroBloqueio(slot: string, inicio: string | null, fim: string | null): boolean {
  if (!inicio || !fim) return false;
  const s = slot.substring(0, 5);
  const i = inicio.substring(0, 5);
  const f = fim.substring(0, 5);
  return s >= i && s < f;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { data, local_atendimento } = body;

    // Validate date
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return new Response(
        JSON.stringify({ error: 'Campo "data" obrigatório no formato YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const localAtendimento = local_atendimento || '';

    console.log(`[listar-horarios] Data: ${data}, Local: ${localAtendimento || 'todos'}`);

    // 1. Check if date is in the past
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataCheck = new Date(data + 'T00:00:00');

    if (dataCheck < hoje) {
      return new Response(
        JSON.stringify({
          data,
          local_atendimento: localAtendimento || null,
          horarios_disponiveis: [],
          total: 0,
          motivo: 'Data no passado'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get clinic IDs
    const slugs = localAtendimento ? getClinicaSlugsFromLocal(localAtendimento) : [];
    let clinicaIds: string[] = [];

    if (slugs.length > 0) {
      const { data: clinicas } = await supabase
        .from('clinicas')
        .select('id')
        .in('slug', slugs)
        .eq('ativo', true);
      clinicaIds = clinicas?.map((c: { id: string }) => c.id) || [];
    }

    // 3. Check full-day blocks
    const { data: bloqueiosDiaInteiro } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .eq('data', data)
      .in('tipo_bloqueio', ['dia_inteiro', 'feriado']);

    const bloqueiosDiaFiltrados = bloqueiosDiaInteiro?.filter((b: any) =>
      clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)
    ) || [];

    if (bloqueiosDiaFiltrados.length > 0) {
      const motivo = bloqueiosDiaFiltrados[0].motivo || 'Esta data está bloqueada';
      return new Response(
        JSON.stringify({
          data,
          local_atendimento: localAtendimento || null,
          horarios_disponiveis: [],
          total: 0,
          motivo
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get interval blocks
    const { data: bloqueiosIntervalo } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .eq('data', data)
      .in('tipo_bloqueio', ['intervalo', 'ausencia_profissional']);

    const bloqueiosIntervaloFiltrados = bloqueiosIntervalo?.filter((b: any) =>
      clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)
    ) || [];

    // 5. Generate slots from availability rules
    let allSlots: string[] = [];
    let motivo: string | undefined;

    // Check specific availability first
    const { data: disponibilidadeEspecifica } = await supabase
      .from('disponibilidade_especifica')
      .select('*')
      .eq('data', data);

    const dispEspecificaFiltrada = disponibilidadeEspecifica?.filter((d: any) =>
      d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)
    ) || [];

    if (dispEspecificaFiltrada.length > 0) {
      // Check if date is marked unavailable
      const indisponivel = dispEspecificaFiltrada.find((d: any) => !d.disponivel);
      if (indisponivel && !dispEspecificaFiltrada.some((d: any) => d.disponivel)) {
        return new Response(
          JSON.stringify({
            data,
            local_atendimento: localAtendimento || null,
            horarios_disponiveis: [],
            total: 0,
            motivo: indisponivel.motivo || 'Data indisponível'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      for (const disp of dispEspecificaFiltrada) {
        if (!disp.disponivel || !disp.hora_inicio || !disp.hora_fim) continue;
        const slots = gerarSlots(disp.hora_inicio, disp.hora_fim, disp.intervalo_minutos || 30);
        allSlots.push(...slots);
      }
    } else {
      // Use weekly availability
      const diaSemana = new Date(data + 'T12:00:00').getDay();

      const { data: disponibilidadeSemanal } = await supabase
        .from('disponibilidade_semanal')
        .select('*')
        .eq('dia_semana', diaSemana)
        .eq('ativo', true);

      const dispSemanalFiltrada = disponibilidadeSemanal?.filter((d: any) =>
        d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)
      ) || [];

      if (dispSemanalFiltrada.length === 0) {
        return new Response(
          JSON.stringify({
            data,
            local_atendimento: localAtendimento || null,
            horarios_disponiveis: [],
            total: 0,
            motivo: 'Não há expediente neste dia da semana'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      for (const disp of dispSemanalFiltrada) {
        const slots = gerarSlots(disp.hora_inicio, disp.hora_fim, disp.intervalo_minutos);
        allSlots.push(...slots);
      }
    }

    // Deduplicate and sort
    allSlots = [...new Set(allSlots)].sort();

    // 6. Remove interval-blocked slots
    allSlots = allSlots.filter(slot => {
      for (const bloqueio of bloqueiosIntervaloFiltrados) {
        if (horarioDentroBloqueio(slot, bloqueio.hora_inicio, bloqueio.hora_fim)) {
          return false;
        }
      }
      return true;
    });

    // 7. Remove occupied slots
    const { data: agendamentosExistentes } = await supabase
      .from('agendamentos')
      .select('hora_agendamento')
      .eq('data_agendamento', data)
      .neq('status_funil', 'cancelado');

    const horariosOcupados = new Set(
      agendamentosExistentes?.map((a: any) => a.hora_agendamento?.substring(0, 5)) || []
    );

    allSlots = allSlots.filter(slot => !horariosOcupados.has(slot));

    // 8. Remove past slots (for today, with 30min margin)
    const agora = new Date();
    const isToday = data === agora.toISOString().split('T')[0];

    if (isToday) {
      const minutosAgora = agora.getHours() * 60 + agora.getMinutes() + 30;
      allSlots = allSlots.filter(slot => {
        const [h, m] = slot.split(':').map(Number);
        return h * 60 + m > minutosAgora;
      });
    }

    console.log(`[listar-horarios] ${allSlots.length} horários disponíveis`);

    return new Response(
      JSON.stringify({
        data,
        local_atendimento: localAtendimento || null,
        horarios_disponiveis: allSlots,
        total: allSlots.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error(`[listar-horarios] Erro:`, err);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao listar horários' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
