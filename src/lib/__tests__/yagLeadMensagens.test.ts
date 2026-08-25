import { describe, it, expect } from "vitest";
// Testa as funções puras usadas pela edge function `enviar-boas-vindas-lead`
// para os leads de YAG Laser. O módulo vive em supabase/functions/_shared para
// rodar no Deno, mas é TypeScript puro e sem imports externos — dá para
// exercitá-lo aqui e não deployar no escuro.
import {
  BOAS_VINDAS_YAG_FALLBACK,
  TELEFONE_NOTIFICACAO_INTERNA,
  ehLeadYag,
  extrairOlho,
  formatarNascimento,
  montarResumoLeadYag,
} from "../../../supabase/functions/_shared/yagLeadMensagens";

describe("Identificação do lead de YAG", () => {
  it("reconhece o tipo gravado pelo formulário", () => {
    expect(ehLeadYag("Capsulotomia YAG Laser")).toBe(true);
    expect(ehLeadYag("capsulotomia yag laser")).toBe(true);
    expect(ehLeadYag("YAG")).toBe(true);
  });

  it("não captura leads do funil comum", () => {
    for (const t of ["Consulta", "Retorno", "Exame", "Cirurgia", "", null]) {
      expect(ehLeadYag(t)).toBe(false);
    }
  });
});

describe("Mensagem enviada ao paciente", () => {
  it("agradece o preenchimento e anuncia o contato da secretaria", () => {
    expect(BOAS_VINDAS_YAG_FALLBACK).toMatch(/obrigado por preencher/i);
    expect(BOAS_VINDAS_YAG_FALLBACK).toMatch(/secretaria/i);
    expect(BOAS_VINDAS_YAG_FALLBACK).toMatch(/entrar em contato/i);
  });

  it("não convida o paciente a escolher horário nem manda link", () => {
    expect(BOAS_VINDAS_YAG_FALLBACK).not.toMatch(/wa\.me|https?:\/\//i);
    expect(BOAS_VINDAS_YAG_FALLBACK).not.toMatch(/clique|escolher uma das op/i);
    expect(BOAS_VINDAS_YAG_FALLBACK).not.toMatch(/qual data e hor/i);
  });

  it("não informa valor", () => {
    expect(BOAS_VINDAS_YAG_FALLBACK).not.toMatch(/R\$|\bRS\s*\d/i);
  });

  it("usa as variáveis que o renderizador conhece", () => {
    expect(BOAS_VINDAS_YAG_FALLBACK).toContain("{{nome}}");
    expect(BOAS_VINDAS_YAG_FALLBACK).toContain("{{tipo_atendimento}}");
    expect(BOAS_VINDAS_YAG_FALLBACK).toContain("{{local}}");
  });
});

describe("Extração dos dados do paciente", () => {
  it("tira o olho do campo Detalhe", () => {
    expect(extrairOlho("Capsulotomia YAG Laser — Olho: Direito")).toBe("Direito");
    expect(extrairOlho("Capsulotomia YAG Laser — Olho: Ambos")).toBe("Ambos");
    expect(extrairOlho("Capsulotomia YAG Laser")).toBe("");
    expect(extrairOlho(null)).toBe("");
  });

  it("converte o nascimento para o formato brasileiro", () => {
    expect(formatarNascimento("1948-03-07")).toBe("07/03/1948");
    expect(formatarNascimento(null)).toBe("");
    expect(formatarNascimento("texto solto")).toBe("texto solto");
  });
});

describe("Aviso interno com os dados do paciente", () => {
  const base = {
    nome: "Maria Oliveira",
    telefone: "(91) 99999-8888",
    dataNascimento: "1948-03-07",
    detalhe: "Capsulotomia YAG Laser — Olho: Direito",
    convenio: "Particular (YAG)",
    local: "Hospital Geral de Paragominas",
  };

  it("vai para o número interno da clínica", () => {
    expect(TELEFONE_NOTIFICACAO_INTERNA).toBe("5591991300174");
  });

  it("traz todos os dados que a secretaria precisa", () => {
    const msg = montarResumoLeadYag(base);
    expect(msg).toContain("Maria Oliveira");
    expect(msg).toContain("wa.me/91999998888");
    expect(msg).toContain("07/03/1948");
    expect(msg).toContain("Direito");
    expect(msg).toContain("Particular (YAG)");
    expect(msg).toContain("Hospital Geral de Paragominas");
    expect(msg).toMatch(/por olho tratado/i);
  });

  it("não inventa valor", () => {
    expect(montarResumoLeadYag(base)).not.toMatch(/R\$|\bRS\s*\d/i);
  });

  it("omite linhas sem dado em vez de mostrar vazio", () => {
    const msg = montarResumoLeadYag({ nome: "João Souza", telefone: "" });
    expect(msg).toContain("João Souza");
    expect(msg).not.toContain("Nascimento:");
    expect(msg).not.toContain("Olho operado:");
    expect(msg).not.toContain("WhatsApp:");
    expect(msg).not.toMatch(/undefined|null/);
  });

  it("avisa quando a mensagem não chegou ao paciente", () => {
    const msg = montarResumoLeadYag({ ...base, pacienteAvisado: false });
    expect(msg).toMatch(/NÃO chegou ao paciente/i);
  });

  it("não polui o aviso quando o paciente foi avisado", () => {
    const msg = montarResumoLeadYag({ ...base, pacienteAvisado: true });
    expect(msg).not.toMatch(/NÃO chegou/i);
  });
});
