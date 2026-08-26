import { describe, it, expect } from "vitest";
// Módulos das edge functions: vivem em supabase/functions/_shared para rodar no
// Deno, mas são TypeScript puro e sem imports externos.
import { renderizarTemplate } from "../../../supabase/functions/_shared/templateTexto";
import { dataCivilBelem, dataAmanhaBelem } from "../../../supabase/functions/_shared/dataBelem";
import { isRegistroAtivo } from "../../../supabase/functions/_shared/statusTerminais";

const LF = String.fromCharCode(10);

const TEMPLATE_CONFIRMACAO = `Olá, {{nome}}! 👋

Recebemos seu pedido de agendamento.

📅 *Data:* {{data}}
📍 *Local:* {{local}}

🔗 Acompanhe seu agendamento: {{link_status}}

Agradecemos a preferência! 🙏`;

describe("Mensagem renderizada para o paciente", () => {
  it("nao deixa buraco quando falta o link de status", () => {
    // A linha do link some, e antes ela deixava duas linhas em branco coladas:
    // o WhatsApp mostrava um vao no meio da mensagem.
    const msg = renderizarTemplate(TEMPLATE_CONFIRMACAO, {
      nome: "Ana",
      data: "10/09/2026",
      local: "Clinicor",
    });
    expect(msg).not.toContain("{{");
    expect(msg).not.toContain(LF + LF + LF);
    expect(msg).toContain("📍 *Local:* Clinicor");
    expect(msg).toContain("Agradecemos a preferência!");
  });

  it("mantem o link quando ele existe", () => {
    const msg = renderizarTemplate(TEMPLATE_CONFIRMACAO, {
      nome: "Ana",
      data: "10/09/2026",
      local: "Clinicor",
      link_status: "https://drjulianomachado.com/status/abc",
    });
    expect(msg).toContain("https://drjulianomachado.com/status/abc");
    expect(msg).not.toContain(LF + LF + LF);
  });

  it("nao corrompe nome que tem cifrao", () => {
    // `$&`, `$'` e `$1` sao padroes de substituicao do String.replace. Sem
    // tratar, o nome do paciente virava lixo no meio da mensagem.
    for (const nome of ["Ana $& Silva", "Jo$'ao", "Maria $1 Souza"]) {
      expect(renderizarTemplate("Olá, {{nome}}!", { nome })).toBe(`Olá, ${nome}!`);
    }
  });

  it("nao comeca nem termina com linha em branco", () => {
    const msg = renderizarTemplate(
      `{{link_status}}

Olá, {{nome}}!

{{link_status}}`,
      { nome: "Ana" },
    );
    expect(msg).toBe("Olá, Ana!");
  });
});

describe("Data civil de Belem nos lembretes", () => {
  // As edge functions rodam em UTC; Belem e UTC-3 o ano inteiro.
  it("nao pula um dia quando roda a noite em Belem", () => {
    // 25/08 22:00 em Belem = 26/08 01:00 UTC. O calculo antigo com
    // `new Date()` + setDate(+1) apontava para 27/08.
    const noite = new Date("2026-08-26T01:00:00.000Z");
    expect(dataCivilBelem(noite)).toBe("2026-08-25");
    expect(dataAmanhaBelem(noite)).toBe("2026-08-26");
  });

  it("mantem o comportamento no horario do cron (09:00 UTC)", () => {
    const cron = new Date("2026-08-25T09:00:00.000Z");
    expect(dataCivilBelem(cron)).toBe("2026-08-25");
    expect(dataAmanhaBelem(cron)).toBe("2026-08-26");
  });

  it("vira o mes corretamente", () => {
    const fimDeMes = new Date("2026-09-01T02:00:00.000Z"); // 31/08 23:00 em Belem
    expect(dataCivilBelem(fimDeMes)).toBe("2026-08-31");
    expect(dataAmanhaBelem(fimDeMes)).toBe("2026-09-01");
  });
});

describe("Quem nao pode receber mensagem automatica", () => {
  // Guard usado agora por lembrete-consulta-whatsapp, reengajar-lead e
  // confirmar-agendamento-whatsapp.
  it("barra registro terminal", () => {
    for (const status_crm of ["CANCELADO", "ATENDIDO", "FALTOU", "COMPARECEU", "EXCLUIDO"]) {
      expect(isRegistroAtivo({ status_crm })).toBe(false);
    }
    for (const status_funil of ["cancelado", "compareceu", "faltou", "excluido"]) {
      expect(isRegistroAtivo({ status_funil })).toBe(false);
    }
  });

  it("barra registro de teste", () => {
    expect(isRegistroAtivo({ is_sandbox: true, status_crm: "AGUARDANDO" })).toBe(false);
  });

  it("deixa passar paciente ativo", () => {
    expect(isRegistroAtivo({ status_crm: "AGUARDANDO", status_funil: "agendado" })).toBe(true);
    expect(isRegistroAtivo({ status_crm: "NOVO LEAD", status_funil: "lead" })).toBe(true);
  });
});
