// ============================================================================
// handoffExamesGuard.ts
// Guard determinístico: qualquer mensagem/contexto envolvendo EXAMES deve
// interromper o bot e encaminhar para humano ANTES de qualquer LLM.
//
// Regras:
// - Detecta pedido/solicitação/guia/agendamento/local/autorização/cobertura/
//   resultado/laudo/retorno-com-exames/exame-agendado/dúvida ou valor de exame.
// - Considera concatenação de mensagens recentes (últimas IN).
// - Evita falso positivo: "exame de consciência", "exame nacional",
//   pergunta genérica de convênio SEM mencionar exame.
//
// Puro TS — sem dependência de Deno/Supabase — para ser testável e reusável
// em edge functions e no CRM se necessário.
// ============================================================================

export type ExamesDetectResult = {
  matched: boolean;
  reason:
    | "assunto_exames"
    | null;
  hits: string[];        // termos que casaram (para debug/log, sem PII)
  matchedInHistory: boolean;
};

export interface MensagemHistoricoLike {
  direcao: "IN" | "OUT" | string;
  conteudo: string | null | undefined;
}

/** Normaliza para minúsculas, sem acentos e com espaços colapsados. */
export function normalizarTexto(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------
// Léxico
// -----------------------------

// Termos "exame(s)" com variantes. \b para evitar prefixos.
const RE_EXAME =
  /\b(exame|exames|exam|examinar|examinacao|examina[cç]ao)\b/;

// Falsos positivos conhecidos com "exame"
const RE_FALSO_POSITIVO_EXAME = [
  /\bexame de consciencia\b/,
  /\bexame nacional\b/,
  /\bexame da oab\b/,
  /\bexame de dna\b/,
];

// Sinais fortes que já indicam assunto de exames MESMO sem a palavra "exame"
// (contexto oftalmológico). Ex.: "oct", "mapeamento de retina", "campo visual",
// "topografia", "paquimetria", "biometria", "retinografia", "angiografia",
// "fundoscopia", "ecobiometria".
const EXAMES_OFTALMO = [
  /\boct\b/,
  /\bmapeamento(?: de)? retina\b/,
  /\bcampo visual\b/,
  /\btopografia\b/,
  /\bpaquimetria\b/,
  /\bbiometria\b/,
  /\bretinografia\b/,
  /\bangiografia\b/,
  /\bfundoscopia\b/,
  /\becobiometria\b/,
  /\btonometria\b/,
];

// Termos que combinados com "exame(s)" indicam assunto de exames.
// Se aparecer QUALQUER um dos abaixo E a palavra "exame", ativa handoff.
// Também ativa se aparecerem em conjunto com termos oftalmo (independente).
const CONTEXTO_EXAME = [
  /\bguia\b/,
  /\bpedid[oa]\b/,
  /\bsolicitacao\b/,
  /\bsolicit(ar|ei|ou|ada|ado)\b/,
  /\bagendar\b/,
  /\bagendad[oa]\b/,
  /\bagendamento\b/,
  /\bmarcar\b/,
  /\bmarcad[oa]\b/,
  /\bremarcar\b/,
  /\bautoriza(cao|r|ram|do|da)\b/,
  /\bcobertura\b/,
  /\bcobre\b/,
  /\bplano\b/,
  /\bconvenio\b/,
  /\bresultad[oa]\b/,
  /\blaud[oa]\b/,
  /\bretorno\b/,
  /\bfazer\b/,
  /\brealizar\b/,
  /\brealiza(cao|do|da)\b/,
  /\bonde\b/,
  /\blocal\b/,
  /\bvalor\b/,
  /\bpreco\b/,
  /\bcusto\b/,
  /\bquanto\b/,
  /\bduvida\b/,
];

function primeiroMatch(regexes: RegExp[], texto: string): string | null {
  for (const r of regexes) {
    const m = texto.match(r);
    if (m) return m[0];
  }
  return null;
}

/**
 * Detecta assunto de exames em um único texto normalizado.
 * Regras de decisão:
 *   1) Se casar termo oftalmológico específico -> handoff.
 *   2) Se casar "exame(s)" e NÃO for falso positivo, considera match SE:
 *      - houver contexto (guia, plano, valor, agendar, local, autorização,
 *        cobertura, resultado, laudo, dúvida, fazer, realizar, retorno...),
 *      - ou o texto tiver menos de ~12 palavras (mensagem curta focada
 *        no assunto), o que também cobre "e os exames?" isolado.
 */
export function detectarAssuntoExamesTexto(textoRaw: string | null | undefined): {
  matched: boolean;
  hits: string[];
} {
  const texto = normalizarTexto(textoRaw);
  if (!texto) return { matched: false, hits: [] };

  const hits: string[] = [];

  const oftalmoHit = primeiroMatch(EXAMES_OFTALMO, texto);
  if (oftalmoHit) hits.push(oftalmoHit);

  const temExame = RE_EXAME.test(texto);
  const falsoPositivo = temExame && RE_FALSO_POSITIVO_EXAME.some((r) => r.test(texto));

  if (temExame && !falsoPositivo) {
    const ctxHit = primeiroMatch(CONTEXTO_EXAME, texto);
    if (ctxHit) hits.push(`exame+${ctxHit}`);
    else {
      const nWords = texto.split(" ").length;
      if (nWords <= 12) hits.push("exame(curto)");
    }
  }

  return { matched: hits.length > 0, hits };
}

/**
 * Detecta assunto de exames considerando a última mensagem + histórico
 * recente de mensagens IN concatenadas (regra: "já fiz a consulta" depois
 * de mencionar exames ainda cai em exames).
 */
export function detectarAssuntoExames(
  mensagemAtual: string,
  historico: MensagemHistoricoLike[] = [],
): ExamesDetectResult {
  const atual = detectarAssuntoExamesTexto(mensagemAtual);
  if (atual.matched) {
    return {
      matched: true,
      reason: "assunto_exames",
      hits: atual.hits,
      matchedInHistory: false,
    };
  }

  // Concatena até as 5 últimas mensagens IN recentes para pegar contexto.
  const recentesIn = historico
    .filter((m) => (m.direcao ?? "").toUpperCase() === "IN")
    .slice(-5)
    .map((m) => m.conteudo || "")
    .join(" \n ");

  if (recentesIn) {
    const contexto = detectarAssuntoExamesTexto(recentesIn);
    if (contexto.matched) {
      return {
        matched: true,
        reason: "assunto_exames",
        hits: contexto.hits,
        matchedInHistory: true,
      };
    }
  }

  return { matched: false, reason: null, hits: [], matchedInHistory: false };
}

// -----------------------------
// Resposta / notificação
// -----------------------------

export const HANDOFF_EXAMES_REPLY =
  "Entendi. Como sua mensagem envolve exames, encaminhei o atendimento para nossa equipe responsável. Eles vão analisar seu caso e continuar por aqui.";

export const HANDOFF_NOTIFICATION_PHONE = "5591991300174";

export interface HandoffSummaryInput {
  nome?: string | null;
  telefoneMascarado: string;
  mensagemAtual: string;
  hits: string[];
  matchedInHistory: boolean;
  agendamentoId?: string | null;
  statusCrm?: string | null;
  statusFunil?: string | null;
  localAtendimento?: string | null;
}

export function buildHandoffExamesSummary(input: HandoffSummaryInput): string {
  const nome = (input.nome || "").trim();
  const nomeTxt = nome ? nome : "Paciente sem nome cadastrado";
  const trecho = (input.mensagemAtual || "").trim().slice(0, 240);
  const linhas: string[] = [
    `Handoff automático — assunto: EXAMES`,
    `Paciente: ${nomeTxt} (${input.telefoneMascarado})`,
    `Última mensagem: "${trecho}"`,
  ];
  if (input.matchedInHistory) {
    linhas.push(`Detecção via histórico recente (mensagens IN anteriores).`);
  }
  if (input.hits.length > 0) {
    linhas.push(`Sinais: ${input.hits.join(", ")}`);
  }
  if (input.agendamentoId) {
    const ctx = [
      `id=${input.agendamentoId}`,
      input.statusCrm ? `status_crm=${input.statusCrm}` : null,
      input.statusFunil ? `status_funil=${input.statusFunil}` : null,
      input.localAtendimento ? `local=${input.localAtendimento}` : null,
    ].filter(Boolean).join(" · ");
    linhas.push(`Contexto agendamento: ${ctx}`);
  } else {
    linhas.push(`Contexto agendamento: (sem agendamento vinculado)`);
  }
  return linhas.join("\n");
}
