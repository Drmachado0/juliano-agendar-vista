// supabase/functions/mcp-agendamento/index.ts
// MCP Server — SDK oficial @modelcontextprotocol/sdk + Hono
// Protocolo Streamable HTTP para compatibilidade com n8n MCP Client

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

// ─── Criar servidor MCP ─────────────────────
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "dr-juliano-agendamento",
    version: "1.0.0",
  });

  // Tool 1: listar_horarios_disponiveis
  server.tool(
    "listar_horarios_disponiveis",
    "Lista horários disponíveis para agendamento em uma data. Retorna slots livres com horário e local. Use ANTES de criar agendamento.",
    {
      data: z.string().describe("Data no formato YYYY-MM-DD (ex: 2026-03-02)"),
      local: z.string().optional().describe("Local: 'HGP', 'Clinicor', 'IOB' ou 'Vitria'. Vazio = todos."),
    },
    async ({ data, local }) => {
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
    }
  );

  // Tool 2: criar_agendamento
  server.tool(
    "criar_agendamento",
    "Cria agendamento de consulta com Dr. Juliano. Valida disponibilidade antes. Sempre consulte listar_horarios_disponiveis antes.",
    {
      nome_completo: z.string().describe("Nome completo do paciente"),
      telefone_whatsapp: z.string().describe("Telefone com DDD (ex: 5591991000303)"),
      tipo_atendimento: z.string().describe("consulta, retorno, exame ou procedimento"),
      local_atendimento: z.string().describe("HGP, Clinicor, IOB ou Vitria"),
      convenio: z.string().describe("Bradesco, Unimed, Cassi, SulAmérica ou particular"),
      data_agendamento: z.string().describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().describe("Horário HH:MM"),
    },
    async (params) => {
      const supabase = criarClienteSupabase();
      const resultado = await criarAgendamento(supabase, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(resultado) }] };
    }
  );

  // Tool 3: validar_horario
  server.tool(
    "validar_horario",
    "Verifica se um horário específico está disponível. Retorna alternativas se indisponível.",
    {
      data_agendamento: z.string().describe("Data YYYY-MM-DD"),
      hora_agendamento: z.string().describe("Horário HH:MM"),
      local_atendimento: z.string().describe("HGP, Clinicor, IOB ou Vitria"),
    },
    async ({ data_agendamento, hora_agendamento, local_atendimento }) => {
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
    }
  );

  return server;
}

// ─── Hono app ───────────────────────────────
const app = new Hono();

// Health check
app.get("/*", (c) => {
  return c.json({
    name: "dr-juliano-agendamento",
    version: "1.0.0",
    status: "online",
    protocol: "mcp-streamable-http",
    tools: ["listar_horarios_disponiveis", "criar_agendamento", "validar_horario"],
  });
});

// MCP Streamable HTTP endpoint
app.post("/*", async (c) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  await server.connect(transport);

  const response = await transport.handleRequest(c.req.raw);
  return response;
});

// DELETE for session cleanup (MCP protocol)
app.delete("/*", async (c) => {
  return c.json({ message: "Session terminated" }, 200);
});

Deno.serve(app.fetch);
