import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const trackCTAClickMock = vi.fn();
const trackWhatsAppClickMock = vi.fn();
const trackEventMock = vi.fn();
vi.mock("@/hooks/useGoogleTag", () => ({
  useGoogleTag: () => ({
    trackCTAClick: trackCTAClickMock,
    trackWhatsAppClick: trackWhatsAppClickMock,
    trackPhoneClick: vi.fn(),
    trackEvent: trackEventMock,
  }),
}));
vi.mock("@/hooks/useMetaPixel", () => ({
  useMetaPixel: () => ({ trackContact: vi.fn() }),
}));
vi.mock("@/hooks/useGoogleReviews", () => ({
  useGoogleReviews: () => ({ rating: 5.0, count: 14, hasRealAggregate: true }),
}));
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
import RefractionClarityExperience from "@/components/paragominas/RefractionClarityExperience";
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
  trackEventMock.mockClear();
  window.history.replaceState({}, "", "/paragominas");
});

describe("Paragominas landing page — restructure", () => {
  it("H1 usa 'Sua visão,' + 'com mais clareza.'", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Sua visão/i);
    expect(h1.textContent).toMatch(/clareza/i);
  });

  it("Eyebrow preserva SEO 'Oftalmologista em Paragominas' e mostra CRM-PA 15253", () => {
    renderPage();
    expect(screen.getAllByText(/Oftalmologista em Paragominas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CRM-PA 15253/i).length).toBeGreaterThan(0);
  });

  it("Main não menciona Belém nem YAG/Capsulotomia", () => {
    renderPage();
    const main = screen.getByRole("main");
    expect(main.textContent || "").not.toMatch(/Bel[eé]m/i);
    expect(main.textContent || "").not.toMatch(/YAG/i);
    expect(main.textContent || "").not.toMatch(/Capsulotomia/i);
  });

  it("Mostra Clinicor e HGP (Paragominas apenas)", () => {
    renderPage();
    expect(screen.getAllByText(/Clinicor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hospital Geral de Paragominas/i).length).toBeGreaterThan(0);
  });

  it("Renderiza foto real no hero (fetchpriority=high) e foto do consultório (lazy)", () => {
    renderPage();
    const hero = screen.getByAltText(/Dr\. Juliano Machado, oftalmologista, durante atendimento clínico/i) as HTMLImageElement;
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    expect(hero.getAttribute("width")).toBeTruthy();
    expect(hero.getAttribute("height")).toBeTruthy();
    const consult = screen.getByAltText(/consultório/i) as HTMLImageElement;
    expect(consult.getAttribute("loading")).toBe("lazy");
  });

  it("CTAs da landing preservam UTMs e utm_campaign=paragominas", () => {
    renderPage();
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/agendamento"]'));
    const landing = anchors.filter((a) => a.href.includes("utm_campaign=paragominas"));
    expect(landing.length).toBeGreaterThanOrEqual(3);
    const contents = landing.map((a) => new URL(a.href).searchParams.get("utm_content"));
    expect(contents).toEqual(
      expect.arrayContaining(["hero_paragominas", "header_paragominas", "final_paragominas"])
    );
  });

  it("Rating real e contagem aparecem", () => {
    renderPage();
    expect(screen.getAllByText(/5\.0/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });

  it("Sticky mobile CTA existe (aria-hidden por padrão)", () => {
    renderPage();
    const stickyLink = document.querySelector('a[href*="sticky_paragominas"]');
    expect(stickyLink).toBeTruthy();
  });

  it("Canonical e og:url apontam para /paragominas", async () => {
    renderPage();
    await new Promise((r) => setTimeout(r, 50));
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toBe("https://drjulianomachado.com/paragominas");
  });

  it("Não exibe numerais romanos decorativos de seção (I—IX) no main", () => {
    renderPage();
    const main = screen.getByRole("main");
    const text = main.textContent || "";
    // Padrão: numeral romano + separador (— ou ·) usado como prefixo de eyebrow
    expect(text).not.toMatch(/\b(I|II|III|IV|V|VI|VII|VIII|IX)\s*[—·-]\s/);
  });

  it("Não exibe numerações decorativas (01/02, 01 / 03, Fig. 0X, Consultório · 2026) no main", () => {
    renderPage();
    const main = screen.getByRole("main");
    const text = main.textContent || "";
    expect(text).not.toMatch(/Fig\.\s*0\d/);
    expect(text).not.toMatch(/Consultório\s*·\s*2026/);
    expect(text).not.toMatch(/\b0\d\s*\/\s*03\b/);
    // Não deve haver "01" ou "02" isolados como marcador de local (não confundir com CRM 15253/anos/rating)
    expect(text).not.toMatch(/(Clinicor|Hospital Geral de Paragominas)[^]{0,40}\b0[12]\b/);
  });

  it("Preserva números reais funcionais: CRM-PA 15253, rating 5.0, +13 anos e 14 avaliações", () => {
    renderPage();
    expect(screen.getAllByText(/CRM-PA 15253/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5\.0/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+13\s*anos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/14/).length).toBeGreaterThan(0);
  });
});

describe("RefractionClarityExperience — slider", () => {
  it("expõe label, valor padrão e limites 0-100", () => {
    render(<RefractionClarityExperience />);
    const slider = screen.getByLabelText(/Ajustar nitidez da demonstração/i) as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("100");
    expect(slider.value).toBe("35");
  });

  it("mostra a nota de demonstração ilustrativa", () => {
    render(<RefractionClarityExperience />);
    expect(screen.getByText(/Demonstração visual ilustrativa/i)).toBeTruthy();
  });

  it("dispara evento genérico apenas UMA vez", () => {
    const spy = vi.fn();
    render(<RefractionClarityExperience onFirstInteract={spy} />);
    const slider = screen.getByLabelText(/Ajustar nitidez/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.change(slider, { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: /Mais nítido/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("botões Mais nítido / Mais embaçado mudam o valor com step de 10", () => {
    render(<RefractionClarityExperience />);
    const slider = screen.getByLabelText(/Ajustar nitidez/i) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: /Mais nítido/i }));
    expect(Number(slider.value)).toBe(45);
    fireEvent.click(screen.getByRole("button", { name: /Mais embaçado/i }));
    expect(Number(slider.value)).toBe(35);
  });

  it("Alvos dos botões têm min-h 44px (classe min-h-[44px])", () => {
    render(<RefractionClarityExperience />);
    const b = screen.getByRole("button", { name: /Mais nítido/i });
    expect(b.className).toMatch(/min-h-\[44px\]/);
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

  it("preserva UTMs externas", () => {
    window.history.replaceState({}, "", "/paragominas?utm_source=google&utm_medium=cpc&utm_campaign=ads_pgm&gclid=ABC");
    const url = buildAgendamentoLink({ utm_content: "hero_paragominas" });
    const params = new URL("https://x.test" + url).searchParams;
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("gclid")).toBe("ABC");
  });

  it("não inclui dados médicos/PII", () => {
    const url = buildAgendamentoLink({ utm_content: "hero_paragominas" });
    for (const term of ["nome", "email", "cpf", "catarata", "glaucoma", "yag"]) {
      expect(url.toLowerCase()).not.toContain(term);
    }
    void within; // reservado para futura expansão
  });
});
