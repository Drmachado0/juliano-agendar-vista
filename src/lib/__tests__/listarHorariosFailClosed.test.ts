// ============================================================================
// Fail-closed em listarHorariosDisponiveis: erro em bloqueios_agenda ou em
// agendamentos NÃO pode virar lista vazia silenciosa nem "todos os slots
// livres". Verificação estrutural (o arquivo alvo importa de https://esm.sh
// e roda em Deno, então testes comportamentais precisam ser em Deno).
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../..", "supabase/functions/_shared/validarDisponibilidade.ts"),
  "utf8",
);

describe("listarHorariosDisponiveis — fail-closed em erros de query", () => {
  it("captura errB de bloqueios_agenda (não descarta com destructuring parcial)", () => {
    expect(src).toMatch(/error:\s*errB\s*\}\s*=\s*await\s+supabase[\s\S]{0,200}from\("bloqueios_agenda"\)/);
  });

  it("em errB retorna [] e loga 'bloqueios_err' com apenas code (sem PII)", () => {
    // Padrão obrigatório: if (errB) { console.error("... bloqueios_err ...", { code: ... }); return []; }
    expect(src).toMatch(
      /if\s*\(\s*errB\s*\)\s*\{[\s\S]{0,200}bloqueios_err[\s\S]{0,200}code:[\s\S]{0,80}return\s*\[\];\s*\}/,
    );
    // Não deve logar objeto inteiro do erro (que traria message/PII).
    const errBBlock = src.split(/if\s*\(\s*errB\s*\)/)[1]?.split("return")[0] ?? "";
    expect(errBBlock).not.toMatch(/errB\s*\)\s*$/m); // não passa o erro inteiro
    expect(errBBlock).not.toMatch(/message/);
  });

  it("captura errAg de agendamentos", () => {
    expect(src).toMatch(/error:\s*errAg\s*\}\s*=\s*await\s+agQuery/);
  });

  it("em errAg retorna [] e loga 'agendamentos_err' com apenas code", () => {
    expect(src).toMatch(
      /if\s*\(\s*errAg\s*\)\s*\{[\s\S]{0,200}agendamentos_err[\s\S]{0,200}code:[\s\S]{0,80}return\s*\[\];\s*\}/,
    );
    const errAgBlock = src.split(/if\s*\(\s*errAg\s*\)/)[1]?.split("return")[0] ?? "";
    expect(errAgBlock).not.toMatch(/message/);
  });

  it("captura errM de disponibilidade_semanal (modelos) e faz fail-closed", () => {
    // Deve destructurar error: errM ao consultar disponibilidade_semanal
    expect(src).toMatch(/error:\s*errM\s*\}\s*=\s*await\s+supabase[\s\S]{0,220}from\("disponibilidade_semanal"\)/);
    // Em errM: log 'modelos_err' com apenas code e return []
    expect(src).toMatch(
      /if\s*\(\s*errM\s*\)\s*\{[\s\S]{0,200}modelos_err[\s\S]{0,200}code:[\s\S]{0,80}return\s*\[\];\s*\}/,
    );
    const errMBlock = src.split(/if\s*\(\s*errM\s*\)/)[1]?.split("return")[0] ?? "";
    expect(errMBlock).not.toMatch(/message/);
  });

  it("errE (especificas) também loga apenas code sanitizado, sem texto livre", () => {
    const errEBlock = src.split(/error:\s*errE\s*\}/)[1]?.split("if (!especificas")[0] ?? "";
    expect(errEBlock).not.toMatch(/message/);
    expect(errEBlock).toMatch(/especificas_err[\s\S]{0,120}code:/);
  });

  it("não faz mais o pattern antigo 'const { data: bloqueios } = await' sem checar erro", () => {
    // O antigo era: const { data: bloqueios } = await supabase.from("bloqueios_agenda")...
    expect(src).not.toMatch(/const\s*\{\s*data:\s*bloqueios\s*\}\s*=\s*await\s+supabase\s*\.from\("bloqueios_agenda"\)/);
    // idem para agendamentos: sem destructuring parcial escondendo o erro
    expect(src).not.toMatch(/const\s*\{\s*data:\s*agendamentosRaw\s*\}\s*=\s*await\s+agQuery\s*;/);
    // idem para modelos
    expect(src).not.toMatch(/const\s*\{\s*data:\s*modelos\s*\}\s*=\s*await\s+supabase\s*\.from\("disponibilidade_semanal"\)/);
  });
});

describe("mcp-agendamento log de notificação não vaza agendamento_id", () => {
  const mcpSrc = readFileSync(
    resolve(__dirname, "../../..", "supabase/functions/mcp-agendamento/index.ts"),
    "utf8",
  );
  it("bloco de log 'notificacao_falhou' contém code mas NÃO contém agendamento_id", () => {
    const idx = mcpSrc.indexOf("notificacao_falhou");
    expect(idx).toBeGreaterThan(-1);
    const bloco = mcpSrc.slice(idx, idx + 400);
    expect(bloco).toMatch(/code:\s*o\.code/);
    expect(bloco).not.toMatch(/agendamento_id\s*:/);
  });
});

describe("mcp-agendamento usa classifyNotificationResults (não fail-open)", () => {
  const mcpSrc = readFileSync(
    resolve(__dirname, "../../..", "supabase/functions/mcp-agendamento/index.ts"),
    "utf8",
  );
  it("importa e chama classifyNotificationResults sobre allSettled", () => {
    expect(mcpSrc).toMatch(/from ["']\.\.\/_shared\/classifyNotificationResults\.ts["']/);
    expect(mcpSrc).toMatch(/classifyNotificationResults\(results\)/);
    // Não deve mais confiar apenas em r.status === "fulfilled"
    expect(mcpSrc).not.toMatch(/results\.every\([^)]*fulfilled/);
  });
});
