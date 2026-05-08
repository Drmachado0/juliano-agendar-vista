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
  });

  it("não dispara nem marca como fired sem consentimento", () => {
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);
    expect(window.sessionStorage.getItem("obrigado_tracking_fired_v1")).toBeNull();
  });

  it("dispara os 4 eventos com event_id e meta_event_id iguais quando há consentimento", () => {
    grantConsent();
    renderPage();

    const dl = (window as any).dataLayer as Array<Record<string, unknown>>;
    const events = dl.map((p) => p.event);
    expect(events).toEqual([
      "thank_you_page_view",
      "google_ads_conversion",
      "meta_lead",
      "meta_complete_registration",
    ]);

    const ids = dl.map((p) => p.event_id);
    const metaIds = dl.map((p) => p.meta_event_id);
    expect(new Set(ids).size).toBe(1);
    expect(ids).toEqual(metaIds);

    const ads = dl.find((p) => p.event === "google_ads_conversion")!;
    expect(ads.send_to).toBe("AW-436492720/tUOICNX06JwcELCzkdAB");
    expect(ads.value).toBe(300);
    expect(ads.currency).toBe("BRL");
  });

  it("dispara após o evento lgpd-consent-changed quando o usuário aceita depois", () => {
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);

    grantConsent();
    window.dispatchEvent(new Event("lgpd-consent-changed"));

    expect((window as any).dataLayer.length).toBe(4);
    expect(window.sessionStorage.getItem("obrigado_tracking_fired_v1")).toBe("1");
  });

  it("não dispara novamente após reload (sessionStorage persiste)", () => {
    grantConsent();
    renderPage();
    expect((window as any).dataLayer.length).toBe(4);

    (window as any).dataLayer = [];
    renderPage();
    expect((window as any).dataLayer.length).toBe(0);
  });
});
