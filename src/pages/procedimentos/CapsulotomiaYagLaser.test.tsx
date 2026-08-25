import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { YAG_SEO } from "./CapsulotomiaYagLaser";
import YagSchedulingForm from "@/components/procedimentos/yag/YagSchedulingForm";
import {
  dataBrParaIso,
  limparRotuloConvenio,
  mascararData,
  mascararTelefone,
  montarDetalhe,
  validarFormulario,
  valorConvenioCrm,
  type YagFormValues,
} from "@/components/procedimentos/yag/yagFormUtils";
import {
  AVISO_AMBOS_OLHOS,
  AVISO_POR_OLHO,
  FAQS,
  LOCAL_ATENDIMENTO,
  SECTIONS,
  TIPO_ATENDIMENTO,
  VALOR_YAG,
  VALOR_YAG_COMPLETO,
  WHATSAPP_MENSAGEM,
} from "@/components/procedimentos/yag/yagContent";

// ---------------------------------------------------------------------------
// Mocks — o formulário fala com Supabase (leads/convênios) e com tracking.
// ---------------------------------------------------------------------------
const criarLeadMock = vi.fn();

vi.mock("@/services/leads", () => ({
  criarLead: (...args: unknown[]) => criarLeadMock(...args),
}));

vi.mock("@/services/convenios", () => ({
  listarConvenios: () => Promise.resolve({ data: [], error: null }),
}));

const invokeMock = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ data: null, error: null }),
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

vi.mock("@/hooks/useSiteWhatsApp", () => ({
  useSiteWhatsApp: () => ({
    raw: "5591936180476",
    display: "(91) 93618-0476",
    telLink: "tel:+5591936180476",
    waLink: (message?: string, origem?: string) =>
      `https://wa.me/5591936180476?text=${encodeURIComponent(
        `${message ?? ""}${origem ? ` (origem: ${origem})` : ""}`,
      )}`,
    waLinkBare: "https://wa.me/5591936180476",
    loaded: true,
  }),
}));

vi.mock("@/hooks/useGoogleTag", () => ({
  useGoogleTag: () => ({
    trackLead: vi.fn(),
    trackFormSubmitConversion: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMetaPixel", () => ({
  useMetaPixel: () => ({ trackLead: vi.fn() }),
}));

const renderForm = () =>
  render(
    <MemoryRouter>
      <YagSchedulingForm />
    </MemoryRouter>,
  );

const VALORES_VALIDOS: YagFormValues = {
  nome: "Maria Oliveira",
  dataNascimento: "07/03/1948",
  telefone: "(91) 99999-9999",
  olho: "Direito",
  convenio: "",
};

/** Preenche os campos obrigatórios com dados sintéticos. */
const preencher = (olho: string) => {
  fireEvent.change(screen.getByLabelText(/nome completo/i), {
    target: { value: "Maria Oliveira" },
  });
  fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
    target: { value: "07031948" },
  });
  fireEvent.change(screen.getByLabelText(/whatsapp para contato/i), {
    target: { value: "91999998888" },
  });
  fireEvent.click(screen.getByRole("button", { name: olho }));
};

const enviar = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /solicitar agendamento/i }),
  );

beforeEach(() => {
  criarLeadMock.mockReset();
  criarLeadMock.mockResolvedValue({ lead_id: "lead-abc-123", error: null });
  invokeMock.mockClear();
});

// ---------------------------------------------------------------------------
// SEO / local do procedimento
// ---------------------------------------------------------------------------
describe("Metadados da página YAG", () => {
  const camposDeTexto = [
    YAG_SEO.pageTitle,
    YAG_SEO.metaDescription,
    YAG_SEO.h1,
    YAG_SEO.intro,
  ];

  it("comunica Paragominas em title, H1, descrição e introdução", () => {
    for (const campo of camposDeTexto) {
      expect(campo).toMatch(/Paragominas/i);
    }
    expect(YAG_SEO.h1).toMatch(/em Paragominas/i);
    expect(YAG_SEO.pageTitle).toMatch(/em Paragominas/i);
  });

  it("não menciona Belém em lugar nenhum dos metadados", () => {
    for (const campo of camposDeTexto) {
      expect(campo).not.toMatch(/Bel[eé]m/i);
      expect(campo).not.toMatch(/IOB|Vitria/i);
    }
  });

  it("aponta o Hospital Geral de Paragominas como local", () => {
    expect(YAG_SEO.local).toBe("Hospital Geral de Paragominas");
    expect(YAG_SEO.cidade).toBe("Paragominas");
    expect(YAG_SEO.metaDescription).toMatch(/HGP/);
  });

  it("mantém a mesma URL de antes", () => {
    expect(YAG_SEO.slug).toBe("capsulotomia-yag-laser");
  });
});

