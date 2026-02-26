import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const { agendamento_id, telefone, motivo } = body as {
      agendamento_id?: string;
      telefone?: string;
      motivo?: string;
    };

    if (!agendamento_id && !telefone) {
      return new Response(
        JSON.stringify({ error: "Informe agendamento_id ou telefone para cancelar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query to find the appointment(s)
    let query = supabase
      .from("agendamentos")
      .select("id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento, local_atendimento, status_funil")
      .neq("status_funil", "cancelado")
      .order("data_agendamento", { ascending: true });

    if (agendamento_id) {
      query = query.eq("id", agendamento_id);
    } else if (telefone) {
      // Normalize: keep only digits
      const digits = telefone.replace(/\D/g, "");
      query = query.or(`telefone_whatsapp.ilike.%${digits}%`);
      // Only cancel the next upcoming appointment
      query = query.gte("data_agendamento", new Date().toISOString().split("T")[0]);
      query = query.limit(1);
    }

    const { data: agendamentos, error: fetchError } = await query;

    if (fetchError) {
      console.error("[cancelar-agendamento] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar agendamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nenhum agendamento futuro encontrado para cancelar",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agendamento = agendamentos[0];

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from("agendamentos")
      .update({
        status_funil: "cancelado",
        observacoes_internas: motivo
          ? `Cancelado via MCP: ${motivo}`
          : "Cancelado via MCP",
      })
      .eq("id", agendamento.id);

    if (updateError) {
      console.error("[cancelar-agendamento] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao cancelar agendamento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cancelar-agendamento] Cancelado: ${agendamento.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Agendamento cancelado com sucesso",
        agendamento_cancelado: {
          id: agendamento.id,
          nome: agendamento.nome_completo,
          data: agendamento.data_agendamento,
          hora: agendamento.hora_agendamento,
          local: agendamento.local_atendimento,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[cancelar-agendamento] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
