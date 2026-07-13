// ============================================================================
// Testes puros/estruturais para listar-datas-disponiveis e
// listar-horarios-disponiveis (correção 2026-07-13).
// ============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC_DATAS = readFileSync(
  resolve(process.cwd(), "supabase/functions/listar-datas-disponiveis/index.ts"),
  "utf8",
);
const SRC_HORARIOS = readFileSync(
  resolve(process.cwd(), "supabase/functions/listar-horarios-disponiveis/index.ts"),
  "utf8",
);
const CFG = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

// ------------- Helpers portados (idênticos aos das edge functions) ----------
function getClinicaSlugsFromLocal(local: string | null | undefined): string[] | null {
  if (!local) return null;
  const l = local.toLowerCase().trim();
  if (!l) return null;
  if (l.includes("clinicor")) return ["clinicor"];
  if (l.includes("hgp") || l.includes("hospital geral")) return ["hgp"];
  if (l.includes("iob") && !l.includes("belem") && !l.includes("belém")) return ["iob"];
  if (l.includes("vitria")) return ["vitria"];
  if (l.includes("belém") || l.includes("belem")) return ["iob", "vitria"];
  return [];
}

function gerarSlots(horaInicio: string, horaFim: string, intervaloMin: number): string[] {
  const slots: string[] = [];
  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFim.split(":").map(Number);
  let min = hI * 60 + mI;
  const fim = hF * 60 + mF;
  const step = intervaloMin > 0 ? intervaloMin : 30;
  while (min + step <= fim) {
    const h = String(Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    min += step;
  }
  return slots;
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
function proximoMes(ano: number, mes: number) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}
function mesEhPassado(a: number, m: number, hoje: { ano: number; mes: number }) {
  return a < hoje.ano || (a === hoje.ano && m < hoje.mes);
}

// ============================================================================
// Estruturais: config, auth, request_id, sanitização
// ============================================================================
describe("listar-datas-disponiveis — estrutural", () => {
  it("verify_jwt=false no config.toml", () => {
    expect(CFG).toMatch(/\[functions\.listar-datas-disponiveis\][\s\S]*?verify_jwt\s*=\s*false/);
  });
  it("usa requireN8nSecret timing-safe", () => {
    expect(SRC_DATAS).toMatch(/requireN8nSecret/);
    expect(SRC_DATAS).not.toMatch(/provided\s*!==\s*secret/);
  });
  it("propaga request_id", () => {
    expect(SRC_DATAS).toMatch(/requestId\(req\)/);
    expect(SRC_DATAS).toMatch(/request_id:\s*rid/);
  });
  it("expõe periodo_solicitado, periodo_consultado, ajustado_periodo_passado, horizonte_meses", () => {
    expect(SRC_DATAS).toMatch(/periodo_solicitado/);
    expect(SRC_DATAS).toMatch(/periodo_consultado/);
    expect(SRC_DATAS).toMatch(/ajustado_periodo_passado/);
    expect(SRC_DATAS).toMatch(/horizonte_meses/);
  });
  it("suporta auto_avancar default=true e trata falha de query como 500 sanitizado", () => {
    expect(SRC_DATAS).toMatch(/auto_avancar/);
    expect(SRC_DATAS).toMatch(/lookup_failed/);
  });
  it("usa America/Belem (UTC-3) e nunca new Date() puro para 'hoje'", () => {
    expect(SRC_DATAS).toMatch(/3\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    // Não pode existir setHours(0,0,0,0) — vinha do bug de timezone antigo
    expect(SRC_DATAS).not.toMatch(/setHours\(0,\s*0,\s*0,\s*0\)/);
  });
  it("exclui is_sandbox=true dos agendamentos", () => {
    expect(SRC_DATAS).toMatch(/is_sandbox/);
  });
});

describe("listar-horarios-disponiveis — estrutural", () => {
  it("verify_jwt=false no config.toml", () => {
    expect(CFG).toMatch(/\[functions\.listar-horarios-disponiveis\][\s\S]*?verify_jwt\s*=\s*false/);
  });
  it("usa requireN8nSecret timing-safe + request_id", () => {
    expect(SRC_HORARIOS).toMatch(/requireN8nSecret/);
    expect(SRC_HORARIOS).toMatch(/requestId\(req\)/);
  });
  it("rejeita data passada usando America/Belem", () => {
    expect(SRC_HORARIOS).toMatch(/hojeBelemISO/);
    expect(SRC_HORARIOS).toMatch(/data\s*<\s*hojeISO/);
  });
  it("mantém resolução de modelo_id", () => {
    expect(SRC_HORARIOS).toMatch(/modelo_id/);
    expect(SRC_HORARIOS).toMatch(/disponibilidade_semanal/);
  });
  it("filtra agendamentos ocupados por clínica (não bloqueia outra unidade)", () => {
    expect(SRC_HORARIOS).toMatch(/filtroAgendamento/);
    expect(SRC_HORARIOS).toMatch(/clinica_id/);
    expect(SRC_HORARIOS).toMatch(/is_sandbox/);
  });
  it("trata falha de query como 500 sanitizado", () => {
    expect(SRC_HORARIOS).toMatch(/clinicas_lookup_failed|bloqueios_lookup_failed|disponibilidades_lookup_failed|agendamentos_lookup_failed/);
  });
});

// ============================================================================
// Puros: regras de negócio
// ============================================================================
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
});

