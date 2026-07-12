import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTestimonialsCarousel } from "./useTestimonialsCarousel";

describe("useTestimonialsCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computa pageCount corretamente para 20 items × 3 por página", () => {
    const { result } = renderHook(() =>
      useTestimonialsCarousel({ totalItems: 20, itemsPerPage: 3 })
    );
    expect(result.current.pageCount).toBe(7);
  });

  it("avança automaticamente a cada intervalo", () => {
    const { result } = renderHook(() =>
      useTestimonialsCarousel({ totalItems: 6, itemsPerPage: 3, intervalMs: 6000 })
    );
    expect(result.current.page).toBe(0);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.page).toBe(1);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.current.page).toBe(0);
  });

  it("pausa quando paused=true (hover/foco/oculto)", () => {
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) =>
        useTestimonialsCarousel({ totalItems: 6, itemsPerPage: 3, intervalMs: 6000, paused }),
      { initialProps: { paused: false } }
    );
    rerender({ paused: true });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.page).toBe(0);
    expect(result.current.isPaused).toBe(true);
  });

  it("pausa quando reducedMotion=true", () => {
    const { result } = renderHook(() =>
      useTestimonialsCarousel({
        totalItems: 6,
        itemsPerPage: 3,
        intervalMs: 6000,
        reducedMotion: true,
      })
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.page).toBe(0);
    expect(result.current.isPaused).toBe(true);
  });

  it("controles next/prev/goTo navegam com wrap-around", () => {
    const { result } = renderHook(() =>
      useTestimonialsCarousel({ totalItems: 9, itemsPerPage: 3, paused: true })
    );
    act(() => result.current.next());
    expect(result.current.page).toBe(1);
    act(() => result.current.prev());
    expect(result.current.page).toBe(0);
    act(() => result.current.prev()); // wrap
    expect(result.current.page).toBe(2);
    act(() => result.current.goTo(1));
    expect(result.current.page).toBe(1);
  });

  it("um único timer ativo mesmo com re-render (StrictMode-safe)", () => {
    const setSpy = vi.spyOn(window, "setInterval");
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { rerender, unmount } = renderHook(
      ({ items }: { items: number }) =>
        useTestimonialsCarousel({ totalItems: items, itemsPerPage: 3, intervalMs: 6000 }),
      { initialProps: { items: 9 } }
    );
    rerender({ items: 9 });
    rerender({ items: 9 });
    // A cada nova execução do effect com deps iguais, não recria; com re-render puro (sem mudança de deps), effect não roda.
    expect(setSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