// ---------------------------------------------------------------------------
// Máscaras e validação (funções puras)
// ---------------------------------------------------------------------------
describe("Máscaras do formulário", () => {
  it("formata a data enquanto digita", () => {
    expect(mascararData("07")).toBe("07");
    expect(mascararData("0703")).toBe("07/03");
    expect(mascararData("07031948")).toBe("07/03/1948");
    expect(mascararData("070319489999")).toBe("07/03/1948");
  });

  it("formata o telefone enquanto digita", () => {
    expect(mascararTelefone("91")).toBe("(91");
    expect(mascararTelefone("91999")).toBe("(91) 999");
    expect(mascararTelefone("91999998888")).toBe("(91) 99999-8888");
  });

  it("converte data BR para ISO e rejeita data inexistente", () => {
    expect(dataBrParaIso("07/03/1948")).toBe("1948-03-07");
    expect(dataBrParaIso("31/02/2020")).toBe("");
    expect(dataBrParaIso("07/03")).toBe("");
  });
});

describe("Validação do formulário", () => {
  it("aceita um preenchimento válido", () => {
    expect(validarFormulario(VALORES_VALIDOS)).toEqual({});
  });

  it("exige nome, data, telefone e olho", () => {
    const erros = validarFormulario({
      nome: "",
      dataNascimento: "",
      telefone: "",
      olho: "",
      convenio: "",
    });
    expect(erros.nome).toBeTruthy();
    expect(erros.dataNascimento).toBeTruthy();
    expect(erros.telefone).toBeTruthy();
    expect(erros.olho).toBeTruthy();
  });

  it("não exige convênio", () => {
    const erros = validarFormulario({ ...VALORES_VALIDOS, convenio: "" });
    expect(erros).not.toHaveProperty("convenio");
  });

  it("rejeita nome sem sobrenome", () => {
    expect(
      validarFormulario({ ...VALORES_VALIDOS, nome: "Maria" }).nome,
    ).toBeTruthy();
  });

  it("rejeita data inválida e data no futuro", () => {
    expect(
      validarFormulario({ ...VALORES_VALIDOS, dataNascimento: "31/02/2020" })
        .dataNascimento,
    ).toBeTruthy();

    const futuro = new Date();
    futuro.setFullYear(futuro.getFullYear() + 1);
    const dd = String(futuro.getDate()).padStart(2, "0");
    const mm = String(futuro.getMonth() + 1).padStart(2, "0");
    expect(
      validarFormulario({
        ...VALORES_VALIDOS,
        dataNascimento: `${dd}/${mm}/${futuro.getFullYear()}`,
      }).dataNascimento,
    ).toMatch(/futuro/i);
  });

  it("rejeita telefone incompleto", () => {
    expect(
      validarFormulario({ ...VALORES_VALIDOS, telefone: "(91) 9999" }).telefone,
    ).toBeTruthy();
  });
});

describe("Valores exibidos na página", () => {
  it("remove o preço embutido no nome do convênio", () => {
    expect(limparRotuloConvenio("Particular - R$: 300,00")).toBe("Particular");
    expect(limparRotuloConvenio("Particular – R$ 300")).toBe("Particular");
    expect(limparRotuloConvenio("Particular — RS 300.00")).toBe("Particular");
    expect(limparRotuloConvenio("Particular: R$250")).toBe("Particular");
  });

  it("separa o particular do YAG do particular da consulta no CRM", () => {
    // O paciente lê "Particular"; o CRM precisa distinguir, porque o valor da
    // consulta está definido e o do YAG é por olho e ainda será combinado.
    expect(limparRotuloConvenio("Particular - R$: 300,00")).toBe("Particular");
    expect(valorConvenioCrm("Particular")).toBe("Particular (YAG)");
    expect(valorConvenioCrm("particular")).toBe("Particular (YAG)");
  });

  it("não marca os demais convênios com o sufixo do YAG", () => {
    for (const nome of ["Unimed", "Sul América", "Bradesco", "Outros"]) {
      expect(valorConvenioCrm(nome)).toBe(nome);
    }
  });

  it("não altera convênios sem valor no nome", () => {
    for (const nome of ["Unimed", "Sul América", "Saúde Caixa", "Bradesco"]) {
      expect(limparRotuloConvenio(nome)).toBe(nome);
    }
  });

  it("publica o valor do particular como R$ 850,00 por olho", () => {
    expect(VALOR_YAG).toBe("R$ 850,00");
    expect(VALOR_YAG_COMPLETO).toBe("R$ 850,00 por olho");
    expect(AVISO_POR_OLHO).toContain(VALOR_YAG);
    expect(AVISO_POR_OLHO).toMatch(/por olho/i);
  });

  it("deixa claro que a cobranca e por olho, nao por sessao", () => {
    // Quem trata os dois olhos paga duas vezes. Se essa frase sumir, o
    // paciente que marca "Ambos" e surpreendido depois.
    expect(AVISO_AMBOS_OLHOS).toContain(VALOR_YAG);
    expect(AVISO_AMBOS_OLHOS).toMatch(/cada um|separadamente/i);
    const faqValor = FAQS.map((f) => f.answer).join(" ");
    expect(faqValor).toContain(VALOR_YAG);
    expect(faqValor).toMatch(/por olho/i);
  });

  it("nunca expoe o valor da CONSULTA (R$ 300) na pagina do YAG", () => {
    // O R$ 300 vive embutido no nome do convenio "Particular - R$: 300,00" e
    // e o preco da consulta, nao do YAG. Nao pode vazar para esta pagina.
    const textos = [
      YAG_SEO.pageTitle,
      YAG_SEO.metaDescription,
      YAG_SEO.h1,
      YAG_SEO.intro,
      AVISO_POR_OLHO,
      AVISO_AMBOS_OLHOS,
      limparRotuloConvenio("Particular - R$: 300,00"),
      ...FAQS.map((f) => `${f.question} ${f.answer}`),
      ...SECTIONS.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/300/);
    }
  });

  it("mostra o valor junto ao campo de olho operado", () => {
    renderForm();
    expect(screen.getByText(AVISO_POR_OLHO)).toBeInTheDocument();
  });

  it("reforça o aviso quando o paciente marca Ambos", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Ambos" }));
    expect(screen.getByText(AVISO_AMBOS_OLHOS)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_POR_OLHO)).not.toBeInTheDocument();
  });
});

