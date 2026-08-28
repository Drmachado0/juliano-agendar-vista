import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

/**
 * Este setup roda para TODOS os testes, inclusive os de ambiente node.
 *
 * src/test/ssg.test.tsx usa `@vitest-environment node`, porque
 * renderToPipeableStream escreve num Writable do Node e nao existe sob jsdom.
 * Sem esta guarda, o setup quebrava logo na primeira linha com "window is not
 * defined" e o arquivo inteiro nem chegava a rodar.
 */
const temDom = typeof window !== "undefined";

if (temDom) Object.defineProperty(window, "matchMedia", {
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
  if (temDom) (window as any).IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;
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
  if (temDom) (window as any).ResizeObserver = ROStub as unknown as typeof ResizeObserver;
}

// localStorage stub (jsdom já fornece, mas garantimos limpeza entre testes)
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
