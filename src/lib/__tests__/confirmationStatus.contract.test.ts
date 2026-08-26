import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIRMATION_STATUS_VALIDOS,
  pacienteJaRespondeu,
  CONFIRMATION_STATUS,
} from "../../../supabase/functions/_shared/confirmationStatus";

const RAIZ = process.cwd();
const DIR_MIGRATIONS = join(RAIZ, "supabase", "migrations");
const DIR_FUNCTIONS = join(RAIZ, "supabase", "functions");

/** Lê a lista da CHECK constraint direto do arquivo de migration. */
function valoresDaConstraint(): string[] {
  for (const arquivo of readdirSync(DIR_MIGRATIONS)) {
    if (!arquivo.endsWith(".sql")) continue;
    const sql = readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8");
    for (const linha of sql.split("\n")) {
      if (linha.includes("CHECK (confirmation_status IN")) {
        return (linha.match(/'([a-z_]+)'/g) || []).map((s) => s.replace(/'/g, ""));
      }
    }
  }
  return [];
}

/** Todos os literais gravados em confirmation_status pelas edge functions. */
function literaisGravadosNoCodigo(): { arquivo: string; valor: string }[] {
  const achados: { arquivo: string; valor: string }[] = [];
  for (const fn of readdirSync(DIR_FUNCTIONS)) {
    const caminho = join(DIR_FUNCTIONS, fn, "index.ts");
    if (!existsSync(caminho)) continue;
    const src = readFileSync(caminho, "utf8");
    const re = /confirmation_status: *["']([a-z_]+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      achados.push({ arquivo: fn, valor: m[1] });
    }
  }
  return achados;
}

describe("Vocabulario de confirmation_status", () => {
  // A coluna tem CHECK constraint no banco. Gravar fora da lista faz o UPDATE
  // falhar — e os chamadores so logavam o erro, entao a resposta do paciente
  // sumia sem ninguem perceber.
  it("bate exatamente com a CHECK constraint do banco", () => {
    const doBanco = valoresDaConstraint();
    expect(doBanco.length).toBeGreaterThan(0);
    expect([...CONFIRMATION_STATUS_VALIDOS].sort()).toEqual([...doBanco].sort());
  });

  it("nenhuma edge function grava valor fora do vocabulario", () => {
    const invalidos = literaisGravadosNoCodigo().filter(
      (a) => !CONFIRMATION_STATUS_VALIDOS.includes(a.valor),
    );
    expect(invalidos).toEqual([]);
  });
});

describe("Quem ja respondeu nao recebe lembrete", () => {
  it("reconhece confirmado e cancelado", () => {
    expect(pacienteJaRespondeu(CONFIRMATION_STATUS.CONFIRMADO)).toBe(true);
    expect(pacienteJaRespondeu(CONFIRMATION_STATUS.CANCELADO_PELO_PACIENTE)).toBe(true);
  });

  it("deixa passar quem ainda nao respondeu", () => {
    expect(pacienteJaRespondeu(CONFIRMATION_STATUS.NAO_ENVIADO)).toBe(false);
    expect(pacienteJaRespondeu(CONFIRMATION_STATUS.AGUARDANDO_CONFIRMACAO)).toBe(false);
    expect(pacienteJaRespondeu(CONFIRMATION_STATUS.FALHA_ENVIO)).toBe(false);
    expect(pacienteJaRespondeu(null)).toBe(false);
    expect(pacienteJaRespondeu(undefined)).toBe(false);
  });

  it("nao reconhece os valores antigos que nunca chegaram a existir", () => {
    // "confirmado_paciente" e "cancelado_paciente" eram o que o codigo tentava
    // gravar; a constraint recusava. Nao podem voltar por engano.
    expect(pacienteJaRespondeu("confirmado_paciente")).toBe(false);
    expect(pacienteJaRespondeu("cancelado_paciente")).toBe(false);
  });
});
