import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import CapsulotomiaYagLaser from "./CapsulotomiaYagLaser";

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <CapsulotomiaYagLaser />
      </MemoryRouter>
    </HelmetProvider>
  );

describe("CapsulotomiaYagLaser page", () => {
  it("comunica apenas Belém no H1 e não usa 'Paragominas e Belém' em copy de localização", () => {
    const { container } = renderPage();
    const h1 = container.querySelector("h1");
    expect(h1?.textContent ?? "").toMatch(/Belém/i);
    expect(h1?.textContent ?? "").not.toMatch(/Paragominas/i);

    const text = container.textContent ?? "";
    // Nenhuma frase deve dizer "Paragominas e Belém" nesta página.
    expect(text).not.toMatch(/Paragominas e Belém/i);
    // Deve informar explicitamente que o procedimento é em Belém.
    expect(text).toMatch(/em Belém/i);
  });
});
