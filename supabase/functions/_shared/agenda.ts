// ============================================================================
// agenda.ts — FONTE ÚNICA da lógica de disponibilidade de agenda.
//
// Antes desta extração, os helpers de agenda (getClinicaSlugsFromLocal,
// gerarSlots, horarioDentroBloqueio, "hoje em Belém") existiam copiados
// verbatim dentro de listar-datas-disponiveis/index.ts e de
// listar-horarios-disponiveis/index.ts — e uma TERCEIRA vez dentro do arquivo
// de teste. Qualquer correção precisava ser aplicada três vezes, e as cópias
// já haviam divergido (carga de disponibilidade_semanal).
//
// Regra do módulo: TODA regra de negócio de agenda mora aqui ou em
// agendaCore.ts. Os index.ts das Edge Functions só fazem HTTP: auth, parse,
// log e serialização.
//
// Divisão dos dois arquivos:
//   • agendaCore.ts — puro, ZERO imports, importável pelo vitest.
//   • agenda.ts     — I/O (Supabase) + política. Re-exporta o core inteiro,
//                     então quem consome importa de um lugar só.
//
// Camadas aqui dentro:
//   1) I/O      — carregarDadosAgenda(), resolverFiltroClinica().
//   2) POLÍTICA — buscarDatasDisponiveis()/buscarHorariosDisponiveis()/
//                 criarAgendamentoValidado(), o contrato REST novo.
//   3) LEGADO   — buscarDatasLegado()/buscarHorariosLegado() preservam o
//                 contrato que o mcp-agendamento já consome hoje.
//
// Timezone: America/Belem é UTC-3 fixo (sem horário de verão).
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverClinica } from "./validarDisponibilidade.ts";
import { isRegistroAtivo, isCrmTerminal, isFunilTerminal } from "./statusTerminais.ts";
import { telefoneCanonico } from "./telefoneCanonico.ts";
import {
  belemAgoraMinutos,
  calcularDatasDoMes,
  calcularHorariosDoDia,
  determineStatusCrmByLocation,
  formatarDataBR,
  formatarDataBRExtenso,
  getClinicaSlugsFromLocal,
  hojeBelem,
  HORIZONTE_MESES_MAX,
  labelUnidade,
  mesEhPassado,
  montarMensagemConfirmacao,
  montarMensagemDatas,
  montarMensagemHorarios,
  normalizarLimite,
  parseMesInicial,
  proximoMes,
  resolverTipoAtendimento,
  resolverUnidadeTravada,
  selecionarDatasPorSemana,
  selecionarHorariosEspacados,
  ultimoDiaDoMes,
  UNIDADES_PADRAO,
  UUID_RE,
  ymd,
  type DadosAgenda,
  type FiltroClinica,
  type HojeBelem,
  type OpcaoData,
} from "./agendaCore.ts";

// Reexporta o núcleo puro: quem consome importa tudo de "agenda.ts".
export * from "./agendaCore.ts";

/**
 * Cliente admin. Genéricos abertos de propósito: `ReturnType<typeof
 * createClient>` resolve para SupabaseClient<unknown, never, …> e recusa o
 * cliente concreto que as Edge Functions constroem (<any, "public", any>).
 */
// deno-lint-ignore no-explicit-any
export type SupabaseAdmin = SupabaseClient<any, any, any>;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// 1) Carga de dados — única camada de I/O da leitura de agenda
// ─────────────────────────────────────────────────────────────────────────────

export interface CarregarOpts {
  dataInicio: string;
  dataFim: string;
  /**
   * true  → carrega só disponibilidade_semanal ativa (comportamento histórico
   *         de listar-datas-disponiveis).
   * false → carrega os modelos referenciados por id, ativos ou não
   *         (comportamento histórico de listar-horarios-disponiveis).
   *
   * As duas funções antigas divergiam neste ponto: uma data cujo modelo
   * estivesse inativo sumia da lista de datas mas ainda rendia horários. O
   * contrato REST novo usa false nos DOIS endpoints, para que "data
   * oferecida" e "horários da data" nunca discordem. O caminho legado
   * preserva cada comportamento como era.
   */
  modelosSomenteAtivos: boolean;
}

