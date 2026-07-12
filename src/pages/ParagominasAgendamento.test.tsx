import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ParagominasAgendamento from "./ParagominasAgendamento";

// Silencia dependências externas do fluxo (Supabase, integrações) no ambiente
// de teste — não fazemos submit real.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));
vi.mock("@/services/leads", () => ({
  criarLead: vi.fn().mockResolvedValue({ lead_id: null, error: null }),
  converterLeadEmAgendamento: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/services/integracoes", () => ({
  notificarN8n: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/clinicas", () => ({
  listarClinicas: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/services/tiposAtendimento", () => ({
  listarTiposAtendimento: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/hooks/useMetaPixel", () => ({
  useMetaPixel: () => ({
    trackViewContent: vi.fn(),
    trackLead: vi.fn(),
    trackSchedule: vi.fn(),
    trackCompleteRegistration: vi.fn(),
    trackContact: vi.fn(),
  }),
}));
vi.mock("@/hooks/useGoogleTag", () => ({
  useGoogleTag: () => ({
    trackScheduleComplete: vi.fn(),
    trackFormSubmitConversion: vi.fn(),
    trackWhatsAppClick: vi.fn(),
    trackWhatsAppGoogleAdsConversion: vi.fn(),
    trackFormStart: vi.fn(),
    trackStepCompleted: vi.fn(),
    trackAppointmentError: vi.fn(),
    trackAppointmentSuccess: vi.fn(),
  }),
}));

const wrap = (initialPath = "/paragominas/agendamento") => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <ParagominasAgendamento />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

describe("/paragominas/agendamento — shell premium", () => {
  beforeEach(() => {
    (window as any).dataLayer = [];
  });

  it("renderiza o H1 'Vamos cuidar do seu agendamento.'", () => {
    wrap();
    expect(
      screen.getByRole("heading", { level: 1, name: /vamos cuidar do seu agendamento/i }),
    ).toBeInTheDocument();
  });

  it("expõe navegação por etapas com rótulos e aria-current na atual", () => {
    wrap();
    const nav = screen.getByRole("navigation", { name: /etapas do agendamento/i });
    expect(nav).toBeInTheDocument();
    const currentStep = nav.querySelector('[aria-current="step"]');
    expect(currentStep?.textContent?.toLowerCase()).toContain("dados");
  });

  it("aplica o tema premium no container raiz", () => {
    const { container } = wrap();
    const root = container.querySelector(".theme-paragominas-premium.theme-paragominas-agendamento");
    expect(root).not.toBeNull();
  });

  it("dispara evento booking_view com experience_variant=paragominas_premium", () => {
    wrap();
    const evt = (window as any).dataLayer.find((e: any) => e.event === "booking_view");
    expect(evt).toBeTruthy();
    expect(evt.experience_variant).toBe("paragominas_premium");
  });

  it("link 'Voltar' aponta para /paragominas (preserva navegação da landing)", () => {
    wrap();
    const links = screen.getAllByRole("link", { name: /voltar/i });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) {
      expect(l.getAttribute("href")).toContain("/paragominas");
      expect(l.getAttribute("href")).not.toContain("/paragominas/agendamento");
    }
  });
});
