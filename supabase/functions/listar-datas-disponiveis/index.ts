import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  return s >= inicio.substring(0, 5) && s < fim.substring(0, 5);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { mes, ano, local_atendimento } = body;

    if (!mes || !ano || mes < 1 || mes > 12) {
      return new Response(
        JSON.stringify({ error: 'Campos "mes" (1-12) e "ano" são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const localAtendimento = local_atendimento || "";

    console.log(`[listar-datas] Mês: ${mes}/${ano}, Local: ${localAtendimento || "todos"}`);

    // 1. Resolve clinic IDs
    const slugs = localAtendimento ? getClinicaSlugsFromLocal(localAtendimento) : [];
    let clinicaIds: string[] = [];

    if (slugs.length > 0) {
      const { data: clinicas } = await supabase
        .from("clinicas")
        .select("id")
        .in("slug", slugs)
        .eq("ativo", true);
      clinicaIds = clinicas?.map((c: { id: string }) => c.id) || [];
    }

    // 2. Calculate date range
    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInicio = primeiroDia < hoje ? hoje.toISOString().split("T")[0] : `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia.getDate()).padStart(2, "0")}`;

    // 3. Batch-fetch all data for the month
    const [
      { data: bloqueiosDia },
      { data: bloqueiosIntervalo },
      { data: dispEspecifica },
      { data: dispSemanal },
      { data: agendamentos },
    ] = await Promise.all([
      supabase
        .from("bloqueios_agenda")
        .select("*")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .in("tipo_bloqueio", ["dia_inteiro", "feriado"]),
      supabase
        .from("bloqueios_agenda")
        .select("*")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .in("tipo_bloqueio", ["intervalo", "ausencia_profissional"]),
      supabase
        .from("disponibilidade_especifica")
        .select("*")
        .gte("data", dataInicio)
        .lte("data", dataFim),
      supabase
        .from("disponibilidade_semanal")
        .select("*")
        .eq("ativo", true),
      supabase
        .from("agendamentos")
        .select("data_agendamento, hora_agendamento")
        .gte("data_agendamento", dataInicio)
        .lte("data_agendamento", dataFim)
        .neq("status_funil", "cancelado"),
    ]);

    // Filter by clinic
    const filterClinica = (item: any) =>
      clinicaIds.length === 0 ||
      item.clinica_id === null ||
      clinicaIds.includes(item.clinica_id);

    const bloqueiosDiaMap = new Map<string, boolean>();
    for (const b of (bloqueiosDia || []).filter(filterClinica)) {
      bloqueiosDiaMap.set(b.data, true);
    }

    const bloqueiosIntMap = new Map<string, any[]>();
    for (const b of (bloqueiosIntervalo || []).filter(filterClinica)) {
      const arr = bloqueiosIntMap.get(b.data) || [];
      arr.push(b);
      bloqueiosIntMap.set(b.data, arr);
    }

    const dispEspecificaMap = new Map<string, any[]>();
    for (const d of (dispEspecifica || []).filter(filterClinica)) {
      const arr = dispEspecificaMap.get(d.data) || [];
      arr.push(d);
      dispEspecificaMap.set(d.data, arr);
    }

    const dispSemanalFiltrada = (dispSemanal || []).filter(filterClinica);

    const agendamentosMap = new Map<string, Set<string>>();
    for (const a of agendamentos || []) {
      if (!a.data_agendamento || !a.hora_agendamento) continue;
      const set = agendamentosMap.get(a.data_agendamento) || new Set();
      set.add(a.hora_agendamento.substring(0, 5));
      agendamentosMap.set(a.data_agendamento, set);
    }

    // 4. Iterate each day of the month
    const datasDisponiveis: { data: string; slots_disponiveis: number }[] = [];
    const agora = new Date();

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const dataObj = new Date(ano, mes - 1, dia);
      if (dataObj < hoje) continue;

      const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      // Skip full-day blocks
      if (bloqueiosDiaMap.has(dataStr)) continue;

      // Generate slots
      let slots: string[] = [];
      const especifica = dispEspecificaMap.get(dataStr);

      if (especifica && especifica.length > 0) {
        const indisponivel = especifica.find((d: any) => !d.disponivel);
        if (indisponivel && !especifica.some((d: any) => d.disponivel)) continue;

        for (const d of especifica) {
          if (!d.disponivel || !d.hora_inicio || !d.hora_fim) continue;
          slots.push(...gerarSlots(d.hora_inicio, d.hora_fim, d.intervalo_minutos || 30));
        }
      } else {
        const diaSemana = dataObj.getDay();
        const semanal = dispSemanalFiltrada.filter((d: any) => d.dia_semana === diaSemana);
        if (semanal.length === 0) continue;

        for (const d of semanal) {
          slots.push(...gerarSlots(d.hora_inicio, d.hora_fim, d.intervalo_minutos));
        }
      }

      // Deduplicate
      slots = [...new Set(slots)].sort();

      // Remove interval blocks
      const bloqueiosInt = bloqueiosIntMap.get(dataStr) || [];
      if (bloqueiosInt.length > 0) {
        slots = slots.filter(
          (s) => !bloqueiosInt.some((b: any) => horarioDentroBloqueio(s, b.hora_inicio, b.hora_fim))
        );
      }

      // Remove occupied
      const ocupados = agendamentosMap.get(dataStr);
      if (ocupados) {
        slots = slots.filter((s) => !ocupados.has(s));
      }

      // Remove past slots for today
      const isToday = dataStr === agora.toISOString().split("T")[0];
      if (isToday) {
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes() + 30;
        slots = slots.filter((s) => {
          const [h, m] = s.split(":").map(Number);
          return h * 60 + m > minutosAgora;
        });
      }

      if (slots.length > 0) {
        datasDisponiveis.push({ data: dataStr, slots_disponiveis: slots.length });
      }
    }

    console.log(`[listar-datas] ${datasDisponiveis.length} datas com vagas`);

    return new Response(
      JSON.stringify({
        mes,
        ano,
        local_atendimento: localAtendimento || null,
        datas_disponiveis: datasDisponiveis,
        total_datas: datasDisponiveis.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[listar-datas] Erro:`, err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao listar datas disponíveis" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
