// supabase/functions/mcp-agendamento/index.ts
/**
 * mcp-agendamento — Supabase Edge Function
 * MCP Server com Streamable HTTP Transport (compatível com n8n MCP Client 2.9+)
 */

import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import {
  criarClienteSupabase,
  listarHorariosDisponiveis,
  validarDisponibilidade,
  criarAgendamento,
  resolverClinica,
} from "../_shared/validarDisponibilidade.ts";

// ─── Session store ────────────────────────────────────────────────────────────
const transports = new Map<string, StreamableHTTPServerTransport>();

// ─── MCP Server factory ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({
    name: "mcp-agendamento",
    version: "2.0.0",
  });

  // Tool 1: listar_horarios_disponiveis
  server.tool(
    "listar_horarios_disponiveis",
    "Lista horários disponíveis para agendamento. Use para datas consecutivas até encontrar pelo menos 3 slots livres. NUNCA invente horários.",
    {
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data no formato YYYY-MM-DD"),
      local: z.string().optional().describe("HGP, Clinicor, IOB ou Vitria. Vazio = todos"),
    },
    async ({ data, local }) => {
      try {
        const supabase = criarClienteSupabase();
        const slots = await listarHorariosDisponiveis(supabase, data, local);

        if (slots.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                disponivel: false,
                mensagem: `Sem horários para ${data}${local ? ` no ${local}` : ""}. Tente outra data.`,
                slots: [],
              }),
            }],
          };
        }

        const porLocal: Record<string, string[]> = {};
        for (const s of slots) {
          if (!porLocal[s.local]) porLocal[s.local] = [];
          porLocal[s.local].push(s.horario);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              disponivel: true,
              data,
              dia_semana: slots[0].dia_semana,
              total_slots: slots.length,
              por_local: porLocal,
              slots,
            }),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ erro: String(e) }) }], isError: true };
      }
    }
  );

  // Tool 2: validar_horario
  server.tool(
    "validar_horario",
    "Verifica se um horário específico está disponível. Retorna alternativas se estiver ocupado.",
    {
      data_agendamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário HH:MM"),
      local_atendimento: z.string().describe("HGP, Clinicor, IOB ou Vitria"),
    },
    async ({ data_agendamento, hora_agendamento, local_atendimento }) => {
      try {
        const supabase = criarClienteSupabase();
        const resultado = await validarDisponibilidade(supabase, data_agendamento, hora_agendamento, local_atendimento);
        const clinica = resolverClinica(local_atendimento);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...resultado,
              data: data_agendamento,
              horario: hora_agendamento,
              local: clinica?.nome || local_atendimento,
            }),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ erro: String(e) }) }], isError: true };
      }
    }
  );

  // Tool 3: criar_agendamento
  server.tool(
    "criar_agendamento",
    "Cria o agendamento definitivo. Use SOMENTE após confirmar todos os dados com o paciente.",
    {
      nome_completo: z.string().min(2).describe("Nome completo do paciente"),
      telefone_whatsapp: z.string().regex(/^\d{10,15}$/).describe("Telefone com DDD, só dígitos. Ex: 5591999998888"),
      tipo_atendimento: z.enum(["consulta", "retorno", "exame", "procedimento"]).describe("Tipo de atendimento"),
      local_atendimento: z.enum(["HGP", "Clinicor", "IOB", "Vitria"]).describe("Local de atendimento"),
      convenio: z.enum(["Bradesco", "Unimed", "Cassi", "SulAmérica", "particular"]).describe("Convênio ou particular"),
      data_agendamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário HH:MM"),
    },
    async (params) => {
      try {
        const supabase = criarClienteSupabase();
        const resultado = await criarAgendamento(supabase, params);
        return { content: [{ type: "text" as const, text: JSON.stringify(resultado) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ sucesso: false, erro: String(e) }) }], isError: true };
      }
    }
  );

  return server;
}

// ─── Hono app ─────────────────────────────────────────────────────────────────
const app = new Hono();

// Health check
app.get("/", (c) => c.json({
  status: "ok",
  server: "mcp-agendamento",
  version: "2.0.0",
  transport: "streamable-http",
  tools: ["listar_horarios_disponiveis", "validar_horario", "criar_agendamento"],
}));

// MCP Streamable HTTP — handles all protocol traffic
app.all("/", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    const server = createMcpServer();
    await server.connect(transport);
    if (transport.sessionId) {
      transports.set(transport.sessionId, transport);
    }
  }

  return transport.handleRequest(c.req.raw);
});

Deno.serve((req) => app.fetch(req));
