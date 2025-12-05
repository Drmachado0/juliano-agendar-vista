import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlotDisponivel {
  horaFormatada: string;
  disponivel: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { data, clinicaSlug, localAtendimento } = await req.json();

    if (!data) {
      throw new Error("Data é obrigatória");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar clínica pelo slug se fornecido
    let clinicaId: string | null = null;
    if (clinicaSlug) {
      const { data: clinica } = await supabase
        .from("clinicas")
        .select("id")
        .eq("slug", clinicaSlug)
        .eq("ativo", true)
        .maybeSingle();
      
      if (clinica) {
        clinicaId = clinica.id;
      }
    }

    // Buscar agendamentos do dia
    let agendamentosQuery = supabase
      .from("agendamentos")
      .select("hora_agendamento")
      .eq("data_agendamento", data);

    if (clinicaId) {
      agendamentosQuery = agendamentosQuery.eq("clinica_id", clinicaId);
    } else if (localAtendimento) {
      agendamentosQuery = agendamentosQuery.eq("local_atendimento", localAtendimento);
    }

    const { data: agendamentos, error: agendamentosError } = await agendamentosQuery;
    if (agendamentosError) throw agendamentosError;

    // Buscar bloqueios do dia
    let bloqueios: any[] = [];
    if (clinicaId) {
      const { data: bloqueiosData, error: bloqueiosError } = await supabase
        .from("bloqueios_agenda")
        .select("*")
        .eq("clinica_id", clinicaId)
        .eq("data", data);
      
      if (bloqueiosError) throw bloqueiosError;
      bloqueios = bloqueiosData || [];
    }

    // Gerar slots de 30 minutos das 8h às 18h
    const slots: SlotDisponivel[] = [];
    const horaInicio = 8;
    const horaFim = 18;
    const duracaoMin = 30;

    // Data selecionada
    const [ano, mes, dia] = data.split("-").map(Number);
    const dataSelecionada = new Date(ano, mes - 1, dia);
    const agora = new Date();
    const isHoje = dataSelecionada.toDateString() === agora.toDateString();
    const horaAgora = agora.getHours();
    const minutoAgora = agora.getMinutes();

    // Horários já ocupados
    const horariosOcupados = new Set(
      (agendamentos || []).map((a: any) => a.hora_agendamento.slice(0, 5))
    );

    // Verificar bloqueio de dia inteiro ou feriado
    const bloqueioTotal = bloqueios.some(
      (b) => b.tipo_bloqueio === "dia_inteiro" || b.tipo_bloqueio === "feriado"
    );

    let horaAtual = horaInicio;
    let minutoAtual = 0;

    while (horaAtual < horaFim || (horaAtual === horaFim && minutoAtual === 0)) {
      const horaFormatada = `${String(horaAtual).padStart(2, "0")}:${String(minutoAtual).padStart(2, "0")}`;

      let disponivel = true;

      // Verificar se é passado
      if (isHoje && (horaAtual < horaAgora || (horaAtual === horaAgora && minutoAtual <= minutoAgora))) {
        disponivel = false;
      }

      // Verificar bloqueio total
      if (bloqueioTotal) {
        disponivel = false;
      }

      // Verificar bloqueio de intervalo
      if (disponivel) {
        for (const bloqueio of bloqueios) {
          if (bloqueio.tipo_bloqueio === "intervalo" && bloqueio.hora_inicio && bloqueio.hora_fim) {
            if (horaFormatada >= bloqueio.hora_inicio && horaFormatada < bloqueio.hora_fim) {
              disponivel = false;
              break;
            }
          }
        }
      }

      // Verificar se já está ocupado
      if (disponivel && horariosOcupados.has(horaFormatada)) {
        disponivel = false;
      }

      slots.push({ horaFormatada, disponivel });

      minutoAtual += duracaoMin;
      if (minutoAtual >= 60) {
        horaAtual += Math.floor(minutoAtual / 60);
        minutoAtual = minutoAtual % 60;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        slots: slots.filter((s) => s.disponivel).map((s) => s.horaFormatada),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Erro ao verificar disponibilidade:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
