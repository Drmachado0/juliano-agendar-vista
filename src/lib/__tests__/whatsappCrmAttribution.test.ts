import { describe, expect, it } from "vitest";
import { decorateWhatsappLinksWithCrmAttribution } from "@/lib/whatsappCrmAttribution";

describe("decorateWhatsappLinksWithCrmAttribution — sem marcador visível", () => {
  it("não anexa [Origem Ads/CRM: ...] ao texto do WhatsApp", () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    // simula UTM/gclid já capturados
    window.localStorage.setItem(
      "lp_utms",
      JSON.stringify({
        gclid: "abc123",
        crm_tracking_code: "ADS-TEST1",
        event_id: "evt-1",
        landing_page: "https://x",
        referrer: "",
      }),
    );

    document.body.innerHTML = `
      <a id="wa" href="https://wa.me/5591991150174?text=${encodeURIComponent(
        "Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.",
      )}">WhatsApp</a>
    `;

    decorateWhatsappLinksWithCrmAttribution();

    const href = (document.getElementById("wa") as HTMLAnchorElement).getAttribute("href")!;
    expect(href).not.toContain("Origem%20Ads");
    expect(href).not.toContain("Origem Ads");
    expect(decodeURIComponent(href)).toContain(
      "Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.",
    );
  });

  it("higieniza marcador legado existente no href", () => {
    document.body.innerHTML = `
      <a id="wa" href="https://wa.me/5591991150174?text=${encodeURIComponent(
        "Oi\n\n[Origem Ads/CRM: origem=ADS-9HN6C | gclid=xyz]",
      )}">WhatsApp</a>
    `;

    decorateWhatsappLinksWithCrmAttribution();

    const href = (document.getElementById("wa") as HTMLAnchorElement).getAttribute("href")!;
    expect(decodeURIComponent(href)).toBe("https://wa.me/5591991150174?text=Oi");
  });
});
