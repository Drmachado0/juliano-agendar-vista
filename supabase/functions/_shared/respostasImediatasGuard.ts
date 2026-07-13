// ============================================================================
// respostasImediatasGuard.ts
// Guards determinísticos que respondem ANTES da IA. Retornam texto fixo
// para o paciente e não desviam a coleta em curso.
//
// Escopo atual:
//   - Valor da CONSULTA particular = R$ 300,00.
//
// NÃO cobre valor de cirurgia (que exige avaliação) nem exames
// (que caem em handoff humano — ver handoffExamesGuard.ts).
// ============================================================================

import { normalizarTexto } from "./handoffExamesGuard.ts";

export const VALOR_CONSULTA_TEXTO = "R$ 300,00";
export const VALOR_CONSULTA_REPLY = `A consulta particular com o Dr. Juliano Machado custa ${VALOR_CONSULTA_TEXTO}.`;

// Termos que indicam CIRURGIA (excluir da detecção de valor de consulta)
const RE_CIRURGIA = /\b(cirurgia|catarata|pterigio|lente(s)?|facect|yag|refrativa|lasik|prk)\b/;
// Termos que indicam EXAME (também excluir — handoff cobre)
const RE_EXAME_STRICT = /\b(exame|exames|oct|mapeamento|campo visual|topografia|paquimetria|biometria|retinografia|angiografia|fundoscopia)\b/;

// Sinais de pergunta sobre preço
const RE_PRECO = /\b(valor|preco|custa|custo|quanto|quanto\s+e|quanto\s+fica|quanto\s+custa|honorarios?|quanto\s+sai)\b/;

// Sinal de que se refere à CONSULTA/AVALIAÇÃO/ATENDIMENTO particular
const RE_CONSULTA = /\b(consulta|avaliacao|atendimento|primeira consulta|primeira vez)\b/;

// Pergunta genérica: "qual o valor?", "quanto é?" — assumimos consulta se
// não houver contexto de cirurgia/exame.
const RE_PERGUNTA_GENERICA_PRECO =
  /^(qual|quanto|quanto\s+e|quanto\s+custa|quanto\s+fica|quanto\s+sai|qual\s+o\s+valor|qual\s+e\s+o\s+valor|valor\s*\?|preco\s*\?)/;

export type RespostaImediataResult =
  | {
      matched: true;
      reason: "valor_consulta";
      reply: string;
    }
  | { matched: false; reason: null; reply: null };

export function detectarValorConsulta(textoRaw: string | null | undefined): RespostaImediataResult {
  const texto = normalizarTexto(textoRaw);
  if (!texto) return { matched: false, reason: null, reply: null };

  // Excluir se for claramente sobre cirurgia ou exame
  if (RE_CIRURGIA.test(texto)) return { matched: false, reason: null, reply: null };
  if (RE_EXAME_STRICT.test(texto)) return { matched: false, reason: null, reply: null };

  const temPreco = RE_PRECO.test(texto);
  const temConsulta = RE_CONSULTA.test(texto);
  const perguntaGenerica = RE_PERGUNTA_GENERICA_PRECO.test(texto);

  const match =
    (temPreco && temConsulta) ||
    (perguntaGenerica && !RE_CIRURGIA.test(texto) && !RE_EXAME_STRICT.test(texto));

  if (!match) return { matched: false, reason: null, reply: null };

  return {
    matched: true,
    reason: "valor_consulta",
    reply: VALOR_CONSULTA_REPLY,
  };
}

/**
 * Ao responder valor da consulta, se houver um "próximo dado pendente"
 * na coleta, acrescenta uma frase retomando exatamente esse dado, sem
 * reiniciar o fluxo.
 */
export function reforcarProximoDadoPendente(
  replyBase: string,
  proximoDadoPendente: string | null | undefined,
): string {
  const p = (proximoDadoPendente || "").trim();
  if (!p) return replyBase;
  return `${replyBase}\n\n${p}`;
}

// ---------------------------------------------------------------------------
// Mapa determinístico estado_atendimento -> frase de retomada.
// Usado pelo endpoint registrar-mensagem-in-n8n para compor a resposta ao
// paciente após "valor da consulta", SEM chamar LLM neste turno.
// ---------------------------------------------------------------------------

export const PROXIMO_DADO_POR_ESTADO: Record<string, string> = {
  coletando_nome:
    "Para seguir com o agendamento, me confirma seu nome completo, por favor?",
  coletando_data_nascimento:
    "Para seguir, me informa sua data de nascimento (dd/mm/aaaa)?",
  coletando_tipo_atendimento:
    "O atendimento será particular ou por convênio?",
  coletando_convenio:
    "Qual é o nome do seu convênio?",
  coletando_local:
    "Você prefere ser atendido(a) no Clinicor ou no HGP?",
  oferecendo_datas:
    "Você tem alguma data de preferência para a consulta?",
  oferecendo_horarios:
    "Tem algum horário de preferência nesse dia?",
  aguardando_confirmacao:
    "Posso confirmar seu agendamento com esses dados?",
};

/**
 * Compõe a resposta ao paciente para o caso valor_consulta.
 * - Sempre começa com a frase fixa de valor.
 * - Se o estado atual estiver no mapa, acrescenta a pergunta específica.
 * - Se não estiver mapeado (ou for null/undefined), retorna apenas a frase fixa.
 */
export function composePatientReplyValor(
  estadoAtendimento: string | null | undefined,
): { reply: string; hasRetomada: boolean; estadoUsado: string | null } {
  const chave = (estadoAtendimento || "").trim().toLowerCase();
  const proximo = chave ? PROXIMO_DADO_POR_ESTADO[chave] ?? null : null;
  if (!proximo) {
    return { reply: VALOR_CONSULTA_REPLY, hasRetomada: false, estadoUsado: null };
  }
  return {
    reply: `${VALOR_CONSULTA_REPLY}\n\n${proximo}`,
    hasRetomada: true,
    estadoUsado: chave,
  };
}
