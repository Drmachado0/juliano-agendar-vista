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

describe("detectarAssuntoExames — via histórico (janela + continuação)", () => {
  const now = new Date("2026-07-13T15:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

  it("exame 10min atrás + 'já fiz a consulta' => handoff via histórico", () => {
    const hist = [
      { id: "m1", direcao: "IN" as const, conteudo: "meu convênio cobre exame de OCT?", created_at: ago(10) },
      { id: "m2", direcao: "OUT" as const, conteudo: "vou verificar", created_at: ago(9) },
    ];
    const r = detectarAssuntoExames("já fiz a consulta", hist, { now });
    expect(r.matched).toBe(true);
    expect(r.matchedInHistory).toBe(true);
    expect(r.reason).toBe("exame_avaliacao_hgp");
  });

  it("exame 2h atrás + 'quero agendar consulta' => normal (fora da janela)", () => {
    const hist = [
      { id: "m1", direcao: "IN" as const, conteudo: "preciso agendar exame de OCT", created_at: ago(120) },
    ];
    const r = detectarAssuntoExames("quero agendar uma consulta", hist, { now });
    expect(r.matched).toBe(false);
  });

  it("exame 10min atrás + assunto independente => normal (não é continuação)", () => {
    const hist = [
      { id: "m1", direcao: "IN" as const, conteudo: "preciso agendar exame de OCT", created_at: ago(10) },
    ];
    const r = detectarAssuntoExames("quero marcar uma consulta particular", hist, { now });
    expect(r.matched).toBe(false);
  });

  it("exclui a mensagem atual do histórico (por currentMessageId)", () => {
    const hist = [
      { id: "cur", direcao: "IN" as const, conteudo: "preciso agendar exame de OCT", created_at: ago(1) },
    ];
    const r = detectarAssuntoExames("sim", hist, { now, currentMessageId: "cur" });
    expect(r.matched).toBe(false);
  });

  it("exclui mensagens no futuro (currentCreatedAt)", () => {
    const cur = ago(5);
    const hist = [
      { id: "m2", direcao: "IN" as const, conteudo: "exame de OCT?", created_at: ago(2) }, // depois da atual
    ];
    const r = detectarAssuntoExames("sim", hist, { now, currentCreatedAt: cur });
    expect(r.matched).toBe(false);
  });

  it("continuação curta 'sim' herda handoff dentro da janela", () => {
    const hist = [
      { id: "m1", direcao: "IN" as const, conteudo: "meu convênio cobre exame?", created_at: ago(5) },
    ];
    const r = detectarAssuntoExames("sim", hist, { now });
    expect(r.matched).toBe(true);
  });

  it("não marca quando nem atual nem histórico mencionam exames", () => {
    const hist = [{ id: "m1", direcao: "IN" as const, conteudo: "quero remarcar", created_at: ago(5) }];
    expect(detectarAssuntoExames("obrigada!", hist, { now }).matched).toBe(false);
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
  it("usa link wa.me, nome e assunto humano com exame mencionado", () => {
    const s = buildHandoffExamesSummary({
      nome: "Maria",
      telefoneMascarado: "****0174",
      telefoneContato: "+5591936180476",
      mensagemAtual: "preciso agendar exame de OCT",
      hits: ["oct"],
      matchedInHistory: false,
      agendamentoId: "abc",
      statusCrm: "NOVO LEAD",
      statusFunil: "novo",
      localAtendimento: "HGP",
      exameMencionado: "oct",
    });
    expect(s).toContain("🔔 *NOVO ATENDIMENTO — EXAMES (HGP)*");
    expect(s).toContain("━━━━━━━━━━━━━━━━━━");
    expect(s).toContain("👤 *Paciente:* Maria");
    expect(s).toContain("📞 *Contato:* wa.me/5591936180476");
    expect(s).toContain("📋 *Assunto:*");
    expect(s).toContain("exame OCT: agendamento/avaliação do pedido");
    expect(s).toContain("💬 *Última mensagem do paciente:*");
    expect(s).toContain('"preciso agendar exame de OCT"');
    expect(s).toContain("🤖 Encaminhado pela secretária virtual");
    // não vaza dados técnicos
    expect(s).not.toContain("Sinais");
    expect(s).not.toContain("abc");
    expect(s).not.toContain("status_crm");
    expect(s).not.toContain("status_funil");
    expect(s).not.toContain("NOVO LEAD");
  });

  it("mantém nome do exame por extenso quando não é sigla", () => {
    const s = buildHandoffExamesSummary({
      telefoneMascarado: "****9999",
      telefoneContato: "5591936180476",
      mensagemAtual: "quero o campo visual",
      hits: ["campo visual"],
      matchedInHistory: false,
      exameMencionado: "campo visual",
    });
    expect(s).toContain("exame campo visual: agendamento/avaliação do pedido");
  });

  it("cai no telefone mascarado e assunto genérico, com sufixo de histórico", () => {
    const s = buildHandoffExamesSummary({
      telefoneMascarado: "****9999",
      mensagemAtual: "exame",
      hits: [],
      matchedInHistory: true,
    });
    expect(s).toContain("👤 *Paciente:* Não identificado");
    expect(s).toContain("📞 *Contato:* ****9999");
    expect(s).not.toContain("wa.me/");
    expect(s).toContain("Assunto de exames que precisa de avaliação da secretaria");
    expect(s).toContain("(identificado nas mensagens recentes)");
    expect(s).toContain('"exame"');
  });

  it("trunca a última mensagem em 200 caracteres", () => {
    const longa = "a".repeat(250);
    const s = buildHandoffExamesSummary({
      telefoneMascarado: "****9999",
      mensagemAtual: longa,
      hits: [],
      matchedInHistory: false,
    });
    expect(s).toContain(`"${"a".repeat(200)}"`);
    expect(s).not.toContain("a".repeat(201));
  });
});

describe("constantes canônicas", () => {
  it("resposta e telefone de notificação estão travados", () => {
    expect(HANDOFF_EXAMES_REPLY).toMatch(/secretaria do HGP/);
    expect(HANDOFF_EXAMES_REPLY).toMatch(/Encaminhei seu atendimento/);
    expect(HANDOFF_NOTIFICATION_PHONE).toBe("5591991300174");
  });
});
