/**
 * mcp-agendamento — Supabase Edge Function
 * MCP Server com Streamable HTTP Transport (compatível com n8n MCP Client)
 *
 * Usa o SDK oficial @modelcontextprotocol/sdk com StreamableHttpTransport
 * para full compatibility com n8n 2.9+
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ─── Supabase client ──────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function supabaseRPC(fn: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC ${fn} failed [${res.status}]: ${err}`);
  }
  return res.json();
}

// ─── MCP Server factory ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new McpServer({
    name: "mcp-agendamento",
    version: "2.0.0",
  });

  // Tool 1: listar_horarios_disponiveis
  server.tool(
    "listar_horarios_disponiveis",
    "Lista horários disponíveis para agendamento em uma data e local específicos. " +
    "Chame para datas consecutivas até encontrar pelo menos 3 slots livres. " +
    "Nunca invente horários — use apenas os retornados por esta ferramenta.",
    {
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
        .describe("Data no formato YYYY-MM-DD"),
      local: z.string().optional()
        .describe("HGP, Clinicor, IOB ou Vitria. Vazio = todos os locais"),
    },
    async ({ data, local }) => {
      try {
        const result = await supabaseRPC("listar_horarios_disponiveis", {
          p_data: data,
          p_local: local ?? null,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ erro: String(e) }) }], isError: true };
      }
    }
  );

  // Tool 2: validar_horario
  server.tool(
    "validar_horario",
    "Verifica se um horário específico ainda está disponível antes de confirmar o agendamento. " +
    "Retorna alternativas próximas se o horário estiver ocupado.",
    {
      data_agendamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário HH:MM"),
      local_atendimento: z.string().describe("HGP, Clinicor, IOB ou Vitria"),
    },
    async ({ data_agendamento, hora_agendamento, local_atendimento }) => {
      try {
        const result = await supabaseRPC("validar_horario", {
          p_data: data_agendamento,
          p_hora: hora_agendamento,
          p_local: local_atendimento,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ erro: String(e) }) }], isError: true };
      }
    }
  );

  // Tool 3: criar_agendamento
  server.tool(
    "criar_agendamento",
    "Cria o agendamento definitivo após confirmar todos os dados com o paciente. " +
    "Valida disponibilidade automaticamente. " +
    "Use SOMENTE após o paciente confirmar: nome, local, data, hora e convênio.",
    {
      nome_completo: z.string().min(2).describe("Nome completo do paciente"),
      telefone_whatsapp: z.string().regex(/^\d{10,15}$/).describe("Telefone com DDD, apenas dígitos. Ex: 5591999998888"),
      tipo_atendimento: z.enum(["consulta", "retorno", "exame", "procedimento"]).describe("Tipo de atendimento"),
      local_atendimento: z.enum(["HGP", "Clinicor", "IOB", "Vitria"]).describe("Local de atendimento"),
      convenio: z.enum(["Bradesco", "Unimed", "Cassi", "SulAmérica", "particular"]).describe("Convênio ou particular"),
      data_agendamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário HH:MM"),
    },
    async (params) => {
      try {
        const result = await supabaseRPC("criar_agendamento", {
          p_nome_completo: params.nome_completo,
          p_telefone_whatsapp: params.telefone_whatsapp,
          p_tipo_atendimento: params.tipo_atendimento,
          p_local_atendimento: params.local_atendimento,
          p_convenio: params.convenio,
          p_data_agendamento: params.data_agendamento,
          p_hora_agendamento: params.hora_agendamento,
          p_origem: "mcp",
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ sucesso: false, erro: String(e) }) }], isError: true };
      }
    }
  );

  return server;
}

// ─── Deno serve (stateless) ───────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", server: "mcp-agendamento", version: "2.0.0", transport: "streamable-http", tools: ["listar_horarios_disponiveis", "validar_horario", "criar_agendamento"] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    await server.close();
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
