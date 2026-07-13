// ================================================================
// supabase/functions/mcp-agendamento/index.ts
// MCP HTTP server para agente n8n. rev-3 (2026-07-13) — fail-closed:
//   • criar_agendamento exige agendamento_id UUID.
//   • Match por telefone somente via telefone_canonico EXATO.
//   • clinica_id resolvido da fonte canônica (validarDisponibilidade.ts).
//   • Notificações aguardadas com Promise.allSettled (sem PII em logs).
//   • GET público = health check mínimo.
// ================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getN8nSharedSecret, timingSafeEqual } from "../_shared/n8nSecret.ts";
import { assertNomePacienteValido } from "../_shared/sanitizeOptionalFields.ts";
import { telefoneCanonico, maskTelefone } from "../_shared/telefoneCanonico.ts";
import { resolverClinica } from "../_shared/validarDisponibilidade.ts";
import { isCrmTerminal, isFunilTerminal } from "../_shared/statusTerminais.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const N8N_SHARED_SECRET = Deno.env.get("N8N_SHARED_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function determineStatusCrmByLocation(local: string): string {
  const l = (local || "").toLowerCase();
  if (l.includes("clinicor")) return "CLINICOR";
  if (l.includes("hgp") || l.includes("hospital geral")) return "HGP";
  if (l.includes("belém") || l.includes("belem") || l.includes("iob") || l.includes("vitria")) return "BELÉM";
  return "NOVO LEAD";
}

async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
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

