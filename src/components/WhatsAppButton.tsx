import { MessageCircle } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useState, useEffect } from "react";

const WhatsAppButton = () => {
  const { trackContact, trackWhatsAppClickConversion, trackGoogleAds2Conversion } = useGoogleTag();
  const [show, setShow] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const whatsappUrl = "https://wa.me/5591936180476?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20com%20o%20Dr.%20Juliano%20Machado.";

  useEffect(() => {
    const showTimer = setTimeout(() => setShow(true), 3000);
    const pulseTimer = setTimeout(() => setPulseReady(true), 5000);
    const tooltipShowTimer = setTimeout(() => setShowTooltip(true), 8000);
    const tooltipHideTimer = setTimeout(() => setShowTooltip(false), 11000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(pulseTimer);
      clearTimeout(tooltipShowTimer);
      clearTimeout(tooltipHideTimer);
    };
  }, []);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 transition-all duration-500 ease-out-expo ${
      show ? 'translate-x-0 opacity-100' : 'translate-x-[60px] opacity-0'
    }`}>
      {/* Tooltip speech bubble */}
      <div className={`bg-card/95 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-2 rounded-xl border border-border/60 shadow-lg transition-all duration-300 ${
        showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <span>Tire suas dúvidas! 💬</span>
        {/* Speech bubble arrow */}
        <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-card/95 border-r border-b border-border/60 rotate-45" />
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { trackContact('whatsapp'); trackWhatsAppClickConversion(); trackGoogleAds2Conversion(); }}
        className={`flex items-center gap-2.5 bg-[#25D366] text-white pl-4 pr-5 py-3.5 rounded-2xl shadow-xl shadow-[#25D366]/25 hover:shadow-2xl hover:shadow-[#25D366]/35 hover:scale-105 active:scale-100 transition-all duration-300 backdrop-blur-sm ring-2 ring-[#25D366]/20 ring-offset-2 ring-offset-background ${
          pulseReady ? 'animate-whatsapp-pulse' : ''
        }`}
        aria-label="Fale conosco pelo WhatsApp"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="font-semibold text-sm tracking-wide hidden sm:inline">Fale conosco</span>
      </a>
    </div>
  );
};

export default WhatsAppButton;