export type CarregarResultado =
  | { ok: true; dados: DadosAgenda }
  | { ok: false; erro: string };

/** Faz as queries do intervalo. Falha de query NUNCA vira lista vazia. */
export async function carregarDadosAgenda(
  supabase: SupabaseAdmin,
  opts: CarregarOpts,
): Promise<CarregarResultado> {
  const { dataInicio, dataFim, modelosSomenteAtivos } = opts;

  const [bdRes, biRes, deRes, agRes] = await Promise.all([
    supabase
      .from("bloqueios_agenda")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .in("tipo_bloqueio", ["dia_inteiro", "feriado"]),
    supabase
      .from("bloqueios_agenda")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .in("tipo_bloqueio", ["intervalo", "ausencia_profissional"]),
    supabase
      .from("disponibilidade_especifica")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim),
    supabase
      .from("agendamentos")
      .select("data_agendamento, hora_agendamento, clinica_id, local_atendimento, is_sandbox")
      .gte("data_agendamento", dataInicio)
      .lte("data_agendamento", dataFim)
      .neq("status_funil", "cancelado"),
  ]);

  for (const [nome, r] of [
    ["bloqueios_dia", bdRes],
    ["bloqueios_intervalo", biRes],
    ["disponibilidade_especifica", deRes],
    ["agendamentos", agRes],
  ] as const) {
    if (r.error) return { ok: false, erro: `${nome}_lookup_failed` };
  }

  // Modelos semanais referenciados por disponibilidade_especifica sem horário.
  const modelos = new Map<string, Row>();
  if (modelosSomenteAtivos) {
    const dsRes = await supabase.from("disponibilidade_semanal").select("*").eq("ativo", true);
    if (dsRes.error) return { ok: false, erro: "disponibilidade_semanal_lookup_failed" };
    for (const m of dsRes.data ?? []) modelos.set(m.id, m);
  } else {
    const ids = [
      ...new Set(
        (deRes.data ?? [])
          .filter((d: Row) => d.disponivel && (!d.hora_inicio || !d.hora_fim) && d.modelo_id)
          .map((d: Row) => d.modelo_id as string),
      ),
    ];
    if (ids.length > 0) {
      const mRes = await supabase.from("disponibilidade_semanal").select("*").in("id", ids);
      if (mRes.error) return { ok: false, erro: "disponibilidade_semanal_lookup_failed" };
      for (const m of mRes.data ?? []) modelos.set(m.id, m);
    }
  }

  return {
    ok: true,
    dados: {
      bloqueiosDia: bdRes.data ?? [],
      bloqueiosIntervalo: biRes.data ?? [],
      dispEspecifica: deRes.data ?? [],
      modelos,
      agendamentos: agRes.data ?? [],
    },
  };
}

export type ResolverFiltroResultado =
  | { ok: true; filtro: FiltroClinica }
  | { ok: false; erro: string };

