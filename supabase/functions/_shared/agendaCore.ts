// ============================================================================
// agendaCore.ts — núcleo PURO das regras de agenda.
//
// Zero imports. Nenhuma rede, nenhum banco, nenhum relógio implícito: "hoje"
// e "agora" são sempre injetados pelo chamador. Tudo aqui é determinístico e
// testável direto pelo vitest.
//
// Este arquivo existe separado de agenda.ts por um motivo prático: agenda.ts
// importa o supabase-js de https://esm.sh/, que o vitest não resolve. Sem a
// separação, os testes acabariam reimplementando cópias destas funções — que
// foi exatamente o problema que a extração veio resolver.
//
// agenda.ts re-exporta tudo daqui, então quem consome importa de um lugar só.
// ============================================================================

export const HORIZONTE_MESES_MAX = 6;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// 0) Tempo — America/Belem (UTC-3 fixo, sem horário de verão)
// ─────────────────────────────────────────────────────────────────────────────

export interface HojeBelem {
  ano: number;
  mes: number; // 1-12
  dia: number;
  iso: string; // YYYY-MM-DD
}

/**
 * {ano, mes(1-12), dia, iso} atual em America/Belem.
 * O runtime do Deno é UTC — new Date() puro daria o dia errado depois das 21h.
 */
export function hojeBelem(): HojeBelem {
  const belem = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const ano = belem.getUTCFullYear();
  const mes = belem.getUTCMonth() + 1;
  const dia = belem.getUTCDate();
  return { ano, mes, dia, iso: ymd(ano, mes, dia) };
}

export function hojeBelemISO(): string {
  return hojeBelem().iso;
}

/** Minutos desde a meia-noite, agora, em America/Belem. */
export function belemAgoraMinutos(): number {
  const b = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return b.getUTCHours() * 60 + b.getUTCMinutes();
}

