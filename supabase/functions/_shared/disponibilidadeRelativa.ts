// ============================================================================
// disponibilidadeRelativa.ts
// Guard-rails para a máquina de estado de agendamento.
//
// 1) Parser leve de PERÍODO RELATIVO (amanhã, hoje, esta semana, à tarde...)
//    para saber se a pessoa pediu janela específica.
// 2) Estado do funil: NUNCA oferecer HORÁRIOS antes de a pessoa escolher uma
//    DATA. `podeOferecerHorarios(estado)` retorna false se `data_escolhida`
//    for null. Se a data pedida não tem agenda, o próximo passo é
//    OFERECER_DATAS com próximas datas reais; horários só depois.
// ============================================================================

import { normalizarTexto } from "./handoffExamesGuard.ts";

export type PeriodoDia = "manha" | "tarde" | "noite" | null;

export interface JanelaRelativa {
  tipo: "hoje" | "amanha" | "depois_de_amanha" | "esta_semana" | "proxima_semana" | "livre";
  periodoDia: PeriodoDia;
  textoOriginal: string;
}

const RE_HOJE = /\bhoje\b/;
const RE_AMANHA = /\bamanha\b/;
const RE_DEPOIS_DE_AMANHA = /\bdepois\s*de\s*amanha\b/;
const RE_ESTA_SEMANA = /\b(esta|essa)\s+semana\b/;
const RE_PROXIMA_SEMANA = /\bproxima\s+semana\b/;

const RE_MANHA = /\bmanha\b/;
const RE_TARDE = /\b(a\s+)?tarde\b/;
const RE_NOITE = /\bnoite\b/;

export function parseJanelaRelativa(input: string | null | undefined): JanelaRelativa {
  const texto = normalizarTexto(input);
  let tipo: JanelaRelativa["tipo"] = "livre";
  if (RE_DEPOIS_DE_AMANHA.test(texto)) tipo = "depois_de_amanha";
  else if (RE_AMANHA.test(texto)) tipo = "amanha";
  else if (RE_HOJE.test(texto)) tipo = "hoje";
  else if (RE_PROXIMA_SEMANA.test(texto)) tipo = "proxima_semana";
  else if (RE_ESTA_SEMANA.test(texto)) tipo = "esta_semana";

  let periodoDia: PeriodoDia = null;
  if (RE_TARDE.test(texto)) periodoDia = "tarde";
  else if (RE_MANHA.test(texto)) periodoDia = "manha";
  else if (RE_NOITE.test(texto)) periodoDia = "noite";

  return { tipo, periodoDia, textoOriginal: input ?? "" };
}

// ---------------------------------------------------------------------------
// Máquina de estado (mínima) para prevenir "oferecer horários" sem data.
// ---------------------------------------------------------------------------

export type FaseAgendamento =
  | "coletando_dados"
  | "aguardando_data"
  | "oferecendo_datas"
  | "data_escolhida"
  | "oferecendo_horarios"
  | "horario_escolhido";

export interface EstadoFunil {
  fase: FaseAgendamento;
  data_escolhida: string | null; // ISO YYYY-MM-DD
}

/**
 * Guard-rail principal: só é seguro oferecer HORÁRIOS se a pessoa já escolheu
 * uma data explicitamente.
 */
export function podeOferecerHorarios(estado: EstadoFunil): boolean {
  return !!estado.data_escolhida && (estado.fase === "data_escolhida" || estado.fase === "oferecendo_horarios");
}

/**
 * Se a data/período pedido não tiver agenda disponível, decidimos SEMPRE
 * apenas oferecer próximas datas reais — nunca já mostrar horários.
 */
export function proximaAcaoQuandoIndisponivel(_janela: JanelaRelativa): "oferecer_datas" {
  return "oferecer_datas";
}
