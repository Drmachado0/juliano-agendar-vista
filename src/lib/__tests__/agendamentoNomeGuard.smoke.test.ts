/**
 * Smoke test estrutural: garante que o guard `assertNomePacienteValido`
 * está de fato aplicado nos 3 endpoints/rotinas afetados pelo bug
 * 2026-07-13 (nome "undefined" do MCP $fromAI).
 *
 * Se alguém remover o guard, este teste falha imediatamente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(p: string) {
  return readFileSync(resolve(__dirname, "../../..", p), "utf8");
}

const ARQUIVOS = [
  "supabase/functions/criar-agendamento/index.ts",
  "supabase/functions/mcp-agendamento/index.ts",
  "supabase/functions/confirmar-agendamento-whatsapp/index.ts",
];

describe("guard nome_paciente_invalido aplicado nos endpoints críticos", () => {
  it.each(ARQUIVOS)("%s importa e chama assertNomePacienteValido", (arq) => {
    const src = read(arq);
    expect(src).toMatch(/assertNomePacienteValido/);
    expect(src).toMatch(/from ["']\.\.\/_shared\/sanitizeOptionalFields\.ts["']/);
  });

  it("criar-agendamento retorna 422 nome_paciente_invalido", () => {
    const src = read("supabase/functions/criar-agendamento/index.ts");
    expect(src).toMatch(/status:\s*422/);
    expect(src).toMatch(/nome_paciente_invalido/);
  });

  it("mcp-agendamento retorna sucesso:false motivo:'nome_paciente_invalido'", () => {
    const src = read("supabase/functions/mcp-agendamento/index.ts");
    expect(src).toMatch(/motivo:\s*["']nome_paciente_invalido["']/);
  });

  it("confirmar-agendamento-whatsapp bloqueia envio e registra system_logs", () => {
    const src = read("supabase/functions/confirmar-agendamento-whatsapp/index.ts");
    expect(src).toMatch(/nome_paciente_invalido/);
    expect(src).toMatch(/system_logs/);
    expect(src).toMatch(/status:\s*422/);
  });
});
