import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Obrigado from "./Obrigado";

vi.mock("@/hooks/useGoogleTag", () => ({
  useGoogleTag: () => ({
    trackWhatsAppClick: vi.fn(),
    trackWhatsAppGoogleAdsConversion: vi.fn(),
  }),
}));
vi.mock("@/hooks/useMetaPixel", () => ({
  useMetaPixel: () => ({ trackContact: vi.fn() }),
}));

// Mock do cliente Supabase para evitar chamada real ao Meta CAPI durante os testes.
// O contrato de produção envia Lead/CompleteRegistration via CAPI server-side
// (não via dataLayer/Pixel browser-side, pois eventos médicos são "restricted").
const invokeMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <Obrigado />
      </MemoryRouter>
    </HelmetProvider>
  );

const grantConsent = () => {
  window.localStorage.setItem(
    "lgpd-consent",
    JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
      version: "1.0",
    })
  );
};

describe("Obrigado page tracking", () => {
  beforeEach(() => {
    (window as any).dataLayer = [];
    window.sessionStorage.clear();
    window.localStorage.clear();
    invokeMock.mockClear();
  });

  it("não dispara nem marca como fired sem consentimento", () => {
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);
    expect(window.sessionStorage.getItem("obrigado_tracking_fired_v1")).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("dispara 2 eventos no dataLayer (thank_you_page_view + google_ads_conversion) com event_id/meta_event_id iguais e envia Lead+CompleteRegistration via CAPI server-side", () => {
    grantConsent();
    renderPage();

    const dl = (window as any).dataLayer as Array<Record<string, unknown>>;
    const events = dl.map((p) => p.event);
    // Contrato: eventos Meta Lead/CompleteRegistration NÃO vão via dataLayer/Pixel
    // (rejeitados em contexto médico). Vão exclusivamente via Meta CAPI server-side.
    expect(events).toEqual(["thank_you_page_view", "google_ads_conversion"]);

    const ids = dl.map((p) => p.event_id);
    const metaIds = dl.map((p) => p.meta_event_id);
    expect(new Set(ids).size).toBe(1);
    expect(ids).toEqual(metaIds);

    const ads = dl.find((p) => p.event === "google_ads_conversion")!;
    expect(ads.send_to).toBe("AW-436492720/tUOICNX06JwcELCzkdAB");
    expect(ads.value).toBe(300);
    expect(ads.currency).toBe("BRL");

    // Meta CAPI recebe Lead e CompleteRegistration com o mesmo event_id (dedup)
    expect(invokeMock).toHaveBeenCalledTimes(2);
    const capiCalls = invokeMock.mock.calls.map(([fn, opts]: any) => ({
      fn,
      event_name: opts?.body?.event_name,
      event_id: opts?.body?.event_id,
    }));
    expect(capiCalls.map((c) => c.fn)).toEqual(["meta-capi", "meta-capi"]);
    expect(capiCalls.map((c) => c.event_name).sort()).toEqual([
      "CompleteRegistration",
      "Lead",
    ]);
    expect(new Set(capiCalls.map((c) => c.event_id)).size).toBe(1);
    expect(capiCalls[0].event_id).toBe(ids[0]);
  });

  it("dispara após o evento lgpd-consent-changed quando o usuário aceita depois", () => {
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);

    grantConsent();
    window.dispatchEvent(new Event("lgpd-consent-changed"));

    expect((window as any).dataLayer.length).toBe(2);
    expect(window.sessionStorage.getItem("obrigado_tracking_fired_v1")).toBe("1");
  });

  it("não dispara novamente após reload (sessionStorage persiste)", () => {
    grantConsent();
    renderPage();
    expect((window as any).dataLayer.length).toBe(2);

    (window as any).dataLayer = [];
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);
  });
});
