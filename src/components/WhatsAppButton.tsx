import { MessageCircle } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";

const WhatsAppButton = () => {
  const { trackContact } = useGoogleTag();
  const whatsappUrl = "https://api.whatsapp.com/send?phone=5519982273901&text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20consulta%20com%20o%20Dr.%20Juliano%20Machado.";

  const handleClick = () => {
    trackContact('whatsapp');
  };

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#25D366] text-white px-5 py-3 rounded-full shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/40 hover:scale-105 transition-all duration-300 group animate-whatsapp-pulse"
      aria-label="Fale conosco pelo WhatsApp"
    >
      <MessageCircle className="w-6 h-6" />
      <span className="font-semibold hidden sm:inline">WhatsApp</span>
    </a>
  );
};

export default WhatsAppButton;
