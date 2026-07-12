import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Rastreamento: garantir que hooks são invocados sem PII e sem procedimento médico.
const trackCTAClickMock = vi.fn();
const trackWhatsAppClickMock = vi.fn();
vi.mock("@/hooks/useGoogleTag", () => ({
  useGoogleTag: () => ({
    trackCTAClick: trackCTAClickMock,
    trackWhatsAppClick: trackWhatsAppClickMock,
    trackPhoneClick: vi.fn(),
  }),
}));
vi.mock("@/hooks/useMetaPixel", () => ({
  useMetaPixel: () => ({ trackContact: vi.fn() }),
}));

// Dados dinâmicos vindos de site_config — mockar retorno vazio para usar fallback.
vi.mock("@/hooks/useGoogleReviews", () => ({
  useGoogleReviews: () => ({ rating: 5.0, count: 14, hasRealAggregate: true }),
}));

// Serviço de avaliações — devolve pool vazio para não depender de rede.
vi.mock("@/services/avaliacoesGoogle", () => ({
  buscarAvaliacoesGoogle: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useSiteWhatsApp", () => ({
  useSiteWhatsApp: () => ({
    waLink: (msg: string) => `https://wa.me/5591991150174?text=${encodeURIComponent(msg)}`,
    waLinkBare: "https://wa.me/5591991150174",
    display: "(91) 99115-0174",
    raw: "5591991150174",
  }),
}));

import Paragominas from "./Paragominas";
import { buildAgendamentoLink } from "@/lib/agendamentoLink";

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/paragominas"]}>
          <Paragominas />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  trackCTAClickMock.mockClear();
  trackWhatsAppClickMock.mockClear();
  window.history.replaceState({}, "", "/paragominas");
});

describe("Paragominas landing page", () => {
  it("renderiza H1 focado em Paragominas e CRM-PA 15253", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Paragominas/i);
    expect(screen.getAllByText(/CRM-PA 15253/i).length).toBeGreaterThan(0);
  });

  it("não menciona YAG / Capsulotomia (procedimento exclusivo de Belém)", () => {
    renderPage();
    const main = screen.getByRole("main");
    expect(main.textContent || "").not.toMatch(/YAG/i);
    expect(main.textContent || "").not.toMatch(/Capsulotomia/i);
  });

  it("apresenta apenas os 2 locais em Paragominas (sem Belém na landing)", () => {
    renderPage();
    expect(screen.getAllByText(/Clinicor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hospital Geral de Paragominas/i).length).toBeGreaterThan(0);
    const main = screen.getByRole("main");
    expect(main.textContent || "").not.toMatch(/Bel[eé]m/i);
  });

  it("renderiza foto do Dr. Juliano no hero com alt descritivo", () => {
    renderPage();
    const imgs = screen.getAllByAltText(/Dr\. Juliano Machado/i) as HTMLImageElement[];
    expect(imgs.length).toBeGreaterThan(0);
    const hero = imgs[0];
    expect(hero.getAttribute("width")).toBeTruthy();
    expect(hero.getAttribute("height")).toBeTruthy();
    expect(hero.getAttribute("fetchpriority")).toBe("high");
  });

  it("CTAs específicos da landing carregam UTMs internas da campanha paragominas", () => {
    renderPage();
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/agendamento"]'));
    // Filtra apenas links desta landing (utm_campaign=paragominas). O componente
    // reutilizado AgendarSimplesSection tem seus próprios UTMs — não é regressão.
    const landing = anchors.filter((a) => a.href.includes("utm_campaign=paragominas"));
    expect(landing.length).toBeGreaterThanOrEqual(3);
    for (const a of landing) {
      expect(a.href).toContain("utm_source=site");
      expect(a.href).toContain("utm_medium=landing");
    }
    const contents = landing.map((a) => new URL(a.href).searchParams.get("utm_content"));
    expect(contents).toEqual(
      expect.arrayContaining(["hero_paragominas", "header_paragominas", "final_paragominas"])
    );
  });

  it("canonical, title e og:url apontam para /paragominas", async () => {
    renderPage();
    // Helmet aplica assíncronamente ao document.head.
    await new Promise((r) => setTimeout(r, 50));
    expect(document.title).toMatch(/Oftalmologista em Paragominas/i);
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toBe("https://drjulianomachado.com/paragominas");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    expect(ogUrl?.getAttribute("content")).toBe("https://drjulianomachado.com/paragominas");
  });
});

describe("buildAgendamentoLink", () => {
  beforeEach(() => window.history.replaceState({}, "", "/paragominas"));

  it("aplica defaults internos quando a URL não traz UTMs", () => {
    const url = buildAgendamentoLink({ utm_content: "hero_paragominas" });
    expect(url).toContain("utm_source=site");
    expect(url).toContain("utm_medium=landing");
    expect(url).toContain("utm_campaign=paragominas");
    expect(url).toContain("utm_content=hero_paragominas");
  });

  it("preserva UTMs externas e não as sobrescreve", () => {
    window.history.replaceState({}, "", "/paragominas?utm_source=google&utm_medium=cpc&utm_campaign=ads_pgm&gclid=ABC");
    const url = buildAgendamentoLink({ utm_content: "hero_paragominas" });
    const params = new URL("https://x.test" + url).searchParams;
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("utm_medium")).toBe("cpc");
    expect(params.get("utm_campaign")).toBe("ads_pgm");
    expect(params.get("gclid")).toBe("ABC");
    expect(params.get("utm_content")).toBe("hero_paragominas");
  });

  it("não inclui dados médicos/PII em nenhum parâmetro", () => {
    const url = buildAgendamentoLink({ utm_content: "hero_paragominas" });
    const forbidden = ["nome", "email", "telefone", "cpf", "catarata", "glaucoma", "pterigio", "yag", "capsulotomia"];
    for (const term of forbidden) {
      expect(url.toLowerCase()).not.toContain(term);
    }
  });
});
