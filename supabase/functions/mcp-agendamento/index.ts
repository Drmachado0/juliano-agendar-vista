import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getClinicaSlugsFromLocal,
  gerarSlots,
  horarioDentroBloqueio,
  validarDisponibilidade,
} from "../_shared/validarDisponibilidade.ts";

// ─── Supabase client (service role) ──────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── Helpers reused from criar-agendamento ───────────────────────────────────
function validateAgendamento(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.nome_completo || typeof data.nome_completo !== "string" || data.nome_completo.length < 3)
    errors.push("Nome completo é obrigatório (mínimo 3 caracteres)");
  if (!data.telefone_whatsapp || typeof data.telefone_whatsapp !== "string" || data.telefone_whatsapp.length < 10)
    errors.push("Telefone WhatsApp é obrigatório (mínimo 10 dígitos)");
  const tiposValidos = ["Consulta", "Retorno", "Exame", "Cirurgia"];
  if (!data.tipo_atendimento || !tiposValidos.includes(data.tipo_atendimento as string))
    errors.push("Tipo de atendimento inválido");
  if (!data.local_atendimento || typeof data.local_atendimento !== "string")
    errors.push("Local de atendimento é obrigatório");
  if (!data.convenio || typeof data.convenio !== "string")
    errors.push("Convênio é obrigatório");
  if (!data.data_agendamento || !/^\d{4}-\d{2}-\d{2}$/.test(data.data_agendamento as string))
    errors.push("Data de agendamento inválida");
  if (!data.hora_agendamento || !/^\d{2}:\d{2}(:\d{2})?$/.test(data.hora_agendamento as string))
    errors.push("Hora de agendamento inválida");
  return { valid: errors.length === 0, errors };
}

function determineStatusCrmByLocation(local: string): string {
  const l = local.toLowerCase();
  if (l.includes("clinicor")) return "CLINICOR";
  if (l.includes("hgp") || l.includes("hospital geral")) return "HGP";
  if (l.includes("belém") || l.includes("belem") || l.includes("iob") || l.includes("vitria")) return "BELÉM";
  return "NOVO LEAD";
}

