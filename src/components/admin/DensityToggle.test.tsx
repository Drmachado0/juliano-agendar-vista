import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DensityToggle from "./DensityToggle";
import { DensityProvider } from "@/hooks/useDensity";

// Mock supabase client to avoid env-dependent init when testing CRMFilters tree
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const renderToggle = () =>
  render(
    <DensityProvider>
      <DensityToggle />
    </DensityProvider>
  );

describe("DensityToggle", () => {
  it("renderiza as duas opções e marca Compacto como ativo por padrão", () => {
    renderToggle();
    const compact = screen.getByRole("button", { name: /Compacto/i });
    const comfy = screen.getByRole("button", { name: /Confortável/i });
    expect(compact).toHaveAttribute("aria-pressed", "true");
    expect(comfy).toHaveAttribute("aria-pressed", "false");
    expect(compact.className).toMatch(/bg-primary/);
    expect(comfy.className).not.toMatch(/bg-primary/);
  });

  it("ao clicar em Confortável muda o estado ativo e persiste", () => {
    renderToggle();
    const comfy = screen.getByRole("button", { name: /Confortável/i });
    fireEvent.click(comfy);
    expect(comfy).toHaveAttribute("aria-pressed", "true");
    expect(comfy.className).toMatch(/bg-primary/);
    expect(localStorage.getItem("crm:density:v1")).toBe("comfortable");
  });
});
