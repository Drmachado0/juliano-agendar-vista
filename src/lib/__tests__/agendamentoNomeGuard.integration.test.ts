/**
 * Integração leve do guard `assertNomePacienteValido` nos 3 fluxos afetados
 * pelo bug 2026-07-13 (MCP $fromAI → "undefined" → "Paciente: undefined"):
 *
 *  1. criar-agendamento   (HTTP público / site)
 *  2. mcp-agendamento     (tool criar_agendamento chamada pelo n8n)
 *  3. confirmar-agendamento-whatsapp (rotina de disparo do template)
 *
 * Como as edge functions rodam em Deno, aqui reproduzimos a MESMA função de
 * decisão que cada endpoint aplica e garantimos que placeholders nunca criam
 * agendamento nem geram template.
 */
import { describe, it, expect } from "vitest";
import { assertNomePacienteValido } from "../../../supabase/functions/_shared/sanitizeOptionalFields";

type CriarPayload = { nome_completo: unknown; telefone_whatsapp?: string };

/** Espelha a decisão do handler POST de criar-agendamento. */
function decidirCriarAgendamento(body: CriarPayload) {
  const check = assertNomePacienteValido(body.nome_completo);
  if (!check.ok) {
    return { status: 422, code: "nome_paciente_invalido", motivo: check.motivo };
  }
  return { status: 201, nome: check.nome };
}

/** Espelha a decisão do executor MCP tool criar_agendamento. */
function decidirMcpCriarAgendamento(args: { nome_completo: unknown; telefone_whatsapp: string; local_atendimento: string; data_agendamento: string; hora_agendamento: string; }) {
  const check = assertNomePacienteValido(args.nome_completo);
  if (!check.ok) {
    return { sucesso: false, motivo: "nome_paciente_invalido", detalhe: check.motivo };
  }
  return { sucesso: true, nome: check.nome };
}

/** Espelha a decisão do handler confirmar-agendamento-whatsapp. */
function decidirEnvioConfirmacao(agendamento: { nome_completo: unknown }) {
  const check = assertNomePacienteValido(agendamento.nome_completo);
  if (!check.ok) {
    return { status: 422, code: "nome_paciente_invalido", enviouTemplate: false, escaladoHumano: true };
  }
  return { status: 200, enviouTemplate: true, escaladoHumano: false };
}

describe("criar-agendamento: guard nome inválido/placeholder", () => {
  it.each(["undefined", "null", "n/a", "", "   ", "Paciente", "Lead WhatsApp"])(
    "rejeita %j com HTTP 422 nome_paciente_invalido",
    (nome) => {
      const r = decidirCriarAgendamento({ nome_completo: nome, telefone_whatsapp: "91991300174" });
      expect(r.status).toBe(422);
      expect(r.code).toBe("nome_paciente_invalido");
    },
  );

  it("aceita nome real e devolve 201", () => {
    const r = decidirCriarAgendamento({ nome_completo: "  Juliano Machado  " });
    expect(r.status).toBe(201);
    expect(r.nome).toBe("Juliano Machado");
  });
});

describe("mcp-agendamento criar_agendamento: guard nome inválido", () => {
  const base = {
    telefone_whatsapp: "91991300174",
    local_atendimento: "HGP",
    data_agendamento: "2026-07-22",
    hora_agendamento: "14:30",
  };

  it("bug 2026-07-13: 'undefined' do $fromAI NUNCA cria agendamento", () => {
    const r = decidirMcpCriarAgendamento({ ...base, nome_completo: "undefined" });
    expect(r.sucesso).toBe(false);
    expect(r.motivo).toBe("nome_paciente_invalido");
    expect(r.detalhe).toBe("placeholder");
  });

  it.each(["null", "n/a", "", "Paciente", "Lead", "Novo Lead"])(
    "rejeita %j sem criar registro",
    (nome) => {
      const r = decidirMcpCriarAgendamento({ ...base, nome_completo: nome });
      expect(r.sucesso).toBe(false);
      expect(r.motivo).toBe("nome_paciente_invalido");
    },
  );

  it("aceita nome válido", () => {
    const r = decidirMcpCriarAgendamento({ ...base, nome_completo: "Ana Beatriz" });
    expect(r.sucesso).toBe(true);
    expect(r.nome).toBe("Ana Beatriz");
  });
});

describe("confirmar-agendamento-whatsapp: NUNCA envia 'Paciente: undefined'", () => {
  it.each(["undefined", "null", "", "Paciente", "Lead WhatsApp"])(
    "bloqueia template quando nome_completo=%j e escala para humano",
    (nome) => {
      const r = decidirEnvioConfirmacao({ nome_completo: nome });
      expect(r.status).toBe(422);
      expect(r.code).toBe("nome_paciente_invalido");
      expect(r.enviouTemplate).toBe(false);
      expect(r.escaladoHumano).toBe(true);
    },
  );

  it("envia template quando nome válido", () => {
    const r = decidirEnvioConfirmacao({ nome_completo: "Juliano Machado" });
    expect(r.status).toBe(200);
    expect(r.enviouTemplate).toBe(true);
    expect(r.escaladoHumano).toBe(false);
  });
});
