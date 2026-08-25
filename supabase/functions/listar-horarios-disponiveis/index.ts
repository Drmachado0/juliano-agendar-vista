// ============================================================================
// listar-horarios-disponiveis
//
// Camada HTTP fina. TODA a regra de negócio vive em _shared/agenda.ts — este
// arquivo só faz auth, parse, log e serialização.
//
// Atende DOIS contratos no mesmo endpoint:
//
//   • NOVO (REST, chamado direto pelo n8n): request com unidade /
//     tipo_atendimento / limite_opcoes. Devolve no máximo limite_opcoes
//     horários, preferindo não-consecutivos, mais a mensagem_pronta.
//
//   • LEGADO (data/local_atendimento): é o que o mcp-agendamento chama hoje
//     (index.ts:340). Devolve horarios_disponiveis com TODOS os slots livres.
//     A resposta precisa continuar idêntica.
//
// A distinção é por chave presente no corpo e os dois conjuntos são
// disjuntos, então não há ambiguidade.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";
import {
  buscarHorariosDisponiveis,
  buscarHorariosLegado,
  TIPOS_ATENDIMENTO,
} from "../_shared/agenda.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Chaves exclusivas do contrato novo. Nenhuma existe no corpo legado. */
const CHAVES_CONTRATO_NOVO = [
  "unidade",
  "tipo_atendimento",
  "limite_opcoes",
  "telefone_whatsapp",
  "agendamento_id",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const guard = await requireN8nSecret(req);
  if (!guard.ok) return unauthorizedResponse(guard.reason ?? "unauthorized", corsHeaders);
  const rid = requestId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const usaContratoNovo = CHAVES_CONTRATO_NOVO.some((k) => k in (body ?? {}));

    // ---------------------- CONTRATO LEGADO (mcp-agendamento) --------------
    if (!usaContratoNovo) {
      const r = await buscarHorariosLegado(supabase, body ?? {}, rid);
      console.log(
        `[listar-horarios ${rid}] legado data="${body?.data ?? ""}" ` +
          `local="${body?.local_atendimento ?? ""}" status=${r.status}`,
      );
      return json(r.body, r.status);
    }

    // ---------------------- CONTRATO NOVO (REST/n8n) -----------------------
    const r = await buscarHorariosDisponiveis(supabase, {
      data: body?.data ?? null,
      unidade: body?.unidade ?? null,
      tipo_atendimento: body?.tipo_atendimento ?? null,
      limite_opcoes: body?.limite_opcoes ?? null,
    });

    console.log(
      `[listar-horarios ${rid}] novo data="${body?.data ?? ""}" unidade_req="${body?.unidade ?? ""}" ` +
        `tipo="${body?.tipo_atendimento ?? ""}" opcoes=${r.opcoes.length} ` +
        `motivo=${r.motivo ?? "ok"} tel=${maskTelefone(body?.telefone_whatsapp)}`,
    );

    // Request malformado (data/unidade ausente ou inválida) é 400. Falha de
    // infraestrutura é 500. Data válida sem vaga é 200 com sem_disponibilidade.
    if (!r.sucesso) {
      return json(
        {
          sucesso: false,
          data: r.data,
          data_br: r.data_br,
          unidade: r.unidade,
          opcoes: [],
          sem_disponibilidade: true,
          mensagem_pronta: null,
          motivo: r.motivo ?? "erro_interno",
          erro: r.erro ?? null,
          tipos_aceitos: TIPOS_ATENDIMENTO,
          request_id: rid,
        },
        r.motivo === "erro_interno" ? 500 : 400,
      );
    }

    return json({
      sucesso: true,
      data: r.data,
      data_br: r.data_br,
      unidade: r.unidade,
      opcoes: r.opcoes,
      sem_disponibilidade: r.sem_disponibilidade,
      mensagem_pronta: r.mensagem_pronta,
      // Presente só quando a data existe mas não rendeu horário (bloqueio,
      // agenda fechada, tudo ocupado). Ajuda o agente a explicar ao paciente.
      ...(r.motivo ? { motivo: r.motivo } : {}),
      request_id: rid,
    });
  } catch (err) {
    console.error(`[listar-horarios ${rid}] erro:`, (err as Error)?.message);
    return json({ error: "internal_error", request_id: rid }, 500);
  }
});
