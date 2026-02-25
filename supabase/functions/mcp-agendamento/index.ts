// ================================================================
// supabase/functions/mcp-agendamento/index.ts
// MCP Server — chama Edge Functions reais em vez de RPC estático
// ================================================================

import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk/types.js";

// Importa o handler HTTP do Supabase para expor via SSE
import { createServer } from "npm:@supabase/mcp-utils";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ----------------------------------------------------------------
// Helper: chama uma Edge Function do mesmo projeto por HTTP
// ----------------------------------------------------------------
async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ----------------------------------------------------------------
// Definição das tools MCP
// ----------------------------------------------------------------
const tools = [
  {
    name: "listar_horarios_disponiveis",
    description:
      "Lista horários realmente disponíveis para agendamento em uma data e local, " +
      "respeitando disponibilidade semanal, bloqueios e agendamentos existentes.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "Data no formato YYYY-MM-DD",
        },
        local: {
          type: "string",
          description:
            "Local de atendimento: 'Clinicor', 'HGP', 'IOB' ou 'Vitria'",
        },
      },
      required: ["data", "local"],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await callEdgeFunction("listar-horarios-disponiveis", {
        data: args.data,
        local_atendimento: args.local ?? null,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  },
  {
    name: "validar_horario",
    description:
      "Verifica se um horário específico está disponível antes de confirmar o agendamento.",
    inputSchema: {
      type: "object",
      properties: {
        data_agendamento: {
          type: "string",
          description: "Data no formato YYYY-MM-DD",
        },
        hora_agendamento: {
          type: "string",
          description: "Hora no formato HH:MM",
        },
        local_atendimento: {
          type: "string",
          description:
            "Local de atendimento: 'Clinicor', 'HGP', 'IOB' ou 'Vitria'",
        },
      },
      required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await callEdgeFunction("validar-agendamento", {
        data_agendamento: args.data_agendamento,
        hora_agendamento: args.hora_agendamento,
        local_atendimento: args.local_atendimento,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  },
  {
    name: "criar_agendamento",
    description:
      "Cria um agendamento confirmado após validação do horário. " +
      "Use somente após o paciente confirmar todos os dados.",
    inputSchema: {
      type: "object",
      properties: {
        nome_completo: {
          type: "string",
          description: "Nome completo do paciente",
        },
        telefone_whatsapp: {
          type: "string",
          description: "Telefone do paciente (somente números, com DDD)",
        },
        tipo_atendimento: {
          type: "string",
          description: "Tipo de atendimento (ex: 'Consulta')",
        },
        local_atendimento: {
          type: "string",
          description:
            "Local de atendimento: 'Clinicor', 'HGP', 'IOB' ou 'Vitria'",
        },
        convenio: {
          type: "string",
          description:
            "Convênio: 'Bradesco', 'Unimed', 'Cassi', 'SulAmérica' ou 'Particular'",
        },
        data_agendamento: {
          type: "string",
          description: "Data no formato YYYY-MM-DD",
        },
        hora_agendamento: {
          type: "string",
          description: "Hora no formato HH:MM",
        },
      },
      required: [
        "nome_completo",
        "telefone_whatsapp",
        "local_atendimento",
        "convenio",
        "data_agendamento",
        "hora_agendamento",
      ],
    },
    handler: async (args: Record<string, unknown>) => {
      const result = await callEdgeFunction("criar-agendamento", {
        nome_completo: args.nome_completo,
        telefone_whatsapp: args.telefone_whatsapp,
        tipo_atendimento: args.tipo_atendimento ?? "Consulta",
        local_atendimento: args.local_atendimento,
        convenio: args.convenio,
        data_agendamento: args.data_agendamento,
        hora_agendamento: args.hora_agendamento,
        origem: "mcp",
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  },
];

// ----------------------------------------------------------------
// Servidor MCP
// ----------------------------------------------------------------
const server = new Server(
  { name: "mcp-agendamento", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Tool desconhecida: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  }

  try {
    return await tool.handler(
      (request.params.arguments ?? {}) as Record<string, unknown>
    );
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Erro ao executar ${request.params.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// ----------------------------------------------------------------
// Expor via HTTP (SSE) para o n8n MCP Client
// ----------------------------------------------------------------
const httpServer = createServer(server);
Deno.serve(httpServer);
