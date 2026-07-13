import { describe, it, expect } from "vitest";
import {
  detectarAssuntoExames,
  detectarAssuntoExamesTexto,
  buildHandoffExamesSummary,
  HANDOFF_EXAMES_REPLY,
  HANDOFF_NOTIFICATION_PHONE,
  normalizarTexto,
} from "../../../supabase/functions/_shared/handoffExamesGuard";

describe("normalizarTexto", () => {
  it("remove acentos e baixa caixa", () => {
    expect(normalizarTexto("Já FIZ o EXAME de OCT")).toBe("ja fiz o exame de oct");
  });
});

describe("detectarAssuntoExamesTexto — positivos", () => {
  it.each([
    "Preciso agendar exame de OCT",
    "Meu convênio cobre exame?",
    "Onde faço meu exame?",
    "Quanto custa o exame de mapeamento?",
    "Já tenho exames agendados no HGP",
    "Qual o valor do exame?",
    "Vou levar a guia de exame amanhã",
    "Retorno com exames pedidos",
    "Mapeamento de retina",
    "Preciso de autorização para o exame",
    "Ainda não saiu o laudo",
    "Já fiz o campo visual, e agora?",
    "e os exames?",
  ])("detecta: %j", (t) => {
    expect(detectarAssuntoExamesTexto(t).matched).toBe(true);
  });
});

describe("detectarAssuntoExamesTexto — falsos positivos", () => {
  it.each([
    "Fiz exame de consciência sobre isso",
    "Passei no exame nacional da OAB",
    "Meu convênio é Unimed",
    "Qual é o valor da consulta?",
    "Boa tarde, tudo bem?",
    "Quero marcar uma consulta particular",
  ])("NÃO detecta: %j", (t) => {
    expect(detectarAssuntoExamesTexto(t).matched).toBe(false);
  });
});

describe("detectarAssuntoExames — via histórico", () => {
  it("marca match_in_history quando mensagem atual é neutra mas histórico tem exames", () => {
    const hist = [
      { direcao: "IN" as const, conteudo: "meu convênio cobre exame de OCT?" },
      { direcao: "OUT" as const, conteudo: "vou verificar" },
    ];
    const r = detectarAssuntoExames("já fiz a consulta", hist);
    expect(r.matched).toBe(true);
    expect(r.matchedInHistory).toBe(true);
    expect(r.reason).toBe("assunto_exames");
  });

  it("não marca quando nem atual nem histórico mencionam exames", () => {
    const hist = [{ direcao: "IN" as const, conteudo: "quero remarcar" }];
    expect(detectarAssuntoExames("obrigada!", hist).matched).toBe(false);
  });
});

describe("idempotência semântica", () => {
  it("mesmo texto e histórico produz mesmo resultado", () => {
    const r1 = detectarAssuntoExames("exame de campo visual", []);
    const r2 = detectarAssuntoExames("exame de campo visual", []);
    expect(r1).toEqual(r2);
  });
});

describe("buildHandoffExamesSummary", () => {
  it("inclui telefone mascarado, sinais e contexto do agendamento", () => {
    const s = buildHandoffExamesSummary({
      nome: "Maria",
      telefoneMascarado: "****0174",
      mensagemAtual: "preciso agendar exame de OCT",
      hits: ["oct"],
      matchedInHistory: false,
      agendamentoId: "abc",
      statusCrm: "NOVO LEAD",
      statusFunil: "novo",
      localAtendimento: "HGP",
    });
    expect(s).toContain("Maria");
    expect(s).toContain("****0174");
    expect(s).toContain("Sinais: oct");
    expect(s).toContain("status_crm=NOVO LEAD");
  });

  it("sem nome/agendamento gera resumo defensivo", () => {
    const s = buildHandoffExamesSummary({
      telefoneMascarado: "****9999",
      mensagemAtual: "exame",
      hits: [],
      matchedInHistory: false,
    });
    expect(s).toContain("Paciente sem nome cadastrado");
    expect(s).toContain("(sem agendamento vinculado)");
  });
});

describe("constantes canônicas", () => {
  it("resposta e telefone de notificação estão travados", () => {
    expect(HANDOFF_EXAMES_REPLY).toMatch(/encaminhei o atendimento para nossa equipe/);
    expect(HANDOFF_NOTIFICATION_PHONE).toBe("5591991300174");
  });
});