export function ymd(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function mesEhPassado(
  ano: number,
  mes: number,
  hoje: { ano: number; mes: number },
): boolean {
  return ano < hoje.ano || (ano === hoje.ano && mes < hoje.mes);
}

const DIAS_SEMANA_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** "2026-09-12" → "12/09/2026". Puro string, sem Date local. */
export function formatarDataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** "2026-09-12" → "sábado, 12/09/2026". */
export function formatarDataBRExtenso(iso: string): string {
  return `${diaDaSemana(iso)}, ${formatarDataBR(iso)}`;
}

/** Nome do dia da semana em pt-BR. Usa UTC para não sofrer com o fuso. */
export function diaDaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS_SEMANA_PT[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/**
 * Chave da semana (segunda a sábado) que contém a data — a própria segunda.
 * Domingo é atribuído à semana que TERMINA nele; irrelevante na prática,
 * pois a agenda não abre aos domingos, mas mantém o agrupamento total.
 */
export function chaveSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const dow = dt.getUTCDay(); // 0=dom
  const recuo = dow === 0 ? 6 : dow - 1; // volta até a segunda
  dt.setUTCDate(dt.getUTCDate() - recuo);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Unidades e tipos de atendimento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve slugs de clínicas a partir de um texto livre de local.
 * null  = local não informado (sem filtro).
 * []    = local informado mas não reconhecido (filtro que não casa com nada).
 */
export function getClinicaSlugsFromLocal(local: string | null | undefined): string[] | null {
  if (!local) return null;
  const l = local.toLowerCase().trim();
  if (!l) return null;
  if (l.includes("clinicor")) return ["clinicor"];
  if (l.includes("hgp") || l.includes("hospital geral")) return ["hgp"];
  // Belém deve ser checado ANTES de iob/vitria isolados, pois a string
  // "Belém (IOB / Vitria)" contém ambos.
  if (l.includes("belém") || l.includes("belem")) return ["iob", "vitria"];
  if (l.includes("iob")) return ["iob"];
  if (l.includes("vitria")) return ["vitria"];
  return [];
}

/** Rótulo curto exibido ao paciente, por slug. */
export const LABEL_UNIDADE: Record<string, string> = {
  clinicor: "Clinicor",
  hgp: "HGP",
  iob: "IOB",
  vitria: "Vitria",
};

/** "Hospital Geral de Paragominas" → "HGP". Fallback: o próprio texto. */
export function labelUnidade(local: string | null | undefined): string {
  const slugs = getClinicaSlugsFromLocal(local);
  if (slugs && slugs.length === 1) return LABEL_UNIDADE[slugs[0]] ?? String(local ?? "");
  if (slugs && slugs.length > 1) return "Belém";
  return String(local ?? "");
}

/** Tipos de atendimento aceitos pelo contrato REST (vocabulário do agente). */
export const TIPOS_ATENDIMENTO = [
  "Consulta",
  "Retinografia",
  "Mapeamento de retina",
  "Biometria",
  "Paquimetria",
  "Capsulotomia YAG Laser",
] as const;

export type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];

/**
 * Procedimentos que só existem no HGP. Para eles a unidade é TRAVADA no
 * servidor: o que o cliente mandar em `unidade` é ignorado.
 */
export const TIPOS_TRAVADOS_HGP: readonly string[] = [
  "Retinografia",
  "Mapeamento de retina",
  "Biometria",
  "Paquimetria",
  "Capsulotomia YAG Laser",
];

/** Normaliza para comparação: minúsculo, sem acento, espaços colapsados. */
export function normalizarTexto(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Casa um texto livre com um TIPOS_ATENDIMENTO canônico. null se não casar. */
export function resolverTipoAtendimento(raw: string | null | undefined): TipoAtendimento | null {
  const n = normalizarTexto(raw);
  if (!n) return null;
  for (const t of TIPOS_ATENDIMENTO) {
    if (normalizarTexto(t) === n) return t;
  }
  return null;
}

/**
 * Regra de unidade travada. Retorna o local a filtrar, ou null quando a busca
 * pode abranger mais de uma unidade.
 *
 * - Tipo travado (exames + YAG) → sempre HGP, ignora `unidade` do request.
 * - Consulta com unidade informada → aquela unidade.
 * - Consulta sem unidade → null (único caso que mistura unidades).
 */
export function resolverUnidadeTravada(
  tipo: TipoAtendimento | null,
  unidadeRequest: string | null | undefined,
): { travada: boolean; local: string | null } {
  if (tipo && TIPOS_TRAVADOS_HGP.includes(tipo)) {
    return { travada: true, local: "HGP" };
  }
  const u = String(unidadeRequest ?? "").trim();
  if (u) return { travada: false, local: u };
  return { travada: false, local: null };
}

/**
 * Unidades candidatas quando NENHUM filtro foi aplicado. Consulta sem unidade
 * pode devolver Clinicor e HGP juntos — e só isso. Belém (IOB/Vitria) só entra
 * se o chamador pedir explicitamente.
 */
export const UNIDADES_PADRAO: readonly string[] = ["clinicor", "hgp"];

// ─────────────────────────────────────────────────────────────────────────────
// 2) Slots
// ─────────────────────────────────────────────────────────────────────────────

export function gerarSlots(horaInicio: string, horaFim: string, intervaloMin: number): string[] {
  const slots: string[] = [];
  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFim.split(":").map(Number);
  let min = hI * 60 + mI;
  const fim = hF * 60 + mF;
  const step = intervaloMin > 0 ? intervaloMin : 30;
  while (min + step <= fim) {
    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    min += step;
  }
  return slots;
}

export function horarioDentroBloqueio(
  slot: string,
  inicio: string | null,
  fim: string | null,
): boolean {
  if (!inicio || !fim) return false;
  const s = slot.substring(0, 5);
  return s >= inicio.substring(0, 5) && s < fim.substring(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Estruturas de dados e filtros por clínica
// ─────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface DadosAgenda {
  bloqueiosDia: Row[];
  bloqueiosIntervalo: Row[];
  dispEspecifica: Row[];
  modelos: Map<string, Row>;
  agendamentos: Row[];
}

export interface FiltroClinica {
  clinicaIds: string[];
  temFiltroLocal: boolean;
  /** slugs resolvidos — usados no fallback textual de agendamentos legados. */
  slugs: string[] | null;
}

/**
 * Disponibilidades e bloqueios SEM clinica_id são regra global e valem para
 * todas as unidades. Com clinica_id, só valem para a unidade correspondente.
 */
export function filtrarDispBloqueio(item: Row, f: FiltroClinica): boolean {
  if (!f.temFiltroLocal) return true;
  if (item.clinica_id === null || item.clinica_id === undefined) return true;
  return f.clinicaIds.includes(item.clinica_id);
}

/**
 * Agendamentos ocupados exigem clinica_id batendo — um horário cheio no HGP
 * NUNCA pode bloquear o mesmo horário na Clinicor. Cards legados sem
 * clinica_id caem no fallback textual por local_atendimento.
 */
export function filtrarAgendamento(item: Row, f: FiltroClinica): boolean {
  if (item.is_sandbox === true) return false;
  if (!f.temFiltroLocal) return true;
  if (item.clinica_id && f.clinicaIds.includes(item.clinica_id)) return true;
  if (!item.clinica_id && item.local_atendimento) {
    const s = getClinicaSlugsFromLocal(item.local_atendimento) ?? [];
    return s.some((x) => (f.slugs ?? []).includes(x));
  }
  return false;
}

/** Resolve hora_inicio/hora_fim/intervalo, caindo no modelo_id quando null. */
function horariosDaDisponibilidade(
  d: Row,
  modelos: Map<string, Row>,
): { ini: string; fim: string; intervalo: number } | null {
  let ini = d.hora_inicio as string | null;
  let fim = d.hora_fim as string | null;
  let intervalo = d.intervalo_minutos as number | null;
  if ((!ini || !fim) && d.modelo_id) {
    const m = modelos.get(d.modelo_id as string);
    if (m) {
      ini = ini ?? (m.hora_inicio as string);
      fim = fim ?? (m.hora_fim as string);
      intervalo = intervalo ?? (m.intervalo_minutos as number);
    }
  }
  if (!ini || !fim) return null;
  return { ini, fim, intervalo: intervalo ?? 30 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Cálculo de disponibilidade — PURO
// ─────────────────────────────────────────────────────────────────────────────

export interface CalcularDiaOpts {
  data: string;
  filtro: FiltroClinica;
  hoje: HojeBelem;
  /** Minutos desde a meia-noite em Belém; usado só quando data === hoje. */
  agoraMinutos: number;
  /** Margem em minutos para não oferecer horário quase em cima da hora. */
  margemMinutos?: number;
}

export type CalcularDiaResultado =
  | { ok: true; slots: string[] }
  | { ok: false; motivo: string };

/**
 * Slots livres de UM dia. Ordem das regras (todas fail-closed):
 *   bloqueio de dia → sem abertura → abertura marcada indisponível →
 *   gera slots → remove bloqueio de intervalo → remove ocupados →
 *   remove passado (se hoje).
 */
export function calcularHorariosDoDia(
  dados: DadosAgenda,
  opts: CalcularDiaOpts,
): CalcularDiaResultado {
  const { data, filtro, hoje, agoraMinutos } = opts;
  const margem = opts.margemMinutos ?? 30;

  const bloqDia = dados.bloqueiosDia.filter(
    (b) => b.data === data && filtrarDispBloqueio(b, filtro),
  );
  if (bloqDia.length > 0) {
    return { ok: false, motivo: bloqDia[0].motivo || "Esta data está bloqueada" };
  }

  const especifica = dados.dispEspecifica.filter(
    (d) => d.data === data && filtrarDispBloqueio(d, filtro),
  );
  if (especifica.length === 0) {
    return { ok: false, motivo: "data_nao_aberta_para_agendamento" };
  }

  const indisponivel = especifica.find((d) => !d.disponivel);
  if (indisponivel && !especifica.some((d) => d.disponivel)) {
    return { ok: false, motivo: indisponivel.motivo || "Data indisponível" };
  }

  let slots: string[] = [];
  for (const d of especifica) {
    if (!d.disponivel) continue;
    const h = horariosDaDisponibilidade(d, dados.modelos);
    if (!h) continue;
    slots.push(...gerarSlots(h.ini, h.fim, h.intervalo));
  }
  slots = [...new Set(slots)].sort();

  const bInt = dados.bloqueiosIntervalo.filter(
    (b) => b.data === data && filtrarDispBloqueio(b, filtro),
  );
  if (bInt.length > 0) {
    slots = slots.filter(
      (s) => !bInt.some((b) => horarioDentroBloqueio(s, b.hora_inicio, b.hora_fim)),
    );
  }

  const ocupados = new Set(
    dados.agendamentos
      .filter((a) => a.data_agendamento === data && filtrarAgendamento(a, filtro))
      .map((a) => String(a.hora_agendamento ?? "").substring(0, 5))
      .filter(Boolean),
  );
  slots = slots.filter((s) => !ocupados.has(s));

  if (data === hoje.iso) {
    const limite = agoraMinutos + margem;
    slots = slots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m > limite;
    });
  }

  return { ok: true, slots };
}

export interface CalcularMesOpts {
  ano: number;
  mes: number;
  filtro: FiltroClinica;
  hoje: HojeBelem;
  agoraMinutos: number;
  /**
   * true  → só datas ESTRITAMENTE posteriores a hoje (contrato REST novo).
   * false → inclui hoje se ainda houver slot (comportamento histórico).
   */
  somenteFuturas: boolean;
}

/** Datas do mês que têm ao menos um slot livre, com a contagem. */
export function calcularDatasDoMes(
  dados: DadosAgenda,
  opts: CalcularMesOpts,
): { data: string; slots_disponiveis: number }[] {
  const { ano, mes, filtro, hoje, agoraMinutos, somenteFuturas } = opts;
  const ultDia = ultimoDiaDoMes(ano, mes);
  const out: { data: string; slots_disponiveis: number }[] = [];

  for (let dia = 1; dia <= ultDia; dia++) {
    const dataStr = ymd(ano, mes, dia);
    // Passado sempre fora. "Estritamente futura" também descarta hoje.
    if (dataStr < hoje.iso) continue;
    if (somenteFuturas && dataStr <= hoje.iso) continue;

    const r = calcularHorariosDoDia(dados, { data: dataStr, filtro, hoje, agoraMinutos });
    if (r.ok && r.slots.length > 0) {
      out.push({ data: dataStr, slots_disponiveis: r.slots.length });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Seleção de opções — agrupamento por semana e espaçamento de horários
// ─────────────────────────────────────────────────────────────────────────────

export const EMOJIS_NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

/**
 * Escolhe até `limite` datas começando pela primeira semana (segunda a sábado)
 * com disponibilidade e completando com as semanas seguintes, na ordem.
 *
 * Como as semanas são contíguas e as datas já vêm ordenadas, o resultado
 * coincide com "as N primeiras datas"; o agrupamento fica explícito para que
 * a regra continue legível se um dia mudar (ex.: no máximo 2 por semana).
 */
export function selecionarDatasPorSemana<T extends { data: string }>(
  datas: T[],
  limite: number,
): T[] {
  if (limite <= 0) return [];
  const ordenadas = [...datas].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const semanas = new Map<string, T[]>();
  for (const d of ordenadas) {
    const k = chaveSemana(d.data);
    const arr = semanas.get(k) ?? [];
    arr.push(d);
    semanas.set(k, arr);
  }

  const out: T[] = [];
  for (const k of [...semanas.keys()].sort()) {
    for (const d of semanas.get(k)!) {
      if (out.length >= limite) return out;
      out.push(d);
    }
  }
  return out;
}

/**
 * Escolhe até `limite` horários, preferindo não-consecutivos. Havendo manhã e
 * tarde, distribui entre os dois turnos (um de manhã e um de tarde, no caso
 * limite=2). Dentro de cada turno, espalha em vez de pegar os primeiros.
 */
export function selecionarHorariosEspacados(slots: string[], limite: number): string[] {
  if (limite <= 0) return [];
  const ordenados = [...slots].sort();
  if (ordenados.length <= limite) return ordenados;

  const manha = ordenados.filter((s) => Number(s.split(":")[0]) < 12);
  const tarde = ordenados.filter((s) => Number(s.split(":")[0]) >= 12);

  if (limite >= 2 && manha.length > 0 && tarde.length > 0) {
    let nManha = Math.min(manha.length, Math.ceil(limite / 2));
    const nTarde = Math.min(tarde.length, limite - nManha);
    // Sobra de um turno é devolvida ao outro.
    nManha = Math.min(manha.length, nManha + (limite - nManha - nTarde));
    return [...espalhar(manha, nManha), ...espalhar(tarde, nTarde)].sort();
  }
  return espalhar(ordenados, limite);
}

/** Pega `n` itens espalhados uniformemente ao longo da lista. */
function espalhar<T>(lista: T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= lista.length) return [...lista];
  if (n === 1) return [lista[0]];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(lista[Math.round((i * (lista.length - 1)) / (n - 1))]);
  }
  return [...new Set(out)];
}

/** Limite de opções: inteiro >= 1, teto no número de emojis disponíveis. */
export function normalizarLimite(raw: number | null | undefined, padrao: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return padrao;
  return Math.min(n, EMOJIS_NUM.length);
}

/** Aceita "2026-09", "2026-09-01" ou 9. null quando ausente/ilegível. */
export function parseMesInicial(
  raw: string | number | null | undefined,
  hoje: HojeBelem,
): { ano: number; mes: number } | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 12) {
    return { ano: hoje.ano, mes: raw };
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) return { ano, mes };
  }
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return { ano: hoje.ano, mes: n };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) Mensagens prontas — texto EXATO que o n8n envia ao paciente
// ─────────────────────────────────────────────────────────────────────────────

export interface OpcaoData {
  data: string;
  data_br: string;
  unidade: string;
}

/** Sem frase antes e sem parágrafo depois. Formato fixo. */
export function montarMensagemDatas(opcoes: OpcaoData[]): string | null {
  if (opcoes.length === 0) return null;
  const linhas = opcoes.map(
    (o, i) => `${EMOJIS_NUM[i] ?? `${i + 1}.`} ${o.data_br} — ${o.unidade}`,
  );
  return `Encontrei estas próximas opções:\n\n${linhas.join("\n")}\n\nQual opção você prefere?`;
}

export function montarMensagemHorarios(
  dataBr: string,
  unidade: string,
  horarios: string[],
): string | null {
  if (horarios.length === 0) return null;
  const linhas = horarios.map((h) => `🕐 ${h}`);
  return `Para ${dataBr}, no ${unidade}, separei estas opções:\n\n${linhas.join("\n")}\n\nQual você prefere?`;
}

export function montarMensagemConfirmacao(p: {
  paciente: string;
  atendimento: string;
  data_br: string;
  horario: string;
  local: string;
}): string {
  return [
    "Agendamento confirmado com sucesso ✅",
    "",
    `👤 Paciente: ${p.paciente}`,
    `🏷️ Atendimento: ${p.atendimento}`,
    `📅 Data: ${p.data_br}`,
    `🕐 Horário: ${p.horario}`,
    `🏥 Local: ${p.local}`,
  ].join("\n");
}

/** Mapeia a unidade canônica para o status_crm usado no board do CRM. */
export function determineStatusCrmByLocation(local: string): string {
  const l = (local || "").toLowerCase();
  if (l.includes("clinicor")) return "CLINICOR";
  if (l.includes("hgp") || l.includes("hospital geral")) return "HGP";
  if (l.includes("belém") || l.includes("belem") || l.includes("iob") || l.includes("vitria")) {
    return "BELÉM";
  }
  return "NOVO LEAD";
}