describe("Registro do olho operado", () => {
  it("monta o texto que vai para o campo Detalhe do CRM", () => {
    expect(montarDetalhe("Direito")).toBe(
      "Capsulotomia YAG Laser — Olho: Direito",
    );
    expect(montarDetalhe("Ambos")).toBe("Capsulotomia YAG Laser — Olho: Ambos");
  });
});

// ---------------------------------------------------------------------------
// Comportamento do formulário
// ---------------------------------------------------------------------------
describe("Formulário de agendamento do YAG", () => {
  it("bloqueia o envio e mostra erros quando está vazio", async () => {
    renderForm();
    enviar();

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(criarLeadMock).not.toHaveBeenCalled();
  });

  it("envia o lead com tipo, local e olho corretos", async () => {
    renderForm();
    preencher("Direito");
    enviar();

    await waitFor(() => expect(criarLeadMock).toHaveBeenCalledTimes(1));

    expect(criarLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_completo: "Maria Oliveira",
        data_nascimento: "1948-03-07",
        tipo_atendimento: TIPO_ATENDIMENTO,
        local_atendimento: LOCAL_ATENDIMENTO,
        detalhe_exame_ou_cirurgia: "Capsulotomia YAG Laser — Olho: Direito",
        convenio: "Não informado",
      }),
    );
  });

  it("mostra o aviso de que não é agendamento confirmado após enviar", async () => {
    renderForm();
    preencher("Ambos");
    enviar();

    await waitFor(() =>
      expect(
        screen.getByText(/não é um agendamento confirmado/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/datas dispon[ií]veis e a cobertura do seu conv[eê]nio/i),
    ).toBeInTheDocument();
  });

  it("notifica a equipe por e-mail com os dados do paciente", async () => {
    renderForm();
    preencher("Direito");
    enviar();

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    expect(invokeMock).toHaveBeenCalledWith(
      "notificar-agendamento-email",
      expect.objectContaining({
        body: expect.objectContaining({
          nome_completo: "Maria Oliveira",
          telefone_whatsapp: "(91) 99999-8888",
          data_nascimento: "1948-03-07",
          tipo_atendimento: TIPO_ATENDIMENTO,
          local_atendimento: LOCAL_ATENDIMENTO,
          detalhe_exame_ou_cirurgia: "Capsulotomia YAG Laser — Olho: Direito",
          // sem data marcada: a função de e-mail trata como "Novo Lead"
          data_agendamento: "",
        }),
      }),
    );
  });

  it("não notifica quando o lead não foi criado", async () => {
    criarLeadMock.mockResolvedValue({ lead_id: null, error: new Error("x") });
    renderForm();
    preencher("Direito");
    enviar();

    await waitFor(() =>
      expect(screen.getByText(/não conseguimos enviar agora/i)).toBeInTheDocument(),
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("oferece o WhatsApp como plano B quando o envio falha", async () => {
    criarLeadMock.mockResolvedValue({
      lead_id: null,
      error: new Error("falhou"),
    });
    renderForm();
    preencher("Esquerdo");
    enviar();

    await waitFor(() =>
      expect(
        screen.getByText(/não conseguimos enviar agora/i),
      ).toBeInTheDocument(),
    );
  });
});

describe("Links de WhatsApp", () => {
  it("a mensagem padrão não carrega dado pessoal", () => {
    const proibidos = ["nome", "cpf", "nascimento", "olho", "email", "telefone"];
    for (const termo of proibidos) {
      expect(WHATSAPP_MENSAGEM.toLowerCase()).not.toContain(termo);
    }
  });

  it("nenhum link de WhatsApp inclui os dados digitados", () => {
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: "Maria Oliveira" },
    });
    fireEvent.change(screen.getByLabelText(/whatsapp para contato/i), {
      target: { value: "91999998888" },
    });

    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"]'),
    );
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = decodeURIComponent(link.href);
      expect(href).not.toContain("Maria");
      expect(href).not.toContain("999998888");
      expect(href).not.toContain("1948");
    }
  });
});