const TOOLS = [
  {
    name: "listar_horarios_disponiveis",
    description:
      "Lista horários disponíveis para uma data e local, respeitando bloqueios e agendamentos existentes.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato YYYY-MM-DD" },
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
        data_agendamento: { type: "string", description: "YYYY-MM-DD" },
        hora_agendamento: { type: "string", description: "HH:MM" },
        local_atendimento: { type: "string", description: "Clinicor | HGP | IOB | Vitria" },
      },
      required: ["data_agendamento", "hora_agendamento", "local_atendimento"],
    },
  },
  {
    name: "criar_agendamento",
    description:
      "Confirma um agendamento em um card EXISTENTE. Requer agendamento_id (UUID do card do lead). Nunca cria novo card por telefone.",
    inputSchema: {
      type: "object",
      properties: {
        agendamento_id:    { type: "string", description: "UUID do card do lead (obrigatório)" },
        nome_completo:     { type: "string" },
        telefone_whatsapp: { type: "string" },
        tipo_atendimento:  { type: "string" },
        local_atendimento: { type: "string" },
        convenio:          { type: "string" },
        data_agendamento:  { type: "string" },
        hora_agendamento:  { type: "string" },
      },
      required: [
        "agendamento_id", "nome_completo", "telefone_whatsapp",
        "local_atendimento", "convenio", "data_agendamento", "hora_agendamento",
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
        mes: { type: "number", description: "Mês (1-12)" },
        ano: { type: "number", description: "Ano (ex: 2026)" },
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

async function executarCriarAgendamento(
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const agendamentoIdRaw = String(args.agendamento_id ?? "").trim();
  if (!agendamentoIdRaw || !UUID_RE.test(agendamentoIdRaw)) {
    return {
      sucesso: false,
      motivo: "agendamento_id_obrigatorio",
      detalhe: "Informe o UUID do card do lead (agendamento_id). Não é permitido criar card novo por telefone nesta tool.",
    };
  }
  const agendamento_id = agendamentoIdRaw;

  const telefoneRaw = String(args.telefone_whatsapp ?? "").trim();
  const data_agendamento = String(args.data_agendamento ?? "");
  const hora_agendamento = String(args.hora_agendamento ?? "");
  const local_atendimento_raw = String(args.local_atendimento ?? "");
  const nomeRaw = args.nome_completo;
  const convenio = String(args.convenio ?? "Particular");
  const tipo_atendimento = String(args.tipo_atendimento ?? "Consulta");

  const nomeCheck = assertNomePacienteValido(nomeRaw);
  if (!nomeCheck.ok) {
    console.warn("[mcp criar_agendamento] nome_paciente_invalido", {
      motivo: nomeCheck.motivo,
      telefone_mask: maskTelefone(telefoneRaw),
      agendamento_id,
    });
    return {
      sucesso: false,
      motivo: "nome_paciente_invalido",
      detalhe: nomeCheck.motivo,
      acao_sugerida: "Pergunte o nome completo do paciente antes de confirmar.",
    };
  }
  const nome_completo = nomeCheck.nome!;

  if (!telefoneRaw || !data_agendamento || !hora_agendamento || !local_atendimento_raw) {
    return { sucesso: false, motivo: "dados_incompletos" };
  }

  // Fonte canônica de clínica (fail-closed).
  const clinica = resolverClinica(local_atendimento_raw);
  if (!clinica) {
    return {
      sucesso: false,
      motivo: "clinica_desconhecida",
      detalhe: "Use um dos locais canônicos: Clinicor, HGP, IOB, Vitria.",
    };
  }

  const telCanonInput = telefoneCanonico(telefoneRaw);
  if (!telCanonInput) {
    return { sucesso: false, motivo: "telefone_invalido" };
  }

  // Carrega o card EXATAMENTE por id.
  const { data: card, error: cardErr } = await supabaseAdmin
    .from("agendamentos")
    .select("id, telefone_whatsapp, telefone_canonico, is_sandbox, status_crm, status_funil")
    .eq("id", agendamento_id)
    .maybeSingle();

  if (cardErr) {
    console.error("[mcp criar_agendamento] load err", { code: (cardErr as any).code });
    return { sucesso: false, motivo: "erro_interno" };
  }
  if (!card) {
    return { sucesso: false, motivo: "agendamento_nao_encontrado" };
  }
  if (card.is_sandbox === true) {
    return { sucesso: false, motivo: "card_sandbox" };
  }
  if (isCrmTerminal(card.status_crm) || isFunilTerminal(card.status_funil)) {
    return {
      sucesso: false,
      motivo: "card_terminal",
      detalhe: `status_crm=${card.status_crm ?? ""} status_funil=${card.status_funil ?? ""}`,
    };
  }

  const telCanonCard = card.telefone_canonico ?? telefoneCanonico(card.telefone_whatsapp);
  if (!telCanonCard || telCanonCard !== telCanonInput) {
    console.warn("[mcp criar_agendamento] risco_paciente_errado", {
      agendamento_id,
      tel_card: maskTelefone(card.telefone_whatsapp),
      tel_input: maskTelefone(telefoneRaw),
    });
    return {
      sucesso: false,
      motivo: "risco_paciente_errado",
      detalhe: "Telefone informado não confere com o card. Nenhuma alteração feita.",
    };
  }

  // Validação de disponibilidade
  const validacao: any = await callEdgeFunction("validar-agendamento", {
    data_agendamento,
    hora_agendamento,
    local_atendimento: clinica.nome,
    excluir_agendamento_id: agendamento_id,
  });
  if (!validacao?.disponivel) {
    return { sucesso: false, motivo: "horario_indisponivel", detalhe: validacao?.motivo ?? null };
  }

  const status_crm = determineStatusCrmByLocation(clinica.nome);
  const patch: Record<string, unknown> = {
    nome_completo,
    telefone_whatsapp: telefoneRaw,
    tipo_atendimento,
    local_atendimento: clinica.nome,
    clinica_id: clinica.id,
    convenio,
    data_agendamento,
    hora_agendamento,
    status_crm,
    status_funil: "agendado",
    origem: "mcp",
    updated_at: new Date().toISOString(),
  };

  const { data: upd, error: updErr } = await supabaseAdmin
    .from("agendamentos")
    .update(patch)
    .eq("id", agendamento_id)
    .select("id")
    .single();

  if (updErr) {
    if ((updErr as any).code === "23505") {
      // última defesa contra corrida
      return { sucesso: false, motivo: "horario_indisponivel" };
    }
    console.error("[mcp criar_agendamento] update err", { code: (updErr as any).code });
    return { sucesso: false, motivo: "erro_interno" };
  }
  const agendamentoId = upd?.id ?? agendamento_id;

  // Notificações — aguardadas para reportar sucesso/falha ao agente.
  const results = await Promise.allSettled([
    supabaseAdmin.functions.invoke("confirmar-agendamento-whatsapp", {
      body: {
        agendamento_data: {
          nome_completo,
          telefone_whatsapp: telefoneRaw,
          tipo_atendimento,
          local_atendimento: clinica.nome,
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
          telefone_whatsapp: telefoneRaw,
          tipo_atendimento,
          local_atendimento: clinica.nome,
          convenio,
          data_agendamento,
          hora_agendamento,
          status_crm,
          origem: "mcp",
        },
      },
    }),
  ]);

  const notificacoes_ok = results.every((r) => r.status === "fulfilled");
  if (!notificacoes_ok) {
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn("[mcp criar_agendamento] notificacao_falhou", {
          agendamento_id: agendamentoId,
          reason_code: (r.reason as any)?.name ?? "unknown",
        });
      }
    }
  }

  return {
    sucesso: true,
    status: "confirmado",
    agendamento_id: agendamentoId,
    paciente: nome_completo,
    data: data_agendamento,
    hora: hora_agendamento,
    local: clinica.nome,
    clinica_id: clinica.id,
    convenio,
    tipo_atendimento,
    notificacoes_ok,
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name === "listar_horarios_disponiveis") {
    return await callEdgeFunction("listar-horarios-disponiveis", {
      data: args.data,
      local_atendimento: args.local ?? null,
    });
  }
  if (name === "validar_horario") {
    return await callEdgeFunction("validar-agendamento", {
      data_agendamento: args.data_agendamento,
      hora_agendamento: args.hora_agendamento,
      local_atendimento: args.local_atendimento,
    });
  }
  if (name === "criar_agendamento") {
    return await executarCriarAgendamento(args);
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

// Exports para testes unitários
export { executarCriarAgendamento, executeTool, TOOLS, UUID_RE };

Deno.serve(async (req: Request) => {
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

  // GET → health check mínimo (sem vazar configuração/tools/headers).
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ success: true, service: "mcp-agendamento" }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

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

  const expected = await getN8nSharedSecret();
  const okAuth = !!expected && !!provided && timingSafeEqual(provided, expected);

  if (!okAuth) {
    console.warn("[mcp-agendamento] Unauthorized");
    return jsonRpcError(null, -32001, "Unauthorized");
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

  if (method.startsWith("notifications/")) {
    return sseResponse({ jsonrpc: "2.0", id, result: {} });
  }
  if (method === "initialize") {
    return jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mcp-agendamento", version: "3.0.0" },
    });
  }
  if (method === "tools/list") {
    return jsonRpcOk(id, { tools: TOOLS });
  }
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

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
});

function jsonRpcOk(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
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
    },
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
