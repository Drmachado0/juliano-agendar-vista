import { describe, it, expect } from "vitest";
// Testa contrato de conteúdo/metadados da página YAG sem montar o layout
// completo (que exige APIs de browser). Garante que a página comunica apenas
// Belém — o procedimento é exclusivo dessa cidade.
import CapsulotomiaYagLaser from "./CapsulotomiaYagLaser";

// Extrai o objeto de dados exportado pelo módulo via require interno.
// A página é `const Page = () => <ProcedurePageLayout data={data} />`, então
// re-importamos o módulo e inspecionamos as strings via ReactElement.
import { createElement } from "react";

describe("CapsulotomiaYagLaser page metadata", () => {
  const rendered = (CapsulotomiaYagLaser as unknown as () => ReturnType<typeof createElement>)() as {
    props: { data: Record<string, unknown> };
  };
  const data = rendered.props.data as {
    pageTitle: string;
    metaDescription: string;
    h1: string;
    intro: string;
    locations?: { label: string; ctaSuffix: string; sidebarItems: string[] };
  };

  it("não menciona 'Paragominas e Belém' em title/H1/descrição/intro", () => {
    for (const field of [data.pageTitle, data.metaDescription, data.h1, data.intro]) {
      expect(field).not.toMatch(/Paragominas e Belém/i);
      expect(field).not.toMatch(/Paragominas/i);
    }
  });

  it("H1 e title comunicam explicitamente 'em Belém'", () => {
    expect(data.h1).toMatch(/em Belém/i);
    expect(data.pageTitle).toMatch(/em Belém/i);
  });

  it("locations override restringe exibição a Belém (chip, sidebar e CTA final)", () => {
    expect(data.locations?.label).toBe("Belém");
    expect(data.locations?.ctaSuffix).toBe("Belém");
    expect(data.locations?.sidebarItems.join(" ")).not.toMatch(/Paragominas/i);
    expect(data.locations?.sidebarItems.join(" ")).toMatch(/Belém/i);
  });
});
