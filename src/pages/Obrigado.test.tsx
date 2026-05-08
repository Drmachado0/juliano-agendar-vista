import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Obrigado from "./Obrigado";

// Mock guard: liberar tracking e capturar pushes
const pushes: Array<Record<string, unknown>> = [];
vi.mock("@/lib/trackingGuard", () => ({
  safeDataLayerPush: (event: Record<string, unknown>) => {
    pushes.push(event);
  },
}));

// Mocks de hooks de tracking (não precisamos do comportamento real)
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

describe("Obrigado page tracking", () => {
  beforeEach(() => {
    pushes.length = 0;
    window.sessionStorage.clear();
  });

  it("dispara os 4 eventos com mesmo event_id", () => {
    renderPage();

    const events = pushes.map((p) => p.event);
    expect(events).toEqual([
      "thank_you_page_view",
      "google_ads_conversion",
      "meta_lead",
      "meta_complete_registration",
    ]);

    const ids = pushes.map((p) => p.event_id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTruthy();

    const ads = pushes.find((p) => p.event === "google_ads_conversion")!;
    expect(ads.send_to).toBe("AW-436492720/tUOICNX06JwcELCzkdAB");
    expect(ads.value).toBe(300);
    expect(ads.currency).toBe("BRL");
  });

  it("não duplica eventos em re-render", () => {
    const { rerender } = renderPage();
    rerender(
      <HelmetProvider>
        <MemoryRouter>
          <Obrigado />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(pushes.length).toBe(4);
  });

  it("não dispara novamente após reload (sessionStorage persiste)", () => {
    renderPage();
    expect(pushes.length).toBe(4);

    // Simula reload: novo render mas sessionStorage continua marcado
    pushes.length = 0;
    renderPage();
    expect(pushes.length).toBe(0);
  });
});
