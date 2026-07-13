import { describe, it, expect } from "vitest";
import {
  parseJanelaRelativa,
  podeOferecerHorarios,
  proximaAcaoQuandoIndisponivel,
} from "../../../supabase/functions/_shared/disponibilidadeRelativa";

describe("parseJanelaRelativa", () => {
  it.each([
    ["tem vaga amanhã à tarde?", "amanha", "tarde"],
    ["hoje pela manhã", "hoje", "manha"],
    ["depois de amanhã", "depois_de_amanha", null],
    ["esta semana", "esta_semana", null],
    ["próxima semana à noite", "proxima_semana", "noite"],
    ["quero marcar", "livre", null],
  ])("%j -> tipo=%s periodo=%s", (t, tipo, periodo) => {
    const j = parseJanelaRelativa(t);
    expect(j.tipo).toBe(tipo);
    expect(j.periodoDia).toBe(periodo);
  });
});

describe("podeOferecerHorarios (guard-rail)", () => {
  it("false quando data_escolhida ausente", () => {
    expect(podeOferecerHorarios({ fase: "aguardando_data", data_escolhida: null })).toBe(false);
    expect(podeOferecerHorarios({ fase: "oferecendo_datas", data_escolhida: null })).toBe(false);
  });
  it("true apenas depois de data escolhida", () => {
    expect(
      podeOferecerHorarios({ fase: "data_escolhida", data_escolhida: "2026-07-22" }),
    ).toBe(true);
    expect(
      podeOferecerHorarios({ fase: "oferecendo_horarios", data_escolhida: "2026-07-22" }),
    ).toBe(true);
  });
  it("false para fases anteriores mesmo com data", () => {
    expect(
      podeOferecerHorarios({ fase: "coletando_dados", data_escolhida: "2026-07-22" }),
    ).toBe(false);
  });
});

describe("proximaAcaoQuandoIndisponivel", () => {
  it("sempre oferecer_datas quando período pedido indisponível", () => {
    expect(proximaAcaoQuandoIndisponivel(parseJanelaRelativa("amanhã à tarde"))).toBe(
      "oferecer_datas",
    );
    expect(proximaAcaoQuandoIndisponivel(parseJanelaRelativa("esta semana"))).toBe(
      "oferecer_datas",
    );
  });
});
