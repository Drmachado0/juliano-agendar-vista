import { describe, it, expect } from "vitest";
import {
  resolveNextEstadoAtendimento,
  precisaRecomputar,
} from "../../../supabase/functions/_shared/estadoAtendimentoResolver.ts";

describe("resolveNextEstadoAtendimento — Rev-4.1", () => {
  const HGP = "Hospital Geral de Paragominas";

  it("sem nome → coletando_nome", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "",
        data_nascimento: null,
      }),
    ).toBe("coletando_nome");
  });

  it("com nome e sem data_nascimento → coletando_data_nascimento (caso do card ff5ee055)", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "Juliano Machado",
        data_nascimento: null,
        tipo_atendimento: "Exame",
        local_atendimento: HGP,
      }),
    ).toBe("coletando_data_nascimento");
  });

  it("tipo=Convênio sem convenio informado → coletando_convenio", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "Maria da Silva",
        data_nascimento: "1980-01-01",
        tipo_atendimento: "Convênio",
        convenio: "",
        local_atendimento: HGP,
      }),
    ).toBe("coletando_convenio");
  });

  it("tipo=Convênio com convenio preenchido → segue para oferecendo_datas", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "Maria da Silva",
        data_nascimento: "1980-01-01",
        tipo_atendimento: "Convênio",
        convenio: "Unimed",
        local_atendimento: HGP,
      }),
    ).toBe("oferecendo_datas");
  });

  it("tipo=Particular sem convenio → NÃO pede convenio, avança normal", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "Maria da Silva",
        data_nascimento: "1980-01-01",
        tipo_atendimento: "Particular",
        convenio: "",
        local_atendimento: HGP,
      }),
    ).toBe("oferecendo_datas");
  });



  it("com nome, nascimento, sem tipo → coletando_tipo_atendimento", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "aguardando_humano",
        nome_completo: "Ana Souza",
        data_nascimento: "1990-05-10",
        tipo_atendimento: "",
        local_atendimento: HGP,
      }),
    ).toBe("coletando_tipo_atendimento");
  });

  it("com tudo menos local → coletando_local", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "coleta",
        nome_completo: "Ana Souza",
        data_nascimento: "1990-05-10",
        tipo_atendimento: "Exame",
        local_atendimento: "",
      }),
    ).toBe("coletando_local");
  });

  it("com tudo → oferecendo_datas", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "Ana Souza",
        data_nascimento: "1990-05-10",
        tipo_atendimento: "Exame",
        local_atendimento: HGP,
      }),
    ).toBe("oferecendo_datas");
  });

  it("preserva estado válido pré-existente (idempotente)", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "oferecendo_horarios",
        nome_completo: "Ana Souza",
        data_nascimento: "1990-05-10",
        tipo_atendimento: "Exame",
        local_atendimento: HGP,
      }),
    ).toBe("oferecendo_horarios");
  });

  it("NUNCA retorna humano/aguardando_humano/coleta — fuzz de entradas", () => {
    const proibidos = new Set(["humano", "aguardando_humano", "coleta", ""]);
    const casos: Array<Parameters<typeof resolveNextEstadoAtendimento>[0]> = [
      { estado_atual: "humano", nome_completo: null, data_nascimento: null },
      { estado_atual: "aguardando_humano", nome_completo: "X", data_nascimento: null },
      { estado_atual: "coleta", nome_completo: "Ana", data_nascimento: null },
      { estado_atual: "", nome_completo: "Ana Silva", data_nascimento: "1990-01-01" },
      { estado_atual: null as any, nome_completo: "Ana Silva", data_nascimento: "1990-01-01", tipo_atendimento: "Exame", local_atendimento: "HGP" },
      { estado_atual: "estado_invalido_qualquer", nome_completo: "Ana Silva", data_nascimento: "1990-01-01" },
    ];
    for (const c of casos) {
      const r = resolveNextEstadoAtendimento(c);
      expect(proibidos.has(r)).toBe(false);
    }
  });

  it("nome inválido (1 letra ou só símbolos) cai em coletando_nome", () => {
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "A",
        data_nascimento: "1990-01-01",
      }),
    ).toBe("coletando_nome");
    expect(
      resolveNextEstadoAtendimento({
        estado_atual: "humano",
        nome_completo: "!!!",
        data_nascimento: "1990-01-01",
      }),
    ).toBe("coletando_nome");
  });
});

describe("precisaRecomputar", () => {
  it("true para humano/aguardando_humano/coleta/vazio/desconhecido", () => {
    for (const s of ["humano", "aguardando_humano", "coleta", "", null, undefined, "xyz"]) {
      expect(precisaRecomputar(s as any)).toBe(true);
    }
  });
  it("false para estados válidos do funil", () => {
    for (const s of [
      "coletando_nome",
      "coletando_data_nascimento",
      "oferecendo_datas",
      "aguardando_confirmacao",
    ]) {
      expect(precisaRecomputar(s)).toBe(false);
    }
  });
});