// ─── Listar horários (same logic as listar-horarios-disponiveis) ─────────────
async function listarHorarios(data: string, localAtendimento?: string) {
  const supabase = getSupabase();
  const local = localAtendimento || "";

  // Past date check
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (new Date(data + "T00:00:00") < hoje) {
    return { data, horarios_disponiveis: [], total: 0, motivo: "Data no passado" };
  }

  // Clinic IDs
  const slugs = local ? getClinicaSlugsFromLocal(local) : [];
  let clinicaIds: string[] = [];
  if (slugs.length > 0) {
    const { data: clinicas } = await supabase.from("clinicas").select("id").in("slug", slugs).eq("ativo", true);
    clinicaIds = clinicas?.map((c: any) => c.id) || [];
  }

  // Full-day blocks
  const { data: bloqueiosDia } = await supabase
    .from("bloqueios_agenda").select("*").eq("data", data).in("tipo_bloqueio", ["dia_inteiro", "feriado"]);
  const bloqueiosDiaFiltrados = bloqueiosDia?.filter((b: any) => clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)) || [];
  if (bloqueiosDiaFiltrados.length > 0) {
    return { data, horarios_disponiveis: [], total: 0, motivo: bloqueiosDiaFiltrados[0].motivo || "Data bloqueada" };
  }

  // Interval blocks
  const { data: bloqueiosInt } = await supabase
    .from("bloqueios_agenda").select("*").eq("data", data).in("tipo_bloqueio", ["intervalo", "ausencia_profissional"]);
  const bloqueiosIntFiltrados = bloqueiosInt?.filter((b: any) => clinicaIds.length === 0 || clinicaIds.includes(b.clinica_id)) || [];

  // Build slots
  let allSlots: string[] = [];

  const { data: dispEsp } = await supabase.from("disponibilidade_especifica").select("*").eq("data", data);
  const dispEspFiltrada = dispEsp?.filter((d: any) => d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)) || [];

  if (dispEspFiltrada.length > 0) {
    const indisponivel = dispEspFiltrada.find((d: any) => !d.disponivel);
    if (indisponivel && !dispEspFiltrada.some((d: any) => d.disponivel)) {
      return { data, horarios_disponiveis: [], total: 0, motivo: indisponivel.motivo || "Data indisponível" };
    }
    for (const d of dispEspFiltrada) {
      if (!d.disponivel || !d.hora_inicio || !d.hora_fim) continue;
      allSlots.push(...gerarSlots(d.hora_inicio, d.hora_fim, d.intervalo_minutos || 30));
    }
  } else {
    const diaSemana = new Date(data + "T12:00:00").getDay();
    const { data: dispSem } = await supabase.from("disponibilidade_semanal").select("*").eq("dia_semana", diaSemana).eq("ativo", true);
    const dispSemFiltrada = dispSem?.filter((d: any) => d.clinica_id === null || clinicaIds.length === 0 || clinicaIds.includes(d.clinica_id)) || [];
    if (dispSemFiltrada.length === 0) {
      return { data, horarios_disponiveis: [], total: 0, motivo: "Sem expediente neste dia" };
    }
    for (const d of dispSemFiltrada) {
      allSlots.push(...gerarSlots(d.hora_inicio, d.hora_fim, d.intervalo_minutos));
    }
  }

  allSlots = [...new Set(allSlots)].sort();

  // Remove blocked
  allSlots = allSlots.filter(s => !bloqueiosIntFiltrados.some((b: any) => horarioDentroBloqueio(s, b.hora_inicio, b.hora_fim)));

  // Remove occupied
  const { data: agExistentes } = await supabase.from("agendamentos").select("hora_agendamento").eq("data_agendamento", data).neq("status_funil", "cancelado");
  const ocupados = new Set(agExistentes?.map((a: any) => a.hora_agendamento?.substring(0, 5)) || []);
  allSlots = allSlots.filter(s => !ocupados.has(s));

  // Remove past (today)
  const agora = new Date();
  if (data === agora.toISOString().split("T")[0]) {
    const minAgora = agora.getHours() * 60 + agora.getMinutes() + 30;
    allSlots = allSlots.filter(s => { const [h, m] = s.split(":").map(Number); return h * 60 + m > minAgora; });
  }

  return { data, horarios_disponiveis: allSlots, total: allSlots.length };
}

// ─── MCP Server setup ────────────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "dr-juliano-agendamento",
  version: "1.0.0",
});

// Tool 1: listar_horarios_disponiveis
mcpServer.tool({
  name: "listar_horarios_disponiveis",
  description: "Lista horários livres para agendamento em uma data específica. Retorna array de horários no formato HH:MM.",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "Data no formato YYYY-MM-DD" },
      local_atendimento: { type: "string", description: "Local: 'Clinicor – Paragominas', 'Hospital Geral de Paragominas', ou 'Belém (IOB / Vitria)'. Opcional." },
    },
    required: ["data"],
  },
  handler: async ({ data, local_atendimento }: { data: string; local_atendimento?: string }) => {
    try {
      const resultado = await listarHorarios(data, local_atendimento);
      return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
    }
  },
});

// Tool 2: validar_horario
mcpServer.tool({
  name: "validar_horario",
  description: "Verifica se um horário específico está disponível para agendamento.",
  inputSchema: {
    type: "object",
    properties: {
      data_agendamento: { type: "string", description: "Data no formato YYYY-MM-DD" },
      hora_agendamento: { type: "string", description: "Hora no formato HH:MM" },
      local_atendimento: { type: "string", description: "Local de atendimento" },
    },
    required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
  },
  handler: async ({ data_agendamento, hora_agendamento, local_atendimento }: { data_agendamento: string; hora_agendamento: string; local_atendimento: string }) => {
    try {
      const resultado = await validarDisponibilidade(local_atendimento, data_agendamento, hora_agendamento);
      return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
    }
  },
});

