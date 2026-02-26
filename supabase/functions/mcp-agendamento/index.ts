// ================================================================
// supabase/functions/mcp-agendamento/index.ts
// Versão corrigida — sem @supabase/mcp-utils, compatível com Deno
// ================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ----------------------------------------------------------------
// Helper: chama Edge Function do mesmo projeto
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
    return { raw: text };
  }
}

// ----------------------------------------------------------------
// Definição das tools
// ----------------------------------------------------------------
const TOOLS = [
  {
    name: "listar_horarios_disponiveis",
    description:
      "Lista horários disponíveis para uma data e local, respeitando bloqueios e agendamentos existentes.",
    inputSchema: {
      type: "object",
      properties: {
        data:  { type: "string", description: "Data no formato YYYY-MM-DD" },
        local: { type: "string", description: "Clinicor | HGP | IOB | Vitria" },
      },
      required: ["data", "local"],
    },
  },
  {
    name: "validar_horario",
    description: "Verifica se um horário específico está disponível.",
    inputSchema: {
      type: "object",
      properties: {
        data_agendamento:  { type: "string", description: "YYYY-MM-DD" },
        hora_agendamento:  { type: "string", description: "HH:MM" },
        local_atendimento: { type: "string", description: "Clinicor | HGP | IOB | Vitria" },
      },
      required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
    },
  },
  {
    name: "criar_agendamento",
    description: "Cria agendamento confirmado após validação.",
    inputSchema: {
      type: "object",
      properties: {
        nome_completo:     { type: "string" },
        telefone_whatsapp: { type: "string" },
        tipo_atendimento:  { type: "string" },
        local_atendimento: { type: "string" },
        convenio:          { type: "string" },
        data_agendamento:  { type: "string" },
        hora_agendamento:  { type: "string" },
      },
      required: [
        "nome_completo","telefone_whatsapp","local_atendimento",
        "convenio","data_agendamento","hora_agendamento",
      ],
    },
  },
  {
    name: "listar_datas_disponiveis",
    description:
      "Lista todas as datas de um mês que possuem horários disponíveis, com a quantidade de vagas em cada data.",
    inputSchema: {
      type: "object",
      properties: {
        mes:   { type: "number", description: "Mês (1-12)" },
        ano:   { type: "number", description: "Ano (ex: 2026)" },
        local: { type: "string", description: "Clinicor | HGP | IOB | Vitria (opcional)" },
      },
      required: ["mes", "ano"],
    },
  },
  {
    name: "cancelar_agendamento",
    description:
      "Cancela o próximo agendamento futuro de um paciente pelo telefone ou pelo ID do agendamento.",
    inputSchema: {
      type: "object",
      properties: {
        agendamento_id: { type: "string", description: "UUID do agendamento (opcional se telefone informado)" },
        telefone:       { type: "string", description: "Telefone do paciente (opcional se agendamento_id informado)" },
        motivo:         { type: "string", description: "Motivo do cancelamento (opcional)" },
      },
    },
  },
];

// ----------------------------------------------------------------
// Executa a tool chamada
// ----------------------------------------------------------------
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (name === "listar_horarios_disponiveis") {
    return await callEdgeFunction("listar-horarios-disponiveis", {
      data: args.data,
      local_atendimento: args.local ?? null,
    });
  }

  if (name === "validar_horario") {
    return await callEdgeFunction("validar-agendamento", {
      data_agendamento:  args.data_agendamento,
      hora_agendamento:  args.hora_agendamento,
      local_atendimento: args.local_atendimento,
    });
  }

  if (name === "criar_agendamento") {
    return await callEdgeFunction("criar-agendamento", {
      nome_completo:     args.nome_completo,
      telefone_whatsapp: args.telefone_whatsapp,
      tipo_atendimento:  args.tipo_atendimento ?? "Consulta",
      local_atendimento: args.local_atendimento,
      convenio:          args.convenio,
      data_agendamento:  args.data_agendamento,
      hora_agendamento:  args.hora_agendamento,
      origem:            "mcp",
    });
  }

  if (name === "listar_datas_disponiveis") {
    return await callEdgeFunction("listar-datas-disponiveis", {
      mes: args.mes,
      ano: args.ano,
      local_atendimento: args.local ?? null,
    });
  }

  if (name === "cancelar_agendamento") {
    return await callEdgeFunction("cancelar-agendamento", {
      agendamento_id: args.agendamento_id ?? null,
      telefone: args.telefone ?? null,
      motivo: args.motivo ?? null,
    });
  }

  throw new Error(`Tool desconhecida: ${name}`);
}

// ----------------------------------------------------------------
// Handler MCP sobre HTTP (protocolo JSON-RPC 2.0)
// ----------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const { id, method, params } = body as {
    id: unknown;
    method: string;
    params: Record<string, unknown>;
  };

  // ── notifications/* (SSE ack) ─────────────────────────────
  if (method.startsWith("notifications/")) {
    return sseResponse({ jsonrpc: "2.0", id, result: {} });
  }

  // ── initialize ──────────────────────────────────────────────
  if (method === "initialize") {
    return jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mcp-agendamento", version: "2.0.0" },
    });
  }

  // ── tools/list ───────────────────────────────────────────────
  if (method === "tools/list") {
    return jsonRpcOk(id, { tools: TOOLS });
  }

  // ── tools/call ───────────────────────────────────────────────
  if (method === "tools/call") {
    const toolName = (params?.name ?? "") as string;
    const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

    try {
      const result = await executeTool(toolName, toolArgs);
      return jsonRpcOk(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
      });
    } catch (err) {
      return jsonRpcOk(id, {
        content: [
          {
            type: "text",
            text: `Erro: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      });
    }
  }

  // ── método desconhecido ──────────────────────────────────────
  return jsonRpcError(id, -32601, `Method not found: ${method}`);
});

// ----------------------------------------------------------------
// Helpers JSON-RPC
// ----------------------------------------------------------------
function jsonRpcOk(id: unknown, result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, result }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

function sseResponse(data: unknown): Response {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return new Response(payload, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}