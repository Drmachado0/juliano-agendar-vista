// ============================================================================
// examesPrecoGuard.ts
// Guard determinístico para preço dos EXAMES TABELADOS (rev-3).
//
// Regras operacionais:
//  - Os 4 exames abaixo têm preço fixo divulgado imediatamente pelo bot,
//    SEM handoff, sem pausar bot, sem alterar status:
//      · retinografia            R$ 300,00
//      · mapeamento de retina    R$ 300,00
//      · biometria               R$ 300,00
//      · paquimetria             R$ 300,00
//  - Se o paciente pergunta valor de exame SEM informar qual, respondemos
//    pedindo o nome do exame (immediate_reason=exame_nao_informado).
//  - Qualquer outro exame, OU qualquer outro assunto de exame (resultado,
//    laudo, cobertura, autorização, preparo, local, agendar, retorno etc.),
//    permanece com handoff HGP (exame_avaliacao_hgp).
//
// Este helper responde SOMENTE à pergunta de preço / nome isolado do exame
// tabelado. A detecção de handoff genérico continua em handoffExamesGuard.
// ============================================================================

import { normalizarTexto } from "./handoffExamesGuard.ts";

export const VALOR_EXAME_TABELADO_TEXTO = "R$ 300,00";

/** Exames com preço fixo publicável pelo bot. */
export const EXAMES_TABELADOS = [
  { canonical: "retinografia",         label: "retinografia",         regex: /\bretinografia\b/ },
  { canonical: "mapeamento de retina", label: "mapeamento de retina", regex: /\bmapeamento(?:\s+de\s+retina)?\b/ },
  { canonical: "biometria",            label: "biometria",            regex: /\bbiometria\b/ },
  { canonical: "paquimetria",          label: "paquimetria",          regex: /\bpaquimetria\b/ },
] as const;

// Ecobiometria é um exame diferente — nunca deve casar como biometria isolada.
const RE_ECOBIOMETRIA = /\becobiometria\b/;

// Exames NÃO tabelados (referência p/ handoff explícito quando o paciente
// pergunta preço de algo que não está na tabela).
const EXAMES_NAO_TABELADOS = [
  /\boct\b/,
  /\btomografia\b/,
  /\bcampo\s+visual\b/,
  /\btopografia\b/,
  /\bmicroscopia\b/,
  /\bultrassom\b/,
  /\becobiometria\b/,
  /\bangiografia\b/,
  /\bfundoscopia\b/,
  /\btonometria\b/,
];

// Sinal de pergunta de PREÇO.
const RE_PRECO = /\b(valor|preco|custa|custo|quanto|quanto\s+e|quanto\s+fica|quanto\s+custa|honorarios?|quanto\s+sai)\b/;

// Palavra "exame(s)" (para reconhecer "qual valor do exame?" sem exame nomeado).
const RE_PALAVRA_EXAME = /\b(exame|exames)\b/;

// Contexto que NÃO é preço e indica handoff HGP quando aparece com exame:
// resultado, laudo, autorização, cobertura, agendar, marcar, remarcar, local,
// preparo, retorno, fazer/realizar, guia, pedido, cobre, plano, convênio, onde.
const RE_HANDOFF_CTX = /\b(resultad[oa]|laud[oa]|autoriza(?:cao|r|ram|do|da)|cobertura|cobre|plano|convenio|guia|pedid[oa]|solicit(?:acao|ar|ei|ou|ada|ado)|agendar|agendad[oa]|agendamento|marcar|marcad[oa]|remarcar|onde|local|preparo|retorno|fazer|realizar|realiza(?:cao|do|da))\b/;

export type ExamePrecoResult =
  | { kind: "preco_tabelado"; exame: string; label: string }
  | { kind: "preco_generico_sem_exame" }
  | { kind: "handoff_exame_nao_tabelado"; exameMencionado: string }
  | { kind: "none" };

/**
 * Classifica a mensagem em relação a preço de exames tabelados.
 * NÃO cobre o handoff genérico de exame (isso segue no handoffExamesGuard).
 */
export function classificarExamePreco(textoRaw: string | null | undefined): ExamePrecoResult {
  const texto = normalizarTexto(textoRaw);
  if (!texto) return { kind: "none" };

  const tabeladoHit = EXAMES_TABELADOS.find((e) => e.regex.test(texto));
  // Se casou "biometria" mas na verdade era "ecobiometria", desqualifica.
  const tabelado =
    tabeladoHit && !(tabeladoHit.canonical === "biometria" && RE_ECOBIOMETRIA.test(texto))
      ? tabeladoHit
      : null;

  const naoTabeladoMatch = EXAMES_NAO_TABELADOS.map((r) => texto.match(r))
    .find((m) => !!m);
  const naoTabelado = naoTabeladoMatch ? naoTabeladoMatch[0] : null;

  const temPreco = RE_PRECO.test(texto);
  const temHandoffCtx = RE_HANDOFF_CTX.test(texto);
  const temPalavraExame = RE_PALAVRA_EXAME.test(texto);

  // 1) Exame tabelado + contexto de handoff (resultado/laudo/agendar/cobre…)
  //    → NÃO é preço; devolve none para o guard genérico assumir handoff.
  if (tabelado && temHandoffCtx && !temPreco) {
    return { kind: "none" };
  }

  // 2) Pergunta com preço:
  if (temPreco) {
    if (tabelado && !temHandoffCtx) {
      return { kind: "preco_tabelado", exame: tabelado.canonical, label: tabelado.label };
    }
    if (naoTabelado) {
      return { kind: "handoff_exame_nao_tabelado", exameMencionado: naoTabelado };
    }
    if (temPalavraExame) {
      return { kind: "preco_generico_sem_exame" };
    }
    // preço sem contexto de exame → outros guards decidem (ex.: valor consulta)
    return { kind: "none" };
  }

  // 3) Nome isolado do exame tabelado (ex.: paciente respondeu "retinografia"
  //    após o bot perguntar). Mensagem curta e sem contexto de handoff.
  if (tabelado && !temHandoffCtx) {
    const nWords = texto.split(/\s+/).filter(Boolean).length;
    if (nWords <= 4) {
      return { kind: "preco_tabelado", exame: tabelado.canonical, label: tabelado.label };
    }
  }

  return { kind: "none" };
}

/**
 * Frase base de preço para um exame tabelado. Rev-4: informa preço,
 * exclusividade HGP e oferece agendar.
 */
export function replyPrecoExameTabelado(label: string): string {
  return `O valor da ${label} é ${VALOR_EXAME_TABELADO_TEXTO}. Esse exame é realizado somente no HGP. Posso te ajudar a agendar?`;
}

/** Frase pedindo o nome do exame quando o paciente não informou. */
export const REPLY_EXAME_NAO_INFORMADO =
  "Qual exame foi solicitado? Pode me informar o nome que aparece no pedido?";

/**
 * Compõe patient_reply para preço de exame tabelado.
 * Rev-4: NÃO acrescenta próximo dado pendente; a resposta já pivota o
 * atendimento para agendamento do exame no HGP ("Posso te ajudar a agendar?").
 * Mantém a assinatura por compatibilidade com o caller.
 */
export function composePatientReplyPrecoExame(
  label: string,
  _estadoAtendimento: string | null | undefined,
  _mapaProximoDado: Record<string, string>,
): { reply: string; hasRetomada: boolean; estadoUsado: string | null } {
  return { reply: replyPrecoExameTabelado(label), hasRetomada: false, estadoUsado: null };
}

/**
 * Nome canônico do exame em Title Case pt-BR — usado ao preencher
 * `agendamentos.detalhe_exame_ou_cirurgia`. Ex.: "Retinografia".
 */
export function detalheCanonicoExame(canonical: string): string {
  return canonical
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Local canônico para agendamento de exame tabelado. */
export const LOCAL_HGP_CANONICO = "Hospital Geral de Paragominas";

/** Continuação positiva ("sim/pode/quero…") após oferta do exame tabelado. */
const RE_CONTINUACAO_SIM =
  /^(sim|pode|pode ser|quero|claro|ok|okay|okey|beleza|blz|isso|aceito|manda|vamos|bora|por favor|pfv|posso|pode agendar|quero agendar)[.!?]?$/;

export function isAceiteAgendarExame(textoRaw: string | null | undefined): boolean {
  const t = normalizarTexto(textoRaw);
  if (!t) return false;
  return RE_CONTINUACAO_SIM.test(t);
}

