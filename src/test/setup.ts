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

// ResizeObserver stub — exigido por primitivos do Radix (Checkbox, Select,
// Slider) via @radix-ui/react-use-size. Sem isso, qualquer teste que monte
// esses componentes quebra com "ResizeObserver is not defined".
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = ROStub as unknown as typeof ResizeObserver;
  (window as any).ResizeObserver = ROStub as unknown as typeof ResizeObserver;
}

// localStorage stub (jsdom já fornece, mas garantimos limpeza entre testes)
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
