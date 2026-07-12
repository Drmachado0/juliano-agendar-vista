import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// IntersectionObserver stub — vários componentes usam para animações on-scroll.
class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = "";
  thresholds = [];
}
if (typeof (globalThis as any).IntersectionObserver === "undefined") {
  (globalThis as any).IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;
  (window as any).IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;
}

// localStorage stub (jsdom já fornece, mas garantimos limpeza entre testes)
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