// Tool 3: criar_agendamento
mcpServer.tool({
  name: "criar_agendamento",
  description: "Cria um novo agendamento. Valida disponibilidade, insere no banco e dispara notificações por WhatsApp e e-mail.",
  inputSchema: {
    type: "object",
    properties: {
      nome_completo: { type: "string", description: "Nome completo do paciente" },
      telefone_whatsapp: { type: "string", description: "Telefone WhatsApp com DDD" },
      tipo_atendimento: { type: "string", description: "Consulta, Retorno, Exame ou Cirurgia" },
      local_atendimento: { type: "string", description: "Local de atendimento" },
      convenio: { type: "string", description: "Convênio do paciente" },
      data_agendamento: { type: "string", description: "Data no formato YYYY-MM-DD" },
      hora_agendamento: { type: "string", description: "Hora no formato HH:MM" },
      email: { type: "string", description: "E-mail do paciente (opcional)" },
      data_nascimento: { type: "string", description: "Data de nascimento YYYY-MM-DD (opcional)" },
      detalhe_exame_ou_cirurgia: { type: "string", description: "Detalhe do exame/cirurgia (opcional)" },
      convenio_outro: { type: "string", description: "Nome do convênio se 'Outro' (opcional)" },
    },
    required: ["nome_completo", "telefone_whatsapp", "tipo_atendimento", "local_atendimento", "convenio", "data_agendamento", "hora_agendamento"],
  },
  handler: async (params: Record<string, any>) => {
    try {
      // Validate
      const validation = validateAgendamento(params);
      if (!validation.valid) {
        return { content: [{ type: "text", text: JSON.stringify({ error: validation.errors.join(", ") }) }] };
      }

      // Check availability
      const disponibilidade = await validarDisponibilidade(params.local_atendimento, params.data_agendamento, params.hora_agendamento);
      if (!disponibilidade.disponivel) {
        return { content: [{ type: "text", text: JSON.stringify({ error: disponibilidade.motivo, codigo: disponibilidade.codigo }) }] };
      }

      const supabase = getSupabase();
      const statusCrm = determineStatusCrmByLocation(params.local_atendimento);

      const sanitized = {
        nome_completo: params.nome_completo.trim(),
        telefone_whatsapp: params.telefone_whatsapp.trim(),
        data_nascimento: params.data_nascimento || null,
        email: params.email?.trim() || null,
        tipo_atendimento: params.tipo_atendimento,
        detalhe_exame_ou_cirurgia: params.detalhe_exame_ou_cirurgia || null,
        local_atendimento: params.local_atendimento,
        convenio: params.convenio,
        convenio_outro: params.convenio_outro || null,
        data_agendamento: params.data_agendamento,
        hora_agendamento: params.hora_agendamento,
        aceita_primeiro_horario: false,
        aceita_contato_whatsapp_email: true,
        status_crm: statusCrm,
        origem: "mcp",
      };

      const { data, error } = await supabase.from("agendamentos").insert([sanitized]).select("id").single();
      if (error) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Erro ao salvar: " + error.message }) }] };
      }

      // Background notifications
      (globalThis as any).EdgeRuntime?.waitUntil?.((async () => {
        try {
          await supabase.functions.invoke("confirmar-agendamento-whatsapp", {
            body: { agendamento_data: sanitized },
          });
        } catch (e) { console.error("[mcp] WhatsApp notification failed:", e); }
        try {
          await supabase.functions.invoke("notificar-agendamento-email", {
            body: {
              nome_completo: sanitized.nome_completo,
              telefone_whatsapp: sanitized.telefone_whatsapp,
              email_paciente: sanitized.email,
              tipo_atendimento: sanitized.tipo_atendimento,
              local_atendimento: sanitized.local_atendimento,
              convenio: sanitized.convenio,
              data_agendamento: sanitized.data_agendamento,
              hora_agendamento: sanitized.hora_agendamento,
            },
          });
        } catch (e) { console.error("[mcp] Email notification failed:", e); }
      })()) ?? Promise.resolve();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            agendamento_id: data.id,
            mensagem: `Agendamento criado para ${sanitized.nome_completo} em ${sanitized.data_agendamento} às ${sanitized.hora_agendamento}`,
          }),
        }],
      };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }] };
    }
  },
});

// ─── Hono + Transport ────────────────────────────────────────────────────────
const app = new Hono();
const transport = new StreamableHttpTransport();

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
