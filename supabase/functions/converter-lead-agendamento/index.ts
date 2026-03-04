import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validarDisponibilidade } from "../_shared/validarDisponibilidade.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      lead_id,
      data_agendamento,
      hora_agendamento,
      local_atendimento,
      aceita_primeiro_horario,
      aceita_contato_whatsapp_email,
    } = await req.json();

    // Validate required fields
    if (!lead_id || !data_agendamento || !hora_agendamento || !local_atendimento) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: lead_id, data_agendamento, hora_agendamento, local_atendimento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_agendamento)) {
      return new Response(
        JSON.stringify({ error: "Formato de data inválido. Use YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(hora_agendamento)) {
      return new Response(
        JSON.stringify({ error: "Formato de hora inválido. Use HH:MM" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Validate availability
    console.log(`[converter-lead] Validando disponibilidade: ${data_agendamento} ${hora_agendamento} ${local_atendimento}`);
    const validacao = await validarDisponibilidade(supabase, data_agendamento, hora_agendamento, local_atendimento);

    if (!validacao.disponivel) {
      console.log(`[converter-lead] Horário indisponível: ${validacao.motivo}`);
      return new Response(
        JSON.stringify({ error: validacao.motivo, disponivel: false }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Determine status_crm based on location
    let statusCrm = "NOVO LEAD";
    const locationLower = local_atendimento.toLowerCase();
    if (locationLower.includes("clinicor")) {
      statusCrm = "CLINICOR";
    } else if (locationLower.includes("hgp") || locationLower.includes("hospital geral")) {
      statusCrm = "HGP";
    } else if (locationLower.includes("belém") || locationLower.includes("belem") || locationLower.includes("iob") || locationLower.includes("vitria")) {
      statusCrm = "BELÉM";
    }

    // 3. Update the lead record with appointment data
    console.log(`[converter-lead] Convertendo lead ${lead_id} → status_crm=${statusCrm}`);
    const { data: updated, error: updateError } = await supabase
      .from("agendamentos")
      .update({
        data_agendamento,
        hora_agendamento,
        aceita_primeiro_horario: aceita_primeiro_horario ?? false,
        aceita_contato_whatsapp_email: aceita_contato_whatsapp_email ?? false,
        status_funil: "agendado",
        status_crm: statusCrm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id)
      .select("id")
      .single();

    if (updateError) {
      console.error(`[converter-lead] Erro no update:`, updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updated) {
      console.error(`[converter-lead] Lead não encontrado: ${lead_id}`);
      return new Response(
        JSON.stringify({ error: "Lead não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[converter-lead] Lead ${lead_id} convertido com sucesso`);
    return new Response(
      JSON.stringify({ success: true, id: updated.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[converter-lead] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
