import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseCarouselOptions {
  totalItems: number;
  itemsPerPage: number;
  intervalMs?: number;
  paused?: boolean;
  reducedMotion?: boolean;
}

/**
 * Carrossel acessível para o TestimonialsSection.
 *
 * - Divide `totalItems` em páginas de `itemsPerPage` (última página completa
 *   por wrap-around para manter o grid sempre cheio, sem "buracos" nas laterais).
 * - Avanço automático a cada `intervalMs` (default 6s). Um único setInterval
 *   por instância — imune a duplicação sob React StrictMode.
 * - Pausa quando `paused=true` (hover/foco/visibility) ou `reducedMotion=true`.
 */
export function useTestimonialsCarousel({
  totalItems,
  itemsPerPage,
  intervalMs = 6000,
  paused = false,
  reducedMotion = false,
}: UseCarouselOptions) {
  const pageCount = Math.max(1, Math.ceil(totalItems / Math.max(1, itemsPerPage)));
  const [page, setPage] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  const currentPage = pageCount > 0 ? page % pageCount : 0;

  const next = useCallback(() => {
    setPage((p) => (pageCount > 0 ? (p + 1) % pageCount : 0));
  }, [pageCount]);

  const prev = useCallback(() => {
    setPage((p) => (pageCount > 0 ? (p - 1 + pageCount) % pageCount : 0));
  }, [pageCount]);

  const goTo = useCallback(
    (i: number) => {
      setPage(pageCount > 0 ? ((i % pageCount) + pageCount) % pageCount : 0);
    },
    [pageCount]
  );

  // Timer único; pausas encerram e reiniciam quando o motivo desaparece.
  const timerRef = useRef<number | null>(null);
  const isPaused = paused || userPaused || reducedMotion || pageCount <= 1;

  useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(() => {
      setPage((p) => (pageCount > 0 ? (p + 1) % pageCount : 0));
    }, intervalMs);
    timerRef.current = id;
    return () => {
      window.clearInterval(id);
      timerRef.current = null;
    };
  }, [isPaused, intervalMs, pageCount]);

  const visibleRange = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return { start, end: start + itemsPerPage };
  }, [currentPage, itemsPerPage]);

  return {
    page: currentPage,
    pageCount,
    next,
    prev,
    goTo,
    isPaused,
    userPaused,
    setUserPaused,
    visibleRange,
  };
}

/** Resolve items-per-page a partir da largura da janela (mobile 1, md 2, lg+ 3). */
export function useItemsPerPage(): number {
  const compute = () => {
    if (typeof window === "undefined") return 3;
    if (window.matchMedia("(min-width: 1024px)").matches) return 3;
    if (window.matchMedia("(min-width: 768px)").matches) return 2;
    return 1;
  };
  const [ipp, setIpp] = useState<number>(compute);
  useEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqMd = window.matchMedia("(min-width: 768px)");
    const update = () => setIpp(compute());
    mqLg.addEventListener("change", update);
    mqMd.addEventListener("change", update);
    return () => {
      mqLg.removeEventListener("change", update);
      mqMd.removeEventListener("change", update);
    };
  }, []);
  return ipp;
}

/** true quando o usuário pediu prefers-reduced-motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** true quando `document.visibilityState !== "visible"`. */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState !== "visible";
  });
  useEffect(() => {
    const update = () => setHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}
