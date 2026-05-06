import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DensityProvider, useDensity } from "./useDensity";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DensityProvider>{children}</DensityProvider>
);

describe("useDensity", () => {
  it("default density is compact", () => {
    const { result } = renderHook(() => useDensity(), { wrapper });
    expect(result.current.density).toBe("compact");
    expect(result.current.isCompact).toBe(true);
    expect(result.current.isComfortable).toBe(false);
  });

  it("toggle alterna entre compact e comfortable", () => {
    const { result } = renderHook(() => useDensity(), { wrapper });
    act(() => result.current.toggle());
    expect(result.current.density).toBe("comfortable");
    expect(result.current.isComfortable).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.density).toBe("compact");
  });

  it("setDensity persiste no localStorage", () => {
    const { result } = renderHook(() => useDensity(), { wrapper });
    act(() => result.current.setDensity("comfortable"));
    expect(localStorage.getItem("crm:density:v1")).toBe("comfortable");
    act(() => result.current.setDensity("compact"));
    expect(localStorage.getItem("crm:density:v1")).toBe("compact");
  });

  it("hidrata a partir do localStorage", () => {
    localStorage.setItem("crm:density:v1", "comfortable");
    const { result } = renderHook(() => useDensity(), { wrapper });
    expect(result.current.density).toBe("comfortable");
  });

  it("fallback seguro fora do provider retorna compact", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("compact");
    expect(result.current.isCompact).toBe(true);
  });
});