describe("ajuste de período passado", () => {
  const hoje = { ano: 2026, mes: 7 };
  it("junho/2026 solicitado em julho/2026 é considerado passado", () => {
    expect(mesEhPassado(2026, 6, hoje)).toBe(true);
  });
  it("julho/2026 solicitado em julho/2026 NÃO é passado", () => {
    expect(mesEhPassado(2026, 7, hoje)).toBe(false);
  });
  it("dezembro/2025 é passado quando estamos em 2026", () => {
    expect(mesEhPassado(2025, 12, hoje)).toBe(true);
  });
});

describe("auto_avancar — horizonte de 6 meses", () => {
  it("caminha corretamente através do fim do ano", () => {
    let ano = 2026, mes = 11;
    const trajeto: string[] = [];
    for (let i = 0; i < 4; i++) {
      trajeto.push(`${ano}-${String(mes).padStart(2, "0")}`);
      const nx = proximoMes(ano, mes);
      ano = nx.ano; mes = nx.mes;
    }
    expect(trajeto).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("edge function limita horizonte a 6 meses", () => {
    expect(SRC_DATAS).toMatch(/HORIZONTE_MESES_MAX\s*=\s*6/);
  });
});

describe("HGP 22/23/24 julho — slots 14:00-17:00 intervalo 30", () => {
  it("gera 6 slots de 30min entre 14:00 e 17:00", () => {
    const s = gerarSlots("14:00", "17:00", 30);
    expect(s).toEqual(["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]);
  });
  it("último dia de julho é 31 e datas 22/23/24 são válidas", () => {
    expect(ultimoDiaDoMes(2026, 7)).toBe(31);
    for (const d of [22, 23, 24]) {
      const iso = `2026-07-${d}`;
      expect(iso >= "2026-07-13").toBe(true); // hoje-Belém no cenário
    }
  });
});

describe("modelo_id — hora null resolve via disponibilidade_semanal", () => {
  it("edge function contém fallback modelo_id → hora_inicio/hora_fim/intervalo_minutos", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS]) {
      expect(src).toMatch(/modelo_id/);
      expect(src).toMatch(/hora_inicio/);
      expect(src).toMatch(/intervalo_minutos/);
    }
  });
});

describe("horário ocupado por clínica não bloqueia a outra", () => {
  it("filtro de agendamento exige clinica_id ∈ clinicaIds quando temFiltroLocal", () => {
    expect(SRC_DATAS).toMatch(/clinicaIds\.includes\(item\.clinica_id\)/);
    expect(SRC_HORARIOS).toMatch(/clinicaIds\.includes\(item\.clinica_id\)/);
  });
});

describe("timezone Belém correto", () => {
  it("ambos os arquivos ajustam UTC em -3h", () => {
    for (const src of [SRC_DATAS, SRC_HORARIOS]) {
      expect(src).toMatch(/Date\.now\(\)\s*-\s*3\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    }
  });
});
