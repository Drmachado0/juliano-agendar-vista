// ================================================================
// supabase/functions/mcp-agendamento/index.ts
// MCP HTTP server p/ agente n8n
// ================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getN8nSharedSecret, timingSafeEqual } from "../_shared/n8nSecret.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const N8N_SHARED_SECRET = Deno.env.get("N8N_SHARED_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Determina status_crm pelo local (espelha lógica de criar-agendamento)
function determineStatusCrmByLocation(local: string): string {
  const l = (local || "").toLowerCase();
  if (l.includes("clinicor")) return "CLINICOR";
  if (l.includes("hgp") || l.includes("hospital geral")) return "HGP";
  if (l.includes("belém") || l.includes("belem") || l.includes("iob") || l.includes("vitria")) return "BELÉM";
  return "NOVO LEAD";
}

// Encontra lead existente SEM data marcada (últimos 8 dígitos do telefone)
async function encontrarLeadSemData(telefone: string) {
  const last8 = (telefone || "").replace(/\D/g, "").slice(-8);
  if (last8.length < 8) return null;
  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("id, telefone_whatsapp, data_agendamento, hora_agendamento, created_at, is_sandbox")
    .order("created_at", { ascending: false })
    .limit(200);
  const candidatos = (data ?? [])
    .filter((a: any) => (a.telefone_whatsapp ?? "").replace(/\D/g, "").endsWith(last8))
    .filter((a: any) => !a.is_sandbox)
    .filter((a: any) => !a.data_agendamento || !a.hora_agendamento);
  return candidatos[0] ?? null;
}

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
      // Repassa o segredo para functions internas que o exigem (ex.: cancelar-agendamento)
      "x-n8n-secret": N8N_SHARED_SECRET,
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
    const telefone = String(args.telefone_whatsapp ?? "").trim();
    const data_agendamento = String(args.data_agendamento ?? "");
    const hora_agendamento = String(args.hora_agendamento ?? "");
    const local_atendimento = String(args.local_atendimento ?? "");
    const nome_completo = String(args.nome_completo ?? "").trim();
    const convenio = String(args.convenio ?? "Particular");
    const tipo_atendimento = String(args.tipo_atendimento ?? "Consulta");

    if (!telefone || !data_agendamento || !hora_agendamento || !local_atendimento || !nome_completo) {
      return { sucesso: false, motivo: "dados_incompletos" };
    }

    // 1) Valida disponibilidade
    const validacao: any = await callEdgeFunction("validar-agendamento", {
      data_agendamento,
      hora_agendamento,
      local_atendimento,
    });
    if (!validacao?.disponivel) {
      return { sucesso: false, motivo: "horario_indisponivel", detalhe: validacao?.motivo ?? null };
    }

    const status_crm = determineStatusCrmByLocation(local_atendimento);
    const status_funil = "agendado";

    // 2) Upsert: se já existe lead sem data, atualiza; senão cria
    const leadExistente = await encontrarLeadSemData(telefone);

    const patch: Record<string, unknown> = {
      nome_completo,
      telefone_whatsapp: telefone,
      tipo_atendimento,
      local_atendimento,
      convenio,
      data_agendamento,
      hora_agendamento,
      status_crm,
      status_funil,
      origem: "mcp",
      updated_at: new Date().toISOString(),
    };

    let agendamentoId: string | null = null;

    if (leadExistente) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from("agendamentos")
        .update(patch)
        .eq("id", leadExistente.id)
        .select("id")
        .single();
      if (updErr) {
        if ((updErr as any).code === "23505") {
          return { sucesso: false, motivo: "horario_indisponivel" };
        }
        console.error("[mcp criar_agendamento] update err:", updErr);
        return { sucesso: false, motivo: "erro_interno" };
      }
      agendamentoId = upd?.id ?? leadExistente.id;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("agendamentos")
        .insert([patch])
        .select("id")
        .single();
      if (insErr) {
        if ((insErr as any).code === "23505") {
          return { sucesso: false, motivo: "horario_indisponivel" };
        }
        console.error("[mcp criar_agendamento] insert err:", insErr);
        return { sucesso: false, motivo: "erro_interno" };
      }
      agendamentoId = ins?.id ?? null;
    }

    // 3) Notificações best-effort (não bloqueia resposta ao agente)
    const notifs = [
      supabaseAdmin.functions.invoke("confirmar-agendamento-whatsapp", {
        body: {
          agendamento_data: {
            nome_completo,
            telefone_whatsapp: telefone,
            tipo_atendimento,
            local_atendimento,
            data_agendamento,
            hora_agendamento,
            convenio,
          },
        },
      }),
      supabaseAdmin.functions.invoke("notificar-n8n", {
        body: {
          evento: "agendamento_criado",
          dados_agendamento: {
            id: agendamentoId,
            nome_completo,
            telefone_whatsapp: telefone,
            tipo_atendimento,
            local_atendimento,
            convenio,
            data_agendamento,
            hora_agendamento,
            status_crm,
            origem: "mcp",
          },
        },
      }),
    ];
    Promise.allSettled(notifs).catch(() => {});

    return {
      sucesso: true,
      status: "confirmado",
      agendamento_id: agendamentoId,
      paciente: nome_completo,
      data: data_agendamento,
      hora: hora_agendamento,
      local: local_atendimento,
      convenio,
      tipo_atendimento,
    };
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, apikey, x-api-key, x-n8n-secret, x-mcp-secret",
      },
    });
  }

  // GET → health check público (sem segredo). Útil para debug/monitoramento.
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        success: true,
        service: "mcp-agendamento",
        protocol: "jsonrpc-2.0",
        transport: "http",
        auth_headers_accepted: [
          "x-n8n-secret: <N8N_SHARED_SECRET>",
          "x-mcp-secret: <N8N_SHARED_SECRET>",
          "x-api-key: <N8N_SHARED_SECRET>",
          "apikey: <N8N_SHARED_SECRET>",
          "Authorization: Bearer <N8N_SHARED_SECRET>",
        ],
        configured: !!N8N_SHARED_SECRET,
        tools: TOOLS.map((t) => t.name),
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Autenticação por segredo compartilhado. Aceita múltiplos headers para
  // acomodar diferentes formas do n8n enviar (Header Auth, Generic Credentials, MCP tool).
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const provided =
    req.headers.get("x-n8n-secret") ||
    req.headers.get("x-mcp-secret") ||
    req.headers.get("x-api-key") ||
    req.headers.get("apikey") ||
    bearer ||
    "";

  const okAuth =
    !!N8N_SHARED_SECRET &&
    !!provided &&
    provided === N8N_SHARED_SECRET;

  if (!okAuth) {
    console.warn("[mcp-agendamento] Unauthorized: secret ausente ou inválido", {
      has_secret_env: !!N8N_SHARED_SECRET,
      received_headers: {
        "x-n8n-secret": !!req.headers.get("x-n8n-secret"),
        "x-mcp-secret": !!req.headers.get("x-mcp-secret"),
        "x-api-key": !!req.headers.get("x-api-key"),
        apikey: !!req.headers.get("apikey"),
        authorization_bearer: !!bearer,
      },
    });
    return jsonRpcError(
      null,
      -32001,
      "Unauthorized: envie N8N_SHARED_SECRET em um dos headers (x-n8n-secret, x-mcp-secret, x-api-key, apikey, Authorization: Bearer).",
    );
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