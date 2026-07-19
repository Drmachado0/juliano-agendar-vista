import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, MessageCircle } from "lucide-react";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleTag } from "@/hooks/useGoogleTag";

/**
 * Sticky CTA bar fixed at the bottom on mobile only.
 * Appears after user scrolls past the hero (~600px) and hides on desktop.
 * Uses bottom-20 spacing safe-area to avoid overlapping consent banner.
 */
const MobileStickyCTA = () => {
  const [show, setShow] = useState(false);
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

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-background/95 backdrop-blur-md border-t border-border/60 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] transition-all duration-300 ${
        show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
      role="region"
      aria-label="Ações rápidas"
    >
      <div className="flex items-center gap-2">
        <Link
          to="/agendamento"
          onClick={() => trackCTAClick("agendar_consulta", "sticky_mobile", "Agendar consulta")}
          className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl px-4 text-sm font-bold bg-gradient-to-r from-gold-400 via-primary to-gold-600 text-gold-900 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
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
