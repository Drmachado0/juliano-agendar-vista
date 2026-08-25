// ============================================================================
// listar-datas-disponiveis
//
// Camada HTTP fina. TODA a regra de negócio vive em _shared/agenda.ts — este
// arquivo só faz auth, parse, log e serialização.
//
// Atende DOIS contratos no mesmo endpoint:
//
//   • NOVO (REST, chamado direto pelo n8n): request com tipo_atendimento /
//     unidade / limite_opcoes / mes_inicial. Aplica unidade travada, só datas
//     estritamente futuras, busca progressiva e devolve mensagem_pronta.
//
//   • LEGADO (mes/ano/local_atendimento): é o que o mcp-agendamento chama
//     hoje (index.ts:356) e o que o agente em produção já consome. A resposta
//     precisa continuar idêntica — não altere sem alterar o agente.
//
// A distinção é por chave presente no corpo e os dois conjuntos são
// disjuntos, então não há ambiguidade.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireN8nSecret, unauthorizedResponse, requestId } from "../_shared/authGuards.ts";
import { maskTelefone } from "../_shared/telefoneCanonico.ts";
import {
  buscarDatasDisponiveis,
  buscarDatasLegado,
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
  "tipo_atendimento",
  "unidade",
  "limite_opcoes",
  "mes_inicial",
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
      const r = await buscarDatasLegado(supabase, body ?? {}, rid);
      console.log(
        `[listar-datas ${rid}] legado local="${body?.local_atendimento ?? ""}" status=${r.status}`,
      );
      return json(r.body, r.status);
    }

    // ---------------------- CONTRATO NOVO (REST/n8n) -----------------------
    const tipoRaw = body?.tipo_atendimento ?? null;
    const r = await buscarDatasDisponiveis(supabase, {
      tipo_atendimento: tipoRaw,
      unidade: body?.unidade ?? null,
      mes_inicial: body?.mes_inicial ?? null,
      limite_opcoes: body?.limite_opcoes ?? null,
    });

    console.log(
      `[listar-datas ${rid}] novo tipo="${tipoRaw ?? ""}" unidade_req="${body?.unidade ?? ""}" ` +
        `travada=${r.unidade_travada ?? "-"} opcoes=${r.opcoes.length} total=${r.total_encontradas} ` +
        `meses=${r.meses_pesquisados} tel=${maskTelefone(body?.telefone_whatsapp)}`,
    );

    if (!r.sucesso) {
      return json({ sucesso: false, erro: r.erro ?? "erro_interno", request_id: rid }, 500);
    }

    return json({
      sucesso: true,
      unidade_travada: r.unidade_travada,
      opcoes: r.opcoes,
      total_encontradas: r.total_encontradas,
      meses_pesquisados: r.meses_pesquisados,
      sem_disponibilidade: r.sem_disponibilidade,
      mensagem_pronta: r.mensagem_pronta,
      // Eco do vocabulário aceito, para o agente não inventar tipo.
      tipos_aceitos: TIPOS_ATENDIMENTO,
      request_id: rid,
    });
  } catch (err) {
    console.error(`[listar-datas ${rid}] erro:`, (err as Error)?.message);
    return json({ error: "internal_error", request_id: rid }, 500);
  }
});
