// supabase/functions/mcp-agendamento/index.ts
// MCP Server — Schema LOVABLE — Sem dependências externas
// Protocolo JSON-RPC implementado manualmente

import {
  criarClienteSupabase,
  listarHorariosDisponiveis,
  validarDisponibilidade,
  criarAgendamento,
  resolverClinica,
} from "../_shared/validarDisponibilidade.ts";

// ─── Definição das tools ────────────────────
const TOOLS = [
  {
    name: "listar_horarios_disponiveis",
    description:
      "Lista horários disponíveis para agendamento em uma data. Retorna slots livres com horário e local. Use ANTES de criar agendamento.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "Data no formato YYYY-MM-DD (ex: 2026-03-02)",
        },
        local: {
          type: "string",
          description:
            "Local: 'HGP', 'Clinicor', 'IOB' ou 'Vitria'. Vazio = todos.",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "criar_agendamento",
    description:
      "Cria agendamento de consulta com Dr. Juliano. Valida disponibilidade antes. Sempre consulte listar_horarios_disponiveis antes.",
    inputSchema: {
      type: "object",
      properties: {
        nome_completo: { type: "string", description: "Nome completo do paciente" },
        telefone_whatsapp: { type: "string", description: "Telefone com DDD (ex: 5591991000303)" },
        tipo_atendimento: { type: "string", description: "consulta, retorno, exame ou procedimento" },
        local_atendimento: { type: "string", description: "HGP, Clinicor, IOB ou Vitria" },
        convenio: { type: "string", description: "Bradesco, Unimed, Cassi, SulAmérica ou particular" },
        data_agendamento: { type: "string", description: "Data YYYY-MM-DD" },
        hora_agendamento: { type: "string", description: "Horário HH:MM" },
      },
      required: [
        "nome_completo", "telefone_whatsapp", "tipo_atendimento",
        "local_atendimento", "convenio", "data_agendamento", "hora_agendamento",
      ],
    },
  },
  {
    name: "validar_horario",
    description:
      "Verifica se um horário específico está disponível. Retorna alternativas se indisponível.",
    inputSchema: {
      type: "object",
      properties: {
        data_agendamento: { type: "string", description: "Data YYYY-MM-DD" },
        hora_agendamento: { type: "string", description: "Horário HH:MM" },
        local_atendimento: { type: "string", description: "HGP, Clinicor, IOB ou Vitria" },
      },
      required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
    },
  },
];

// ─── Handlers das tools ─────────────────────
async function handleToolCall(
  name: string,
  args: Record<string, string>
): Promise<{ content: { type: string; text: string }[] }> {
  const supabase = criarClienteSupabase();

  try {
    switch (name) {
      case "listar_horarios_disponiveis": {
        const slots = await listarHorariosDisponiveis(supabase, args.data, args.local);

        if (slots.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                disponivel: false,
                mensagem: `Sem horários para ${args.data}${args.local ? ` no ${args.local}` : ""}. Tente outra data.`,
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
            type: "text",
            text: JSON.stringify({
              disponivel: true,
              data: args.data,
              dia_semana: slots[0].dia_semana,
              total_slots: slots.length,
              por_local: porLocal,
              slots,
            }),
          }],
        };
      }

      case "criar_agendamento": {
        const resultado = await criarAgendamento(supabase, {
          nome_completo: args.nome_completo,
          telefone_whatsapp: args.telefone_whatsapp,
          tipo_atendimento: args.tipo_atendimento,
          local_atendimento: args.local_atendimento,
          convenio: args.convenio,
          data_agendamento: args.data_agendamento,
          hora_agendamento: args.hora_agendamento,
        });
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }

      case "validar_horario": {
        const resultado = await validarDisponibilidade(
          supabase,
          args.data_agendamento,
          args.hora_agendamento,
          args.local_atendimento
        );
        const clinica = resolverClinica(args.local_atendimento);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...resultado,
              data: args.data_agendamento,
              horario: args.hora_agendamento,
              local: clinica?.nome || args.local_atendimento,
            }),
          }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: JSON.stringify({ erro: `Tool "${name}" não encontrada` }) }],
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ erro: (error as Error).message }) }],
    };
  }
}

// ─── CORS headers ───────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// ─── HTTP Server ────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET = health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        name: "dr-juliano-agendamento",
        version: "1.0.0",
        status: "online",
        protocol: "mcp",
        tools: TOOLS.map((t) => t.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST = JSON-RPC
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { method, params, id } = body;

      let result: unknown;

      switch (method) {
        // MCP: initialize
        case "initialize":
          result = {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "dr-juliano-agendamento", version: "1.0.0" },
          };
          break;

        // MCP: list tools
        case "tools/list":
          result = { tools: TOOLS };
          break;

        // MCP: call tool
        case "tools/call": {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};
          result = await handleToolCall(toolName, toolArgs);
          break;
        }

        default:
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Method "${method}" not found` },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }

      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: id || 1, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: (error as Error).message },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
