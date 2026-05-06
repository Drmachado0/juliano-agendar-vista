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

// localStorage stub (jsdom já fornece, mas garantimos limpeza entre testes)
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
