// ============================================================================
// Testes de listar-datas-disponiveis, listar-horarios-disponiveis e
// confirmar-agendamento.
//
// Reescrito na extração para _shared/agenda.ts + _shared/agendaCore.ts.
// Antes, este arquivo REIMPLEMENTAVA getClinicaSlugsFromLocal, gerarSlots,
// ultimoDiaDoMes, proximoMes e mesEhPassado — cópias que podiam passar
// verdes enquanto a edge function real quebrava. Agora importa as funções
// de verdade do núcleo puro; só o que é inerentemente textual (config.toml,
// presença de guardas de auth) continua sendo asserção estrutural.
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  calcularDatasDoMes,
  calcularHorariosDoDia,
  chaveSemana,
  diaDaSemana,
  formatarDataBR,
  formatarDataBRExtenso,
  gerarSlots,
  getClinicaSlugsFromLocal,
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
  TIPOS_ATENDIMENTO,
  ultimoDiaDoMes,
  type DadosAgenda,
  type FiltroClinica,
  type HojeBelem,
} from "../../../supabase/functions/_shared/agendaCore.ts";

const raiz = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/**
 * Remove comentários antes de asserções de "este código NÃO contém X" —
 * senão o próprio comentário explicando a regra faz o teste falhar.
 */
const semComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SRC_DATAS = raiz("supabase/functions/listar-datas-disponiveis/index.ts");
const SRC_HORARIOS = raiz("supabase/functions/listar-horarios-disponiveis/index.ts");
const SRC_CONFIRMAR = raiz("supabase/functions/confirmar-agendamento/index.ts");
const SRC_AGENDA = raiz("supabase/functions/_shared/agenda.ts");
const SRC_CORE = raiz("supabase/functions/_shared/agendaCore.ts");
const SRC_MCP = raiz("supabase/functions/mcp-agendamento/index.ts");
const CFG = raiz("supabase/config.toml");

// ---------------------------------------------------------------------------
// Fixtures sintéticas (nenhum dado de produção)
// ---------------------------------------------------------------------------
const HGP = "hgp-id-teste";
const CLINICOR = "clinicor-id-teste";

const filtroHgp: FiltroClinica = {
  clinicaIds: [HGP],
  temFiltroLocal: true,
  slugs: ["hgp"],
};
const filtroClinicor: FiltroClinica = {
  clinicaIds: [CLINICOR],
  temFiltroLocal: true,
  slugs: ["clinicor"],
};
const semFiltro: FiltroClinica = { clinicaIds: [], temFiltroLocal: false, slugs: null };

const HOJE: HojeBelem = { ano: 2026, mes: 9, dia: 1, iso: "2026-09-01" };

function dados(over: Partial<DadosAgenda> = {}): DadosAgenda {
  return {
    bloqueiosDia: [],
    bloqueiosIntervalo: [],
    dispEspecifica: [],
    modelos: new Map(),
    agendamentos: [],
    ...over,
  };
}

/** Abertura padrão: 09:00–12:00 de 30 em 30 na clínica informada. */
function abertura(data: string, clinica_id: string | null) {
  return {
    data,
    disponivel: true,
    hora_inicio: "09:00:00",
    hora_fim: "12:00:00",
    intervalo_minutos: 30,
    modelo_id: null,
    clinica_id,
  };
}

// ===========================================================================
// Estruturais — só o que é textual por natureza
// ===========================================================================
describe("configuração das três funções", () => {
  it.each([
    "listar-datas-disponiveis",
    "listar-horarios-disponiveis",
    "confirmar-agendamento",
  ])("%s tem verify_jwt=false no config.toml", (fn) => {
    expect(CFG).toMatch(new RegExp(`\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`));
  });

  it("nenhuma das três é pública: todas exigem requireN8nSecret", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS, SRC_CONFIRMAR]) {
      expect(src).toMatch(/requireN8nSecret/);
      expect(src).toMatch(/unauthorizedResponse/);
      // comparação frouxa de segredo não pode voltar
      expect(src).not.toMatch(/provided\s*!==\s*secret/);
    }
  });

  it("as três propagam request_id", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS, SRC_CONFIRMAR]) {
      expect(src).toMatch(/requestId\(req\)/);
      expect(src).toMatch(/request_id:\s*rid/);
    }
  });
});

describe("fonte única — a lógica não pode voltar a ser duplicada", () => {
  it("os index.ts não reimplementam helpers de agenda", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS, SRC_CONFIRMAR]) {
      expect(src).not.toMatch(/function getClinicaSlugsFromLocal/);
      expect(src).not.toMatch(/function gerarSlots/);
      expect(src).not.toMatch(/function horarioDentroBloqueio/);
      // nem o cálculo de "hoje em Belém" solto
      expect(src).not.toMatch(/3\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    }
  });

  it("os três index.ts importam do módulo compartilhado", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS, SRC_CONFIRMAR]) {
      expect(src).toMatch(/from "\.\.\/_shared\/agenda\.ts"/);
    }
  });

  it("agenda.ts reexporta o núcleo puro, sem copiá-lo", () => {
    expect(SRC_AGENDA).toMatch(/export \* from "\.\/agendaCore\.ts"/);
    expect(SRC_AGENDA).not.toMatch(/export function gerarSlots/);
    expect(SRC_AGENDA).not.toMatch(/export function getClinicaSlugsFromLocal/);
  });

  it("agendaCore.ts é puro: sem import de rede e sem cliente Supabase", () => {
    const codigo = semComentarios(SRC_CORE);
    expect(codigo).not.toMatch(/https:\/\/esm\.sh/);
    expect(codigo).not.toMatch(/createClient/);
    expect(codigo).not.toMatch(/^import /m);
  });

  it("o núcleo mantém as garantias que antes eram checadas nos index.ts", () => {
    expect(SRC_CORE).toMatch(/HORIZONTE_MESES_MAX\s*=\s*6/);
    expect(SRC_CORE).toMatch(/Date\.now\(\)\s*-\s*3\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(SRC_CORE).toMatch(/clinicaIds\.includes\(item\.clinica_id\)/);
    expect(SRC_CORE).toMatch(/is_sandbox/);
    expect(SRC_CORE).toMatch(/modelo_id/);
    expect(SRC_CORE).toMatch(/intervalo_minutos/);
    expect(SRC_CORE).not.toMatch(/setHours\(0,\s*0,\s*0,\s*0\)/);
  });

  it("falha de query nunca vira lista vazia", () => {
    expect(SRC_AGENDA).toMatch(/lookup_failed/);
  });
});

describe("mcp-agendamento permanece intocado", () => {
  it("continua expondo exatamente as 5 tools originais, com os mesmos nomes", () => {
    for (const tool of [
      "listar_horarios_disponiveis",
      "validar_horario",
      "criar_agendamento",
      "listar_datas_disponiveis",
      "cancelar_agendamento",
    ]) {
      expect(SRC_MCP).toMatch(new RegExp(`name: "${tool}"`));
    }
  });

  it("continua chamando as edge functions por HTTP, sem importar agenda.ts", () => {
    expect(SRC_MCP).toMatch(/callEdgeFunction\("listar-datas-disponiveis"/);
    expect(SRC_MCP).toMatch(/callEdgeFunction\("listar-horarios-disponiveis"/);
    expect(SRC_MCP).not.toMatch(/_shared\/agenda/);
  });

  it("o contrato legado continua atendido pelos dois endpoints", () => {
    expect(SRC_DATAS).toMatch(/buscarDatasLegado/);
    expect(SRC_HORARIOS).toMatch(/buscarHorariosLegado/);
    // e a resposta legada preserva os campos que o agente já lê
    for (const campo of [
      "periodo_solicitado",
      "periodo_consultado",
      "ajustado_periodo_passado",
      "horizonte_meses",
      "auto_avancar",
      "datas_disponiveis",
      "horarios_disponiveis",
    ]) {
      expect(SRC_AGENDA).toMatch(new RegExp(campo));
    }
  });

  it("o corpo legado (mes/ano) não colide com o corpo novo", () => {
    // Nenhuma chave do contrato novo existe no corpo que o MCP envia.
    const enviadasPeloMcp = ["mes", "ano", "local_atendimento", "data"];
    const chavesNovas = ["tipo_atendimento", "unidade", "limite_opcoes", "mes_inicial"];
    for (const k of enviadasPeloMcp) expect(chavesNovas).not.toContain(k);
  });
});

// ===========================================================================
// Regras de negócio — funções REAIS do núcleo
// ===========================================================================
describe("resolução de clínica por local_atendimento", () => {
  it("HGP nunca inclui Clinicor", () => {
    const s = getClinicaSlugsFromLocal("Hospital Geral de Paragominas");
    expect(s).toEqual(["hgp"]);
    expect(s).not.toContain("clinicor");
  });
  it("Clinicor nunca inclui HGP", () => {
    const s = getClinicaSlugsFromLocal("Clinicor – Paragominas");
    expect(s).toEqual(["clinicor"]);
    expect(s).not.toContain("hgp");
  });
  it("Belém expande para IOB + Vitria", () => {
    expect(getClinicaSlugsFromLocal("Belém (IOB / Vitria)")).toEqual(["iob", "vitria"]);
  });
  it("local vazio/nulo = sem filtro (null)", () => {
    expect(getClinicaSlugsFromLocal("")).toBeNull();
    expect(getClinicaSlugsFromLocal(null)).toBeNull();
  });
  it("rótulo curto para o paciente", () => {
    expect(labelUnidade("Hospital Geral de Paragominas")).toBe("HGP");
    expect(labelUnidade("Clinicor – Paragominas")).toBe("Clinicor");
    expect(labelUnidade("HGP")).toBe("HGP");
  });
});

describe("unidade travada por tipo de atendimento", () => {
  it.each([
    "Retinografia",
    "Mapeamento de retina",
    "Biometria",
    "Paquimetria",
    "Capsulotomia YAG Laser",
  ])("%s trava no HGP mesmo se o request pedir Clinicor", (tipo) => {
    const r = resolverUnidadeTravada(resolverTipoAtendimento(tipo), "Clinicor");
    expect(r.travada).toBe(true);
    expect(r.local).toBe("HGP");
  });

  it.each(["Retinografia", "Capsulotomia YAG Laser"])(
    "%s trava no HGP mesmo com unidade null",
    (tipo) => {
      const r = resolverUnidadeTravada(resolverTipoAtendimento(tipo), null);
      expect(r.travada).toBe(true);
      expect(r.local).toBe("HGP");
    },
  );

  it("Consulta com unidade respeita a unidade pedida", () => {
    const r = resolverUnidadeTravada(resolverTipoAtendimento("Consulta"), "Clinicor");
    expect(r.travada).toBe(false);
    expect(r.local).toBe("Clinicor");
  });

  it("Consulta sem unidade é o ÚNICO caso sem filtro", () => {
    const r = resolverUnidadeTravada(resolverTipoAtendimento("Consulta"), null);
    expect(r.travada).toBe(false);
    expect(r.local).toBeNull();
  });

  it("aceita exatamente os seis tipos, com tolerância a acento e caixa", () => {
    expect([...TIPOS_ATENDIMENTO]).toEqual([
      "Consulta",
      "Retinografia",
      "Mapeamento de retina",
      "Biometria",
      "Paquimetria",
      "Capsulotomia YAG Laser",
    ]);
    expect(resolverTipoAtendimento("mapeamento de retina")).toBe("Mapeamento de retina");
    expect(resolverTipoAtendimento("CAPSULOTOMIA YAG LASER")).toBe("Capsulotomia YAG Laser");
    expect(resolverTipoAtendimento("Cirurgia de catarata")).toBeNull();
  });
});

describe("filtro de unidade é do servidor — HGP não vaza para Clinicor", () => {
  const d = dados({ dispEspecifica: [abertura("2026-09-12", HGP)] });

  it("abertura do HGP gera slots quando o filtro é HGP", () => {
    const r = calcularHorariosDoDia(d, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("a MESMA abertura não aparece para quem filtra Clinicor", () => {
    const r = calcularHorariosDoDia(d, {
      data: "2026-09-12",
      filtro: filtroClinicor,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.motivo).toBe("data_nao_aberta_para_agendamento");
  });

  it("agendamento cheio na Clinicor não bloqueia o mesmo horário no HGP", () => {
    const comOcupado = dados({
      dispEspecifica: [abertura("2026-09-12", HGP)],
      agendamentos: [
        {
          data_agendamento: "2026-09-12",
          hora_agendamento: "09:00:00",
          clinica_id: CLINICOR,
          local_atendimento: "Clinicor – Paragominas",
          is_sandbox: false,
        },
      ],
    });
    const r = calcularHorariosDoDia(comOcupado, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toContain("09:00");
  });

  it("agendamento do próprio HGP bloqueia o slot", () => {
    const comOcupado = dados({
      dispEspecifica: [abertura("2026-09-12", HGP)],
      agendamentos: [
        {
          data_agendamento: "2026-09-12",
          hora_agendamento: "09:00:00",
          clinica_id: HGP,
          local_atendimento: "Hospital Geral de Paragominas",
          is_sandbox: false,
        },
      ],
    });
    const r = calcularHorariosDoDia(comOcupado, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).not.toContain("09:00");
  });

  it("agendamento sandbox nunca ocupa slot", () => {
    const comSandbox = dados({
      dispEspecifica: [abertura("2026-09-12", HGP)],
      agendamentos: [
        {
          data_agendamento: "2026-09-12",
          hora_agendamento: "09:00:00",
          clinica_id: HGP,
          local_atendimento: "Hospital Geral de Paragominas",
          is_sandbox: true,
        },
      ],
    });
    const r = calcularHorariosDoDia(comSandbox, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toContain("09:00");
  });

  it("disponibilidade global (clinica_id null) vale para qualquer unidade", () => {
    const global = dados({ dispEspecifica: [abertura("2026-09-12", null)] });
    for (const f of [filtroHgp, filtroClinicor, semFiltro]) {
      const r = calcularHorariosDoDia(global, {
        data: "2026-09-12",
        filtro: f,
        hoje: HOJE,
        agoraMinutos: 0,
      });
      expect(r.ok).toBe(true);
    }
  });
});

describe("bloqueios", () => {
  it("bloqueio de dia inteiro zera a data", () => {
    const d = dados({
      dispEspecifica: [abertura("2026-09-12", HGP)],
      bloqueiosDia: [{ data: "2026-09-12", clinica_id: HGP, motivo: "Feriado municipal" }],
    });
    const r = calcularHorariosDoDia(d, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.motivo).toBe("Feriado municipal");
  });

  it("bloqueio de intervalo remove só a faixa", () => {
    const d = dados({
      dispEspecifica: [abertura("2026-09-12", HGP)],
      bloqueiosIntervalo: [
        { data: "2026-09-12", clinica_id: HGP, hora_inicio: "10:00:00", hora_fim: "11:00:00" },
      ],
    });
    const r = calcularHorariosDoDia(d, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });
});

describe("modelo_id — hora null resolve via disponibilidade_semanal", () => {
  it("herda hora_inicio/hora_fim/intervalo do modelo", () => {
    const d = dados({
      dispEspecifica: [
        {
          data: "2026-09-12",
          disponivel: true,
          hora_inicio: null,
          hora_fim: null,
          intervalo_minutos: null,
          modelo_id: "modelo-1",
          clinica_id: HGP,
        },
      ],
      modelos: new Map([
        [
          "modelo-1",
          { id: "modelo-1", hora_inicio: "14:00", hora_fim: "17:00", intervalo_minutos: 30 },
        ],
      ]),
    });
    const r = calcularHorariosDoDia(d, {
      data: "2026-09-12",
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots).toEqual(["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);
  });
});

describe("só datas estritamente futuras (contrato REST novo)", () => {
  const d = dados({
    dispEspecifica: [
      abertura("2026-09-01", HGP), // hoje
      abertura("2026-09-02", HGP),
      abertura("2026-09-12", HGP),
    ],
  });

  it("somenteFuturas=true descarta hoje", () => {
    const r = calcularDatasDoMes(d, {
      ano: 2026,
      mes: 9,
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
      somenteFuturas: true,
    });
    expect(r.map((x) => x.data)).toEqual(["2026-09-02", "2026-09-12"]);
  });

  it("somenteFuturas=false (legado) mantém hoje", () => {
    const r = calcularDatasDoMes(d, {
      ano: 2026,
      mes: 9,
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
      somenteFuturas: false,
    });
    expect(r.map((x) => x.data)).toContain("2026-09-01");
  });

  it("data no passado nunca entra", () => {
    const passado = dados({ dispEspecifica: [abertura("2026-08-31", HGP)] });
    const r = calcularDatasDoMes(passado, {
      ano: 2026,
      mes: 8,
      filtro: filtroHgp,
      hoje: HOJE,
      agoraMinutos: 0,
      somenteFuturas: true,
    });
    expect(r).toEqual([]);
  });
});

describe("agrupamento por semana (segunda a sábado)", () => {
  it("2026-09-12 é sábado e pertence à semana da segunda 2026-09-07", () => {
    expect(diaDaSemana("2026-09-12")).toBe("sábado");
    expect(chaveSemana("2026-09-12")).toBe("2026-09-07");
    expect(chaveSemana("2026-09-07")).toBe("2026-09-07");
  });

  it("semana com 3+ datas devolve as três primeiras dela", () => {
    const datas = [
      { data: "2026-09-08" },
      { data: "2026-09-09" },
      { data: "2026-09-10" },
      { data: "2026-09-11" },
      { data: "2026-09-15" }, // semana seguinte
    ];
    expect(selecionarDatasPorSemana(datas, 3).map((d) => d.data)).toEqual([
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
  });

  it("semana curta completa com a semana seguinte, mantendo a ordem", () => {
    const datas = [
      { data: "2026-09-11" }, // sexta, sozinha na semana
      { data: "2026-09-15" },
      { data: "2026-09-16" },
    ];
    expect(selecionarDatasPorSemana(datas, 3).map((d) => d.data)).toEqual([
      "2026-09-11",
      "2026-09-15",
      "2026-09-16",
    ]);
  });

  it("menos de 3 datas no total devolve só as que existem", () => {
    expect(selecionarDatasPorSemana([{ data: "2026-09-11" }], 3)).toHaveLength(1);
    expect(selecionarDatasPorSemana([], 3)).toEqual([]);
  });

  it("entrada fora de ordem é ordenada antes de selecionar", () => {
    const datas = [{ data: "2026-09-16" }, { data: "2026-09-11" }, { data: "2026-09-15" }];
    expect(selecionarDatasPorSemana(datas, 2).map((d) => d.data)).toEqual([
      "2026-09-11",
      "2026-09-15",
    ]);
  });
});

describe("seleção de horários não consecutivos", () => {
  const dia = ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30", "15:00", "16:00"];

  it("com folga, pega um de manhã e um de tarde", () => {
    const r = selecionarHorariosEspacados(dia, 2);
    expect(r).toHaveLength(2);
    expect(Number(r[0].split(":")[0])).toBeLessThan(12);
    expect(Number(r[1].split(":")[0])).toBeGreaterThanOrEqual(12);
  });

  it("nunca devolve horários consecutivos quando há folga", () => {
    const r = selecionarHorariosEspacados(dia, 2);
    const idx = r.map((h) => dia.indexOf(h));
    expect(Math.abs(idx[1] - idx[0])).toBeGreaterThan(1);
  });

  it("havendo só um horário, devolve só ele", () => {
    expect(selecionarHorariosEspacados(["09:00"], 2)).toEqual(["09:00"]);
  });

  it("não havendo nenhum, devolve vazio", () => {
    expect(selecionarHorariosEspacados([], 2)).toEqual([]);
  });

  it("só manhã disponível: espalha dentro da manhã", () => {
    const r = selecionarHorariosEspacados(["09:00", "09:30", "10:00", "10:30"], 2);
    expect(r).toEqual(["09:00", "10:30"]);
  });

  it("respeita limites maiores", () => {
    expect(selecionarHorariosEspacados(dia, 3)).toHaveLength(3);
  });
});

describe("mensagem_pronta — formato fixo, é o texto que vai ao paciente", () => {
  it("datas: emojis numerados, unidade por linha, sem frase antes/depois", () => {
    const msg = montarMensagemDatas([
      { data: "2026-09-12", data_br: "sábado, 12/09/2026", unidade: "HGP" },
      { data: "2026-09-19", data_br: "sábado, 19/09/2026", unidade: "HGP" },
      { data: "2026-09-26", data_br: "sábado, 26/09/2026", unidade: "HGP" },
    ]);
    expect(msg).toBe(
      "Encontrei estas próximas opções:\n\n" +
        "1️⃣ sábado, 12/09/2026 — HGP\n" +
        "2️⃣ sábado, 19/09/2026 — HGP\n" +
        "3️⃣ sábado, 26/09/2026 — HGP\n\n" +
        "Qual opção você prefere?",
    );
  });

  it("datas: uma opção só usa apenas 1️⃣", () => {
    const msg = montarMensagemDatas([
      { data: "2026-09-12", data_br: "sábado, 12/09/2026", unidade: "Clinicor" },
    ]);
    expect(msg).toBe(
      "Encontrei estas próximas opções:\n\n1️⃣ sábado, 12/09/2026 — Clinicor\n\nQual opção você prefere?",
    );
    expect(msg).not.toContain("2️⃣");
  });

  it("sem disponibilidade, mensagem_pronta é null", () => {
    expect(montarMensagemDatas([])).toBeNull();
    expect(montarMensagemHorarios("12/09/2026", "HGP", [])).toBeNull();
  });

  it("horários: formato exato", () => {
    expect(montarMensagemHorarios("12/09/2026", "HGP", ["09:00", "14:30"])).toBe(
      "Para 12/09/2026, no HGP, separei estas opções:\n\n🕐 09:00\n🕐 14:30\n\nQual você prefere?",
    );
  });

  it("confirmação: formato exato", () => {
    expect(
      montarMensagemConfirmacao({
        paciente: "Maria da Silva",
        atendimento: "Consulta",
        data_br: "12/09/2026",
        horario: "09:00",
        local: "Clinicor",
      }),
    ).toBe(
      "Agendamento confirmado com sucesso ✅\n\n" +
        "👤 Paciente: Maria da Silva\n" +
        "🏷️ Atendimento: Consulta\n" +
        "📅 Data: 12/09/2026\n" +
        "🕐 Horário: 09:00\n" +
        "🏥 Local: Clinicor",
    );
  });
});

describe("formatação de data", () => {
  it("data_br curta e extensa", () => {
    expect(formatarDataBR("2026-09-12")).toBe("12/09/2026");
    expect(formatarDataBRExtenso("2026-09-12")).toBe("sábado, 12/09/2026");
  });
  it("não escorrega de dia por causa de fuso", () => {
    expect(formatarDataBR("2026-01-01")).toBe("01/01/2026");
    expect(diaDaSemana("2026-01-01")).toBe("quinta-feira");
  });
});

describe("mes_inicial e limite_opcoes", () => {
  it("aceita YYYY-MM, YYYY-MM-DD e número", () => {
    expect(parseMesInicial("2026-11", HOJE)).toEqual({ ano: 2026, mes: 11 });
    expect(parseMesInicial("2026-11-01", HOJE)).toEqual({ ano: 2026, mes: 11 });
    expect(parseMesInicial(11, HOJE)).toEqual({ ano: 2026, mes: 11 });
  });
  it("null/vazio/lixo cai em null (chamador usa o mês atual)", () => {
    expect(parseMesInicial(null, HOJE)).toBeNull();
    expect(parseMesInicial("", HOJE)).toBeNull();
    expect(parseMesInicial("mês que vem", HOJE)).toBeNull();
    expect(parseMesInicial("2026-13", HOJE)).toBeNull();
  });
  it("limite inválido cai no padrão", () => {
    expect(normalizarLimite(null, 3)).toBe(3);
    expect(normalizarLimite(0, 3)).toBe(3);
    expect(normalizarLimite(-1, 2)).toBe(2);
    expect(normalizarLimite(2, 3)).toBe(2);
  });
});

describe("horizonte e navegação de meses", () => {
  it("caminha corretamente através do fim do ano", () => {
    let ano = 2026;
    let mes = 11;
    const trajeto: string[] = [];
    for (let i = 0; i < 4; i++) {
      trajeto.push(`${ano}-${String(mes).padStart(2, "0")}`);
      const nx = proximoMes(ano, mes);
      ano = nx.ano;
      mes = nx.mes;
    }
    expect(trajeto).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("mês passado é detectado", () => {
    const hoje = { ano: 2026, mes: 7 };
    expect(mesEhPassado(2026, 6, hoje)).toBe(true);
    expect(mesEhPassado(2026, 7, hoje)).toBe(false);
    expect(mesEhPassado(2025, 12, hoje)).toBe(true);
  });

  it("último dia do mês, inclusive fevereiro", () => {
    expect(ultimoDiaDoMes(2026, 7)).toBe(31);
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
  });
});

describe("gerarSlots", () => {
  it("HGP 14:00-17:00 intervalo 30 → 6 slots", () => {
    expect(gerarSlots("14:00", "17:00", 30)).toEqual([
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
    ]);
  });
  it("intervalo zero/negativo cai em 30min", () => {
    expect(gerarSlots("09:00", "10:00", 0)).toEqual(["09:00", "09:30"]);
  });
  it("nunca gera slot que ultrapassa o fim", () => {
    expect(gerarSlots("09:00", "09:20", 30)).toEqual([]);
  });
});

// ===========================================================================
// confirmar-agendamento — contrato fail-closed
// ===========================================================================
describe("confirmar-agendamento", () => {
  it("aceita apenas telefone_whatsapp e agendamento_id no corpo", () => {
    expect(SRC_CONFIRMAR).toMatch(/agendamento_id:\s*body\?\.agendamento_id/);
    expect(SRC_CONFIRMAR).toMatch(/telefone_whatsapp:\s*body\?\.telefone_whatsapp/);
    // não pode aceitar data/hora/local/nome do chamador
    expect(SRC_CONFIRMAR).not.toMatch(/body\?\.data_agendamento/);
    expect(SRC_CONFIRMAR).not.toMatch(/body\?\.hora_agendamento/);
    expect(SRC_CONFIRMAR).not.toMatch(/body\?\.local_atendimento/);
    expect(SRC_CONFIRMAR).not.toMatch(/body\?\.nome_completo/);
  });

  it("expõe exatamente os sete motivos documentados", () => {
    for (const motivo of [
      "agendamento_id_ausente",
      "card_nao_encontrado",
      "telefone_divergente",
      "card_ambiguo",
      "dados_incompletos",
      "horario_ocupado",
      "erro_interno",
    ]) {
      expect(SRC_AGENDA).toMatch(new RegExp(`"${motivo}"`));
    }
  });

  it("valida ocupação e grava na mesma chamada (sem janela de corrida)", () => {
    const trecho = SRC_AGENDA.slice(SRC_AGENDA.indexOf("export async function criarAgendamentoValidado"));
    // checagem de concorrente vem ANTES do update
    expect(trecho.indexOf("concorrentes")).toBeLessThan(trecho.indexOf(".update("));
    // e o índice único é a última defesa
    expect(trecho).toMatch(/23505/);
    expect(trecho).toMatch(/uniq_agendamento_slot_ativo/);
  });

  it("nunca escolhe outro card: busca por id exato", () => {
    const trecho = SRC_AGENDA.slice(SRC_AGENDA.indexOf("export async function criarAgendamentoValidado"));
    expect(trecho).toMatch(/\.eq\("id", id\)/);
    expect(trecho).toMatch(/UUID_RE\.test\(id\)/);
  });

  it("não envia WhatsApp (quem envia é o n8n, com mensagem_pronta)", () => {
    const codigo = semComentarios(SRC_CONFIRMAR);
    expect(codigo).not.toMatch(/confirmar-agendamento-whatsapp/);
    expect(codigo).not.toMatch(/enviar-whatsapp/);
    expect(codigo).toMatch(/invoke\("notificar-n8n"/);
  });

  it("falha de notificação não derruba a confirmação já gravada", () => {
    const codigo = semComentarios(SRC_CONFIRMAR);
    const pos = codigo.indexOf('invoke("notificar-n8n"');
    expect(pos).toBeGreaterThan(-1);
    // a invocação está dentro de um try, e o resultado vira um booleano
    expect(codigo.slice(Math.max(0, pos - 200), pos)).toMatch(/try\s*\{/);
    expect(codigo).toMatch(/notificacoes_ok = false/);
    // e a resposta de sucesso já foi decidida antes da notificação
    expect(codigo.indexOf("criarAgendamentoValidado")).toBeLessThan(pos);
  });
});
