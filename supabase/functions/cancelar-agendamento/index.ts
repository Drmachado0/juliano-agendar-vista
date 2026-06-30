import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
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

  // Segredo compartilhado: só o n8n (ou o servidor MCP interno) pode cancelar.
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const provided = req.headers.get("x-n8n-secret");
  if (!sharedSecret || !provided || provided !== sharedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    const baseSelect = "id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento, local_atendimento, status_funil";
    let agendamentos:
      | { id: string; nome_completo: string | null; telefone_whatsapp: string | null; data_agendamento: string | null; hora_agendamento: string | null; local_atendimento: string | null; status_funil: string | null }[]
      | null = null;
    let fetchError: { message: string } | null = null;

    if (agendamento_id) {
      const res = await supabase
        .from("agendamentos")
        .select(baseSelect)
        .neq("status_funil", "cancelado")
        .eq("id", agendamento_id)
        .order("data_agendamento", { ascending: true });
      agendamentos = res.data as typeof agendamentos;
      fetchError = res.error;
    } else if (telefone) {
      // Match exato pelos últimos 8 dígitos (evita cancelar o paciente errado por substring)
      const last8 = telefone.replace(/\D/g, "").slice(-8);
      if (last8.length < 8) {
        return new Response(
          JSON.stringify({ error: "Telefone inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const hoje = new Date().toISOString().split("T")[0];
      const res = await supabase
        .from("agendamentos")
        .select(baseSelect)
        .neq("status_funil", "cancelado")
        .gte("data_agendamento", hoje)
        .order("data_agendamento", { ascending: true })
        .limit(200);
      fetchError = res.error;
      const match = (res.data ?? []).find(
        (a: { telefone_whatsapp: string | null }) =>
          (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8)
      );
      agendamentos = match ? [match as NonNullable<typeof agendamentos>[number]] : [];
    }

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
