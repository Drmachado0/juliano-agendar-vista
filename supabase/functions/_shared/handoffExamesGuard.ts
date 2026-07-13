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
    | "exame_avaliacao_hgp"
    | null;
  hits: string[];        // termos que casaram (para debug/log, sem PII)
  matchedInHistory: boolean;
};

export interface MensagemHistoricoLike {
  id?: string | null;
  direcao: "IN" | "OUT" | string;
  conteudo: string | null | undefined;
  /** ISO string ou Date. Se ausente, a mensagem é ignorada quando `now` também vier. */
  created_at?: string | Date | null;
}

/** Opções para restringir o exame de histórico. */
export interface DetectarExamesOpts {
  /** Instante da mensagem atual (default: Date.now()). */
  now?: Date | number;
  /** Id da mensagem atual — exclui do histórico. */
  currentMessageId?: string | null;
  /** created_at da mensagem atual — só olha mensagens ANTERIORES a este. */
  currentCreatedAt?: string | Date | null;
  /** Janela em minutos para considerar histórico "recente". Default: 45. */
  janelaMinutos?: number;
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
  /\blaud[oa]\b/,          // laudo em contexto oftalmo indica exame

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

// ---------------------------------------------------------------------------
// Continuação contextual: quando a mensagem ATUAL não menciona exames, só
// deixamos o handoff herdar do histórico se a mensagem for uma continuação
// curta/dependente do contexto anterior (ex.: "já fiz a consulta",
// "é no HGP", "e pelo plano?", "sim", "onde faço?").
// ---------------------------------------------------------------------------

// Respostas ultra-curtas afirmativas/negativas ou reconhecimentos.
const RE_CONTINUACAO_CURTA = /^(sim|nao|s|n|ok|okay|okey|certo|beleza|entendi|obrigad[oa]|valeu|claro|aham|uhum|isso|ta|tudo bem|blz)[.!?]?$/;

// Frases dependentes de contexto anterior.
const RE_CONTINUACAO_LONGA = [
  /\bja fiz\b/,
  /\bja tenho\b/,
  /\bja est(a|ao)\b/,
  /\bja marc(ou|ei|amos|aram|ado|ada)\b/,
  /\bja agend(ei|ou|amos|aram|ado|ada)\b/,
  /\b(no|na|pelo|pela) (hgp|clinicor|iob|vitria|hospital)\b/,
  /\be (no|na|pelo|pela|do|da|em|com|pra|para) /,
  /\be (agora|ai|entao|isso|sobre)\b/,
  /\bpelo (plano|convenio)\b/,
  /\b(prefiro|prefere)\b/,
  /\b(como|onde|quando|quanto) (faco|faz|fica|sera|e|custa|posso|devo)\b/,
  /\bpra (confirmar|marcar|agendar|saber)\b/,
  /\bposso (ir|levar|marcar|agendar)\b/,
  /\bfico no aguardo\b/,
  /\bquando (estiver|ficar) pronto\b/,
];

/** Uma mensagem é "continuação" do contexto anterior? */
export function isMensagemContinuacao(textoRaw: string | null | undefined): boolean {
  const t = normalizarTexto(textoRaw);
  if (!t) return false;
  if (RE_CONTINUACAO_CURTA.test(t)) return true;
  const nWords = t.split(" ").length;
  if (nWords <= 6 && RE_CONTINUACAO_LONGA.some((r) => r.test(t))) return true;
  return RE_CONTINUACAO_LONGA.some((r) => r.test(t)) && nWords <= 10;
}

function toMs(v: string | Date | number | null | undefined): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/**
 * Detecta assunto de exames considerando a última mensagem + histórico
 * recente de mensagens IN.
 *
 * Regras (endurecidas em 2026-07-13):
 * - Só olha mensagens IN diferentes da atual (por id ou created_at).
 * - Só olha mensagens dentro de `janelaMinutos` (default 45) antes de `now`.
 * - Só herda handoff via histórico quando a mensagem ATUAL é uma
 *   "continuação" (ver isMensagemContinuacao). Uma mensagem nova e
 *   independente como "quero agendar uma consulta" NÃO herda handoff antigo.
 */
export function detectarAssuntoExames(
  mensagemAtual: string,
  historico: MensagemHistoricoLike[] = [],
  opts: DetectarExamesOpts = {},
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

  // Só considera histórico se a mensagem atual for continuação contextual.
  if (!isMensagemContinuacao(mensagemAtual)) {
    return { matched: false, reason: null, hits: [], matchedInHistory: false };
  }

  const nowMs = toMs(opts.now ?? Date.now()) ?? Date.now();
  const currentMs = toMs(opts.currentCreatedAt ?? null);
  const janelaMs = Math.max(1, opts.janelaMinutos ?? 45) * 60_000;
  const currentId = opts.currentMessageId ?? null;

  const filtradas = historico.filter((m) => {
    if ((m.direcao ?? "").toUpperCase() !== "IN") return false;
    if (currentId && m.id && m.id === currentId) return false;
    const t = toMs(m.created_at ?? null);
    if (t == null) return false;                       // sem timestamp = ignora
    if (currentMs != null && t >= currentMs) return false;
    if (nowMs - t > janelaMs) return false;            // fora da janela
    return true;
  });

  const recentesIn = filtradas
    .slice(-5)
    .map((m) => m.conteudo || "")
    .filter((c) => c.length > 0)
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
