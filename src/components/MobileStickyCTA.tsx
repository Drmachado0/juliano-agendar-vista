import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, MessageCircle } from "lucide-react";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { hasDecided, subscribeConsent } from "@/lib/consent";
import { useGoogleTag } from "@/hooks/useGoogleTag";

/**
 * Barra fixa de CTA no rodape, so no mobile.
 *
 * Aparece depois que o usuario rola alem do hero (~600px) e some no desktop.
 *
 * ESPERA A DECISAO DE COOKIES: o banner LGPD ocupa o mesmo rodape e fica por
 * cima desta barra. Medido em producao com elementFromPoint: enquanto o banner
 * estava visivel, os DOIS botoes daqui — CTA e WhatsApp — tinham um BUTTON do
 * banner ocupando o ponto central. Nao respondiam ao toque.
 *
 * O estrago recaia exatamente sobre quem chega pela primeira vez, que e quem
 * ainda nao decidiu os cookies. Para o visitante recorrente a barra sempre
 * funcionou, e por isso passou despercebido.
 *
 * A saida e a barra ceder, nunca o banner: consentimento precisa continuar
 * acessivel e por cima. Aqui ela simplesmente nao entra ate haver decisao, em
 * vez de aparecer inerte.
 *
 * A fonte e a mesma do banner (hasDecided), entao os dois nao podem divergir.
 * subscribeConsent faz a barra entrar no instante em que o usuario decide, sem
 * precisar recarregar.
 */
const MobileStickyCTA = () => {
  const [show, setShow] = useState(false);
  const [decidido, setDecidido] = useState(() => hasDecided());
  const { waLink } = useSiteWhatsApp();
  const { trackCTAClick, trackWhatsAppClick } = useGoogleTag();
  const waUrl = waLink("Olá! Gostaria de agendar uma consulta com o Dr. Juliano Machado.", "home_sticky_mobile");

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => subscribeConsent(() => setDecidido(true)), []);

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-background/95 backdrop-blur-md border-t border-border/60 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] transition-all duration-300 ${
        show && decidido ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
      role="region"
      aria-label="Ações rápidas"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/agendamento"
          onClick={() => trackCTAClick("agendar_consulta", "sticky_mobile", "Agendar consulta")}
          className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl px-4 text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
        >
          <CalendarCheck className="w-4 h-4" />
          Agendar consulta
        </Link>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsAppClick(waUrl, "Falar no WhatsApp", "whatsapp_sticky_mobile", "sticky_mobile")}
          aria-label="Falar no WhatsApp"
          className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 active:scale-[0.98] transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
};

export default MobileStickyCTA;