/** Traduz um local textual em ids de clínica ativos. */
export async function resolverFiltroClinica(
  supabase: SupabaseAdmin,
  local: string | null | undefined,
): Promise<ResolverFiltroResultado> {
  const slugs = getClinicaSlugsFromLocal(local);
  if (slugs === null) {
    return { ok: true, filtro: { clinicaIds: [], temFiltroLocal: false, slugs: null } };
  }
  if (slugs.length === 0) {
    return { ok: true, filtro: { clinicaIds: [], temFiltroLocal: true, slugs: [] } };
  }
  const { data, error } = await supabase
    .from("clinicas")
    .select("id, slug")
    .in("slug", slugs)
    .eq("ativo", true);
  if (error) return { ok: false, erro: "clinicas_lookup_failed" };
  return {
    ok: true,
    filtro: {
      clinicaIds: (data ?? []).map((c: Row) => c.id as string),
      temFiltroLocal: true,
      slugs,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) POLÍTICA — contrato REST novo
// ─────────────────────────────────────────────────────────────────────────────

export interface BuscarDatasParams {
  tipo_atendimento?: string | null;
  unidade?: string | null;
  mes_inicial?: string | number | null;
  limite_opcoes?: number | null;
}

export interface BuscarDatasResultado {
  sucesso: boolean;
  unidade_travada: string | null;
  opcoes: OpcaoData[];
  total_encontradas: number;
  meses_pesquisados: number;
  sem_disponibilidade: boolean;
  mensagem_pronta: string | null;
  erro?: string;
}

/**
 * Busca progressiva de datas para o contrato REST.
 *
 * - Unidade travada por tipo de atendimento (exames + YAG → HGP), decidida
 *   no servidor e nunca pelo chamador.
 * - Filtro de unidade aplicado NO SERVIDOR: havendo unidade, nenhuma data de
 *   outra unidade pode aparecer no resultado.
 * - Só datas estritamente futuras (America/Belem).
 * - Avança mês a mês até juntar `limite_opcoes`, teto de 6 meses. O mês em
 *   que a meta é atingida é varrido inteiro — por isso total_encontradas
 *   costuma ser maior que o número de opções devolvidas.
 * - Agrupamento por semana na seleção final.
 */
export async function buscarDatasDisponiveis(
  supabase: SupabaseAdmin,
  params: BuscarDatasParams,
  hoje: HojeBelem = hojeBelem(),
): Promise<BuscarDatasResultado> {
  const limite = normalizarLimite(params.limite_opcoes, 3);
  const tipo = resolverTipoAtendimento(params.tipo_atendimento);
  const { travada, local } = resolverUnidadeTravada(tipo, params.unidade);

  // Unidades a varrer. Com filtro, só a unidade pedida; sem filtro, o par
  // padrão (Clinicor + HGP) — cada uma varrida em separado para que toda
  // data devolvida saiba a que unidade pertence.
  const alvos: string[] = local ? [local] : [...UNIDADES_PADRAO];

  const erro = (e: string, meses: number): BuscarDatasResultado => ({
    sucesso: false,
    unidade_travada: travada ? "HGP" : null,
    opcoes: [],
    total_encontradas: 0,
    meses_pesquisados: meses,
    sem_disponibilidade: true,
    mensagem_pronta: null,
    erro: e,
  });

  const filtros: { local: string; filtro: FiltroClinica }[] = [];
  for (const alvo of alvos) {
    const r = await resolverFiltroClinica(supabase, alvo);
    if (!r.ok) return erro(r.erro, 0);
    // Unidade que não resolve para nenhuma clínica ativa não contribui.
    if (r.filtro.temFiltroLocal && r.filtro.clinicaIds.length === 0) continue;
    filtros.push({ local: alvo, filtro: r.filtro });
  }

  const agoraMinutos = belemAgoraMinutos();
  const inicio = parseMesInicial(params.mes_inicial, hoje);
  let ano = inicio?.ano ?? hoje.ano;
  let mes = inicio?.mes ?? hoje.mes;
  // Mês no passado volta para o mês atual — nunca varre para trás.
  if (mesEhPassado(ano, mes, hoje)) {
    ano = hoje.ano;
    mes = hoje.mes;
  }

  const encontradas: OpcaoData[] = [];
  let mesesPesquisados = 0;

  for (let i = 0; i < HORIZONTE_MESES_MAX; i++) {
    mesesPesquisados++;
    const carga = await carregarDadosAgenda(supabase, {
      dataInicio: ymd(ano, mes, 1),
      dataFim: ymd(ano, mes, ultimoDiaDoMes(ano, mes)),
      modelosSomenteAtivos: false,
    });
    if (!carga.ok) return erro(carga.erro, mesesPesquisados);

    for (const { local: alvo, filtro } of filtros) {
      const datas = calcularDatasDoMes(carga.dados, {
        ano,
        mes,
        filtro,
        hoje,
        agoraMinutos,
        somenteFuturas: true,
      });
      const rotulo = labelUnidade(alvo);
      for (const d of datas) {
        encontradas.push({
          data: d.data,
          data_br: formatarDataBRExtenso(d.data),
          unidade: rotulo,
        });
      }
    }

    // Varre o mês inteiro antes de decidir parar.
    if (encontradas.length >= limite) break;
    if (i === HORIZONTE_MESES_MAX - 1) break;
    const nx = proximoMes(ano, mes);
    ano = nx.ano;
    mes = nx.mes;
  }

  const opcoes = selecionarDatasPorSemana(encontradas, limite);

  return {
    sucesso: true,
    unidade_travada: travada ? "HGP" : null,
    opcoes,
    total_encontradas: encontradas.length,
    meses_pesquisados: mesesPesquisados,
    sem_disponibilidade: opcoes.length === 0,
    mensagem_pronta: montarMensagemDatas(opcoes),
  };
}

export interface BuscarHorariosParams {
  data?: string | null;
  unidade?: string | null;
  tipo_atendimento?: string | null;
  limite_opcoes?: number | null;
}

export interface BuscarHorariosResultado {
  sucesso: boolean;
  data: string | null;
  data_br: string | null;
  unidade: string | null;
  opcoes: { horario: string }[];
  sem_disponibilidade: boolean;
  mensagem_pronta: string | null;
  motivo?: string;
  erro?: string;
}

/**
 * Horários livres de uma data. `data` e `unidade` do request são obrigatórios
 * e nunca são ignorados — só o tipo de atendimento pode sobrescrever a
 * unidade, e apenas para travá-la no HGP.
 */
export async function buscarHorariosDisponiveis(
  supabase: SupabaseAdmin,
  params: BuscarHorariosParams,
  hoje: HojeBelem = hojeBelem(),
): Promise<BuscarHorariosResultado> {
  const limite = normalizarLimite(params.limite_opcoes, 2);
  const data = String(params.data ?? "").trim();
  const tipo = resolverTipoAtendimento(params.tipo_atendimento);
  const { travada } = resolverUnidadeTravada(tipo, params.unidade);
  const local = travada ? "HGP" : String(params.unidade ?? "").trim();

  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const vazio = (motivo: string, unidade: string | null): BuscarHorariosResultado => ({
    sucesso: motivo !== "erro_interno",
    data: data || null,
    data_br: dataValida ? formatarDataBR(data) : null,
    unidade,
    opcoes: [],
    sem_disponibilidade: true,
    mensagem_pronta: null,
    motivo,
  });

  if (!dataValida) return vazio("data_invalida", null);
  if (!local) return vazio("unidade_ausente", null);

  const rotulo = labelUnidade(local);
  if (data < hoje.iso) return vazio("data_no_passado", rotulo);

  const fr = await resolverFiltroClinica(supabase, local);
  if (!fr.ok) return { ...vazio("erro_interno", rotulo), erro: fr.erro };
  if (fr.filtro.temFiltroLocal && fr.filtro.clinicaIds.length === 0) {
    return vazio("clinicas_nao_encontradas", rotulo);
  }

  const carga = await carregarDadosAgenda(supabase, {
    dataInicio: data,
    dataFim: data,
    modelosSomenteAtivos: false,
  });
  if (!carga.ok) return { ...vazio("erro_interno", rotulo), erro: carga.erro };

  const r = calcularHorariosDoDia(carga.dados, {
    data,
    filtro: fr.filtro,
    hoje,
    agoraMinutos: belemAgoraMinutos(),
  });
  if (!r.ok) return vazio(r.motivo, rotulo);

  const escolhidos = selecionarHorariosEspacados(r.slots, limite);
  const dataBr = formatarDataBR(data);

  return {
    sucesso: true,
    data,
    data_br: dataBr,
    unidade: rotulo,
    opcoes: escolhidos.map((h) => ({ horario: h })),
    sem_disponibilidade: escolhidos.length === 0,
    mensagem_pronta: montarMensagemHorarios(dataBr, rotulo, escolhidos),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) POLÍTICA — confirmação transacional
// ─────────────────────────────────────────────────────────────────────────────

export type MotivoFalha =
  | "agendamento_id_ausente"
  | "card_nao_encontrado"
  | "telefone_divergente"
  | "card_ambiguo"
  | "dados_incompletos"
  | "horario_ocupado"
  | "erro_interno";

export interface ConfirmarResultado {
  sucesso: boolean;
  agendamento_id?: string;
  motivo?: MotivoFalha;
  detalhe?: string;
  mensagem_pronta: string | null;
  /** Dados do card, para quem chama notificar sem reler o banco. */
  dados?: Record<string, unknown>;
}

const falha = (motivo: MotivoFalha, detalhe?: string): ConfirmarResultado => ({
  sucesso: false,
  motivo,
  ...(detalhe ? { detalhe } : {}),
  mensagem_pronta: null,
});

/**
 * Valida e confirma em um passo só. Fail-closed: qualquer dúvida recusa e NÃO
 * grava nada. Nunca escolhe outro card, nunca cria agendamento parcial.
 *
 * A janela de corrida entre "validar" e "criar" some porque a checagem de
 * ocupação e a gravação acontecem na mesma chamada, e a última linha de
 * defesa é o índice único uniq_agendamento_slot_ativo (violação → 23505 →
 * horario_ocupado).
 */
export async function criarAgendamentoValidado(
  supabase: SupabaseAdmin,
  params: { agendamento_id?: string | null; telefone_whatsapp?: string | null },
): Promise<ConfirmarResultado> {
  const id = String(params.agendamento_id ?? "").trim();
  if (!id || !UUID_RE.test(id)) return falha("agendamento_id_ausente");

  const telInput = telefoneCanonico(params.telefone_whatsapp);
  if (!telInput) return falha("telefone_divergente", "telefone_whatsapp ausente ou invalido");

  const { data: card, error: cardErr } = await supabase
    .from("agendamentos")
    .select(
      "id, nome_completo, data_nascimento, telefone_whatsapp, telefone_canonico, convenio, convenio_outro, tipo_atendimento, detalhe_exame_ou_cirurgia, local_atendimento, clinica_id, data_agendamento, hora_agendamento, status_crm, status_funil, is_sandbox",
    )
    .eq("id", id)
    .maybeSingle();

  if (cardErr) return falha("erro_interno", "card_lookup_failed");
  if (!card) return falha("card_nao_encontrado");
  if (card.is_sandbox === true) return falha("card_nao_encontrado", "card_sandbox");
  if (isCrmTerminal(card.status_crm) || isFunilTerminal(card.status_funil)) {
    return falha("card_nao_encontrado", "card_terminal");
  }

  const telCard = card.telefone_canonico ?? telefoneCanonico(card.telefone_whatsapp);
  if (!telCard || telCard !== telInput) return falha("telefone_divergente");

  // Ambíguo = o mesmo telefone tem mais de um card ativo. Mesmo critério do
  // buscar-contexto-paciente (isRegistroAtivo), para os dois não divergirem.
  const { data: irmaos, error: irmaosErr } = await supabase
    .from("agendamentos")
    .select("id, status_crm, status_funil, is_sandbox")
    .eq("telefone_canonico", telCard)
    .neq("is_sandbox", true);
  if (irmaosErr) return falha("erro_interno", "ambiguidade_lookup_failed");
  if ((irmaos ?? []).filter((r: Row) => isRegistroAtivo(r)).length > 1) {
    return falha("card_ambiguo");
  }

  // Dados obrigatórios lidos do PRÓPRIO card. Quem chama não escolhe nada.
  const faltando: string[] = [];
  if (!String(card.nome_completo ?? "").trim()) faltando.push("nome");
  if (!card.data_nascimento) faltando.push("nascimento");
  if (!String(card.tipo_atendimento ?? "").trim()) faltando.push("tipo");
  if (!String(card.local_atendimento ?? "").trim()) faltando.push("unidade");
  if (!card.data_agendamento) faltando.push("data");
  if (!card.hora_agendamento) faltando.push("horario");
  if (faltando.length > 0) return falha("dados_incompletos", faltando.join(","));

  const clinica = resolverClinica(String(card.local_atendimento));
  if (!clinica) return falha("dados_incompletos", "unidade_desconhecida");

  const dataAg = String(card.data_agendamento);
  const horaAg = String(card.hora_agendamento).substring(0, 5);

  // Checagem de ocupação: outro card ativo no mesmo slot da mesma clínica.
  const { data: concorrentes, error: concErr } = await supabase
    .from("agendamentos")
    .select("id, status_crm, status_funil, is_sandbox")
    .eq("clinica_id", clinica.id)
    .eq("data_agendamento", dataAg)
    .eq("hora_agendamento", card.hora_agendamento)
    .neq("id", id);
  if (concErr) return falha("erro_interno", "ocupacao_lookup_failed");
  if ((concorrentes ?? []).filter((r: Row) => isRegistroAtivo(r)).length > 0) {
    return falha("horario_ocupado");
  }

  const status_crm = determineStatusCrmByLocation(clinica.nome);
  const { data: upd, error: updErr } = await supabase
    .from("agendamentos")
    .update({
      clinica_id: clinica.id,
      local_atendimento: clinica.nome,
      status_crm,
      status_funil: "agendado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (updErr) {
    // Última defesa contra corrida: índice uniq_agendamento_slot_ativo.
    if ((updErr as Row).code === "23505") return falha("horario_ocupado");
    return falha("erro_interno", "update_failed");
  }

  const convenio =
    card.convenio === "Outro" && card.convenio_outro ? card.convenio_outro : card.convenio;
  // O procedimento real mora em detalhe_exame_ou_cirurgia ("Retinografia",
  // "Capsulotomia YAG Laser"); tipo_atendimento é o enum de 4 valores do
  // banco (Consulta/Retorno/Exame/Cirurgia). O paciente quer ver o primeiro.
  const atendimento =
    String(card.detalhe_exame_ou_cirurgia ?? "").trim() || String(card.tipo_atendimento);

  return {
    sucesso: true,
    agendamento_id: upd?.id ?? id,
    mensagem_pronta: montarMensagemConfirmacao({
      paciente: String(card.nome_completo),
      atendimento,
      data_br: formatarDataBR(dataAg),
      horario: horaAg,
      local: labelUnidade(clinica.nome),
    }),
    dados: {
      id: upd?.id ?? id,
      nome_completo: card.nome_completo,
      telefone_whatsapp: card.telefone_whatsapp,
      tipo_atendimento: card.tipo_atendimento,
      detalhe_exame_ou_cirurgia: card.detalhe_exame_ou_cirurgia ?? null,
      local_atendimento: clinica.nome,
      clinica_id: clinica.id,
      // notificar-n8n valida convenio como z.string().optional() — SEM
      // .nullable(). Mandar null reprova o schema e mata a notificação do
      // CRM justamente nos cards sem convênio. undefined some no
      // JSON.stringify e satisfaz o .optional().
      convenio: convenio || undefined,
      data_agendamento: dataAg,
      hora_agendamento: horaAg,
      status_crm,
      origem: "rest",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) LEGADO — contrato consumido hoje pelo mcp-agendamento.
//    Mesmo núcleo das funções acima; muda só a política e a serialização.
//    NÃO altere o formato sem alterar o agente em produção.
// ─────────────────────────────────────────────────────────────────────────────

export interface DatasLegadoParams {
  mes?: unknown;
  ano?: unknown;
  local_atendimento?: unknown;
  auto_avancar?: unknown;
}

/** Reproduz listar-datas-disponiveis como o mcp-agendamento espera. */
export async function buscarDatasLegado(
  supabase: SupabaseAdmin,
  body: DatasLegadoParams,
  rid: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const hoje = hojeBelem();
  const agoraMinutos = belemAgoraMinutos();
  const localAtendimento = typeof body.local_atendimento === "string" ? body.local_atendimento : "";
  const autoAvancar = body.auto_avancar !== false; // default true

  const mesRaw = body.mes;
  const anoRaw = body.ano;
  const mesNum = Number(mesRaw);
  const anoNum = Number(anoRaw);
  const mesAusente = mesRaw === undefined || mesRaw === null || mesRaw === "";
  const anoAusente = anoRaw === undefined || anoRaw === null || anoRaw === "";
  const mesInvalido = !mesAusente && (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12);
  const anoInvalido = !anoAusente && (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > 2100);

  let anoBase: number;
  let mesBase: number;
  let periodoAjustado = false;
  let motivoAjuste: string | null = null;
  let ajustadoPeriodoPassado = false;

  if (mesAusente || anoAusente) {
    anoBase = hoje.ano;
    mesBase = hoje.mes;
    periodoAjustado = true;
    motivoAjuste = "periodo_ausente";
  } else if (mesInvalido || anoInvalido) {
    anoBase = hoje.ano;
    mesBase = hoje.mes;
    periodoAjustado = true;
    motivoAjuste = "periodo_invalido";
  } else if (mesEhPassado(anoNum, mesNum, hoje)) {
    anoBase = hoje.ano;
    mesBase = hoje.mes;
    periodoAjustado = true;
    ajustadoPeriodoPassado = true;
    motivoAjuste = "periodo_passado";
  } else {
    anoBase = anoNum;
    mesBase = mesNum;
  }

  const periodoSolicitado = {
    ano: Number.isInteger(anoNum) ? anoNum : null,
    mes: Number.isInteger(mesNum) ? mesNum : null,
  };

  const fr = await resolverFiltroClinica(supabase, localAtendimento);
  if (!fr.ok) return { status: 500, body: { error: fr.erro, request_id: rid } };
  const slugs = fr.filtro.slugs;

  if (fr.filtro.temFiltroLocal && fr.filtro.clinicaIds.length === 0) {
    return {
      status: 200,
      body: {
        periodo_solicitado: periodoSolicitado,
        periodo_consultado: { ano: anoBase, mes: mesBase },
        periodo_ajustado: periodoAjustado,
        ajustado_periodo_passado: ajustadoPeriodoPassado,
        motivo_ajuste: motivoAjuste,
        local_atendimento: localAtendimento || null,
        local_resolvido: { slugs, ids: [] },
        datas_disponiveis: [],
        total_datas: 0,
        horizonte_meses: 0,
        motivo: "clinicas_nao_encontradas",
        request_id: rid,
      },
    };
  }

  let anoAtual = anoBase;
  let mesAtual = mesBase;
  let datasFinal: { data: string; slots_disponiveis: number }[] = [];
  let periodoConsultado = { ano: anoBase, mes: mesBase };
  let mesesTentados = 0;
  let encontrou = false;

  for (let i = 0; i < HORIZONTE_MESES_MAX; i++) {
    mesesTentados++;
    periodoConsultado = { ano: anoAtual, mes: mesAtual };

    // Legado começa em "hoje" quando é o mês corrente (e inclui hoje).
    const dataInicio =
      anoAtual === hoje.ano && mesAtual === hoje.mes ? hoje.iso : ymd(anoAtual, mesAtual, 1);
    const carga = await carregarDadosAgenda(supabase, {
      dataInicio,
      dataFim: ymd(anoAtual, mesAtual, ultimoDiaDoMes(anoAtual, mesAtual)),
      modelosSomenteAtivos: true,
    });
    if (!carga.ok) return { status: 500, body: { error: carga.erro, request_id: rid } };

    const datas = calcularDatasDoMes(carga.dados, {
      ano: anoAtual,
      mes: mesAtual,
      filtro: fr.filtro,
      hoje,
      agoraMinutos,
      somenteFuturas: false,
    });

    if (datas.length > 0) {
      datasFinal = datas;
      encontrou = true;
      break;
    }
    if (!autoAvancar) break;
    // Não avança no último ciclo — periodo_consultado permanece no 6º mês.
    if (i === HORIZONTE_MESES_MAX - 1) break;
    const nx = proximoMes(anoAtual, mesAtual);
    anoAtual = nx.ano;
    mesAtual = nx.mes;
  }

  const motivo = encontrou
    ? null
    : autoAvancar
      ? "sem_disponibilidade_no_horizonte"
      : "sem_disponibilidade_no_periodo";

  return {
    status: 200,
    body: {
      periodo_solicitado: periodoSolicitado,
      periodo_consultado: periodoConsultado,
      periodo_ajustado: periodoAjustado,
      ajustado_periodo_passado: ajustadoPeriodoPassado,
      motivo_ajuste: motivoAjuste,
      local_atendimento: localAtendimento || null,
      local_resolvido: { slugs: slugs ?? null, ids: fr.filtro.clinicaIds },
      datas_disponiveis: datasFinal,
      total_datas: datasFinal.length,
      horizonte_meses: mesesTentados,
      auto_avancar: autoAvancar,
      motivo,
      timezone: "America/Belem",
      request_id: rid,
    },
  };
}

/** Reproduz listar-horarios-disponiveis como o mcp-agendamento espera. */
export async function buscarHorariosLegado(
  supabase: SupabaseAdmin,
  body: { data?: unknown; local_atendimento?: unknown },
  rid: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const hoje = hojeBelem();
  const data = typeof body.data === "string" ? body.data : "";
  const localAtendimento = typeof body.local_atendimento === "string" ? body.local_atendimento : "";

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return {
      status: 400,
      body: { error: 'Campo "data" obrigatório no formato YYYY-MM-DD', request_id: rid },
    };
  }

  if (data < hoje.iso) {
    return {
      status: 200,
      body: {
        data,
        local_atendimento: localAtendimento || null,
        horarios_disponiveis: [],
        total: 0,
        motivo: "data_no_passado",
        request_id: rid,
      },
    };
  }

  const fr = await resolverFiltroClinica(supabase, localAtendimento);
  if (!fr.ok) return { status: 500, body: { error: fr.erro, request_id: rid } };
  const base = {
    data,
    local_atendimento: localAtendimento || null,
    local_resolvido: { slugs: fr.filtro.slugs ?? null, ids: fr.filtro.clinicaIds },
    request_id: rid,
  };

  if (fr.filtro.temFiltroLocal && fr.filtro.clinicaIds.length === 0) {
    return {
      status: 200,
      body: { ...base, horarios_disponiveis: [], total: 0, motivo: "clinicas_nao_encontradas" },
    };
  }

  const carga = await carregarDadosAgenda(supabase, {
    dataInicio: data,
    dataFim: data,
    modelosSomenteAtivos: false,
  });
  if (!carga.ok) return { status: 500, body: { error: carga.erro, request_id: rid } };

  const r = calcularHorariosDoDia(carga.dados, {
    data,
    filtro: fr.filtro,
    hoje,
    agoraMinutos: belemAgoraMinutos(),
  });

  if (!r.ok) {
    return { status: 200, body: { ...base, horarios_disponiveis: [], total: 0, motivo: r.motivo } };
  }
  return {
    status: 200,
    body: { ...base, horarios_disponiveis: r.slots, total: r.slots.length },
  };
}
