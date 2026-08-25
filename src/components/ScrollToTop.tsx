import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Reseta a rolagem ao trocar de rota.
 *
 * O React Router não mexe no scroll: quem clicava num link no meio da home
 * caía no meio da página de destino. Sem isto, o "Saiba mais" da seção de YAG
 * abria a página do procedimento já na altura de "Como se preparar para o dia".
 *
 * Âncoras continuam funcionando: quando a URL tem hash (ex.: /#yag-laser), o
 * alvo é rolado para a vista em vez do topo. Respeita prefers-reduced-motion.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const semAnimacao =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (hash) {
      const alvo = document.getElementById(hash.slice(1));
      if (alvo) {
        alvo.scrollIntoView({
          behavior: semAnimacao ? "auto" : "smooth",
          block: "start",
        });
        return;
      }
      // Hash sem elemento correspondente cai no topo, abaixo.
    }

    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
