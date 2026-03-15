import { MessageCircle } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";

import { useState, useEffect } from "react";

const WhatsAppButton = () => {
  const { trackContact } = useGoogleTag();
  const [show, setShow] = useState(false);
  const whatsappUrl = "https://api.whatsapp.com/send?phone=5591920021125&text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20com%20o%20Dr.%20Juliano%20Machado.";

  // Delay appearance to avoid distraction on load
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact('whatsapp')}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#25D366] text-white pl-4 pr-5 py-3.5 rounded-2xl shadow-xl shadow-[#25D366]/25 hover:shadow-2xl hover:shadow-[#25D366]/35 hover:scale-105 active:scale-100 transition-all duration-300 animate-whatsapp-pulse ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      style={{ transition: 'transform 0.4s ease, opacity 0.4s ease, box-shadow 0.3s ease' }}
      aria-label="Fale conosco pelo WhatsApp"
    >
      <MessageCircle className="w-5 h-5" />
      <span className="font-semibold text-sm hidden sm:inline">Fale conosco</span>
    </a>
  );
};

export default WhatsAppButton;
