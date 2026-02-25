/**
 * mcp-agendamento — Supabase Edge Function
 * MCP Server com mcp-lite + Hono (Streamable HTTP, compatível com n8n MCP Client)
 */

import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";

// ─── Edge Function client ─────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.text();
  try { return JSON.parse(data); } catch { return data; }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const mcp = new McpServer({
  name: "mcp-agendamento",
  version: "2.0.0",
});

// Tool 1: listar_horarios_disponiveis
mcp.tool("listar_horarios_disponiveis", {
  description:
    "Lista horários disponíveis para agendamento em uma data e local específicos. " +
    "Chame para datas consecutivas até encontrar pelo menos 3 slots livres. " +
    "Nunca invente horários — use apenas os retornados por esta ferramenta.",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "Data no formato YYYY-MM-DD" },
      local: { type: "string", description: "HGP, Clinicor, IOB ou Vitria. Vazio = todos" },
    },
    required: ["data"],
  },
  handler: async (args: { data: string; local?: string }) => {
    try {
      const result = await callEdgeFunction("listar-horarios-disponiveis", {
        data: args.data,
        local_atendimento: args.local ?? null,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ erro: String(e) }) }], isError: true };
    }
  },
});

// Tool 2: validar_horario
mcp.tool("validar_horario", {
  description:
    "Verifica se um horário específico ainda está disponível antes de confirmar o agendamento. " +
    "Retorna alternativas próximas se o horário estiver ocupado.",
  inputSchema: {
    type: "object",
    properties: {
      data_agendamento: { type: "string", description: "Data YYYY-MM-DD" },
      hora_agendamento: { type: "string", description: "Horário HH:MM" },
      local_atendimento: { type: "string", description: "HGP, Clinicor, IOB ou Vitria" },
    },
    required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
  },
  handler: async (args: { data_agendamento: string; hora_agendamento: string; local_atendimento: string }) => {
    try {
      const result = await callEdgeFunction("validar-agendamento", {
        data_agendamento: args.data_agendamento,
        hora_agendamento: args.hora_agendamento,
        local_atendimento: args.local_atendimento,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ erro: String(e) }) }], isError: true };
    }
  },
});

// Tool 3: criar_agendamento
mcp.tool("criar_agendamento", {
  description:
    "Cria o agendamento definitivo após confirmar todos os dados com o paciente. " +
    "Valida disponibilidade automaticamente. " +
    "Use SOMENTE após o paciente confirmar: nome, local, data, hora e convênio.",
  inputSchema: {
    type: "object",
    properties: {
      nome_completo: { type: "string", description: "Nome completo do paciente" },
      telefone_whatsapp: { type: "string", description: "Telefone com DDD, apenas dígitos. Ex: 5591999998888" },
      tipo_atendimento: { type: "string", enum: ["consulta", "retorno", "exame", "procedimento"], description: "Tipo de atendimento" },
      local_atendimento: { type: "string", enum: ["HGP", "Clinicor", "IOB", "Vitria"], description: "Local de atendimento" },
      convenio: { type: "string", enum: ["Bradesco", "Unimed", "Cassi", "SulAmérica", "particular"], description: "Convênio ou particular" },
      data_agendamento: { type: "string", description: "Data YYYY-MM-DD" },
      hora_agendamento: { type: "string", description: "Horário HH:MM" },
    },
    required: ["nome_completo", "telefone_whatsapp", "tipo_atendimento", "local_atendimento", "convenio", "data_agendamento", "hora_agendamento"],
  },
  handler: async (args: any) => {
    try {
      const result = await callEdgeFunction("criar-agendamento", {
        nome_completo: args.nome_completo,
        telefone_whatsapp: args.telefone_whatsapp,
        tipo_atendimento: args.tipo_atendimento,
        local_atendimento: args.local_atendimento,
        convenio: args.convenio,
        data_agendamento: args.data_agendamento,
        hora_agendamento: args.hora_agendamento,
        origem: "mcp",
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ sucesso: false, erro: String(e) }) }], isError: true };
    }
  },
});

// ─── HTTP Transport + Hono ────────────────────────────────────────────────────
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const mcpApp = new Hono();

mcpApp.get("/", (c) =>
  c.json({
    status: "ok",
    server: "mcp-agendamento",
    version: "2.0.0",
    transport: "streamable-http",
    tools: ["listar_horarios_disponiveis", "validar_horario", "criar_agendamento"],
  })
);

mcpApp.all("/mcp", async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});

const app = new Hono();
app.route("/mcp-agendamento", mcpApp);

Deno.serve(app.fetch);
