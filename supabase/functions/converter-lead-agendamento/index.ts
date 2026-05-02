import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validarDisponibilidade } from "../_shared/validarDisponibilidade.ts";
import { syncAgendamentoToCalendar } from "../_shared/syncGoogleCalendar.ts";

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
    let clinicaSlug: string | null = null;
    const locationLower = local_atendimento.toLowerCase();
    if (locationLower.includes("clinicor")) {
      statusCrm = "CLINICOR";
      clinicaSlug = "clinicor";
    } else if (locationLower.includes("hgp") || locationLower.includes("hospital geral")) {
      statusCrm = "HGP";
      clinicaSlug = "hgp";
    } else if (locationLower.includes("belém") || locationLower.includes("belem") || locationLower.includes("iob") || locationLower.includes("vitria")) {
      statusCrm = "BELÉM";
      // Belém pode ter múltiplas clínicas (IOB/Vitria); deixamos clinica_id em branco
    }

    // 2.1 Resolve clinica_id a partir do slug para que a Agenda do admin
    // (que filtra por clinica_id) consiga exibir o horário como ocupado.
    let clinicaIdResolved: string | null = null;
    if (clinicaSlug) {
      const { data: clinicaRow, error: clinicaErr } = await supabase
        .from("clinicas")
        .select("id")
        .eq("slug", clinicaSlug)
        .eq("ativo", true)
        .maybeSingle();
      if (clinicaErr) {
        console.error(`[converter-lead] Erro ao buscar clinica slug=${clinicaSlug}:`, clinicaErr);
      }
      clinicaIdResolved = clinicaRow?.id ?? null;
      if (!clinicaIdResolved) {
        console.warn(`[converter-lead] Clínica não encontrada para slug=${clinicaSlug} — agendamento ficará sem clinica_id e NÃO aparecerá em /admin/agenda filtrada por clínica.`);
      }
    }

    // 3. Update the lead record with appointment data
    console.log(`[converter-lead] Convertendo lead ${lead_id} → status_crm=${statusCrm} clinica_id=${clinicaIdResolved ?? "(none)"}`);
    const updatePayload: Record<string, unknown> = {
      data_agendamento,
      hora_agendamento,
      aceita_primeiro_horario: aceita_primeiro_horario ?? false,
      aceita_contato_whatsapp_email: aceita_contato_whatsapp_email ?? false,
      status_funil: "agendado",
      status_crm: statusCrm,
      updated_at: new Date().toISOString(),
    };
    if (clinicaIdResolved) {
      updatePayload.clinica_id = clinicaIdResolved;
    }

    const { data: updated, error: updateError } = await supabase
      .from("agendamentos")
      .update(updatePayload)
      .eq("id", lead_id)
      .select("id, clinica_id, nome_completo, email, telefone_whatsapp, tipo_atendimento, local_atendimento, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbc, fbp, landing_page")
      .single();

    if (updateError) {
      console.error(`[converter-lead] Erro no update:`, updateError);
      // Race condition: outro agendamento foi criado no mesmo slot entre validar e atualizar
      if ((updateError as any).code === "23505") {
        return new Response(
          JSON.stringify({
            error: "Este horário acabou de ser reservado por outra pessoa. Por favor, escolha outro horário.",
            code: "SLOT_TAKEN",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Pós-validação: para Clinicor/HGP o agendamento DEVE ter clinica_id
    // (a Agenda do admin filtra por clinica_id; sem isso o slot não aparece como ocupado).
    if (clinicaSlug && !updated.clinica_id) {
      console.error(`[converter-lead] Lead ${lead_id} atualizado mas sem clinica_id (slug=${clinicaSlug}). Agenda não vai exibir como ocupado.`);
      return new Response(
        JSON.stringify({
          error: "Falha ao vincular clínica ao agendamento. Encaminhe para atendimento humano.",
          code: "CLINICA_NOT_LINKED",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[converter-lead] Lead ${lead_id} convertido com sucesso (clinica_id=${updated.clinica_id ?? "(none)"})`);

    // Sync com Google Calendar (fire-and-forget, não bloqueia resposta)
    syncAgendamentoToCalendar(supabase, updated.id, "create")
      .then(() => console.log("[converter-lead] Google Calendar sync triggered"))
      .catch((err: unknown) => console.error("[converter-lead] Google Calendar sync failed:", err));

    // Meta CAPI Schedule + CompleteRegistration (fire-and-forget, dedup com browser via event_id = updated.id)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("x-real-ip")
      ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";
    fireMetaCapiSchedule(updated as any, clientIp, userAgent)
      .catch((e) => console.error("[converter-lead] Meta CAPI Schedule fire-and-forget error:", e));
    fireMetaCapiCompleteRegistration(updated as any, clientIp, userAgent)
      .catch((e) => console.error("[converter-lead] Meta CAPI CompleteRegistration fire-and-forget error:", e));

    return new Response(
      JSON.stringify({ success: true, id: updated.id, clinica_id: updated.clinica_id }),
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
