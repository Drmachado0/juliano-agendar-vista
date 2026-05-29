import { MessageCircle } from "lucide-react";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const WhatsAppButton = () => {
  const { trackWhatsAppClick, trackWhatsAppGoogleAdsConversion } = useGoogleTag();
  const { trackContact: trackMetaContact, generateEventId } = useMetaPixel();

  // Dispara CAPI server-side para WhatsApp Contact (sem agendamento.id — usa UUID + cookies)
  const fireMetaCapiContact = async (eventId: string) => {
    const getCookie = (name: string): string | undefined => {
      const m = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
      return m ? m[2] : undefined;
    };
    const params = new URLSearchParams(window.location.search);
    const ssGet = (k: string) => params.get(k) ?? sessionStorage.getItem(k) ?? undefined;
    try {
      await supabase.functions.invoke('meta-capi', {
        body: {
          event_name: 'Contact',
          event_id: eventId,
          event_source_url: window.location.href,
          user_data: {
            country: 'BR',
            fbc: getCookie('_fbc'),
            fbp: getCookie('_fbp'),
            client_user_agent: navigator.userAgent,
          },
          custom_data: {
            content_name: 'WhatsApp_Floating',
            content_category: 'Lead_Channel',
            utm_source: ssGet('utm_source'),
            utm_medium: ssGet('utm_medium'),
            utm_campaign: ssGet('utm_campaign'),
            utm_content: ssGet('utm_content'),
            utm_term: ssGet('utm_term'),
          },
        },
      });
    } catch (err) {
      // Falha em CAPI nunca bloqueia a UX do WhatsApp
      console.warn('[meta-capi] Contact event failed:', err);
    }
  };
  const [show, setShow] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const whatsappUrl = "https://wa.me/5591991150174?text=Ol%C3%A1%21%20Gostaria%20de%20agendar%20uma%20consulta%20oftalmol%C3%B3gica%20com%20o%20Dr.%20Juliano%20Machado.";

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
        <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-card/95 border-r border-b border-border/60 rotate-45" />
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          const eventId = generateEventId();
          trackWhatsAppClick(whatsappUrl, 'Fale conosco', 'whatsapp_floating', 'floating_bottom_right');
          trackWhatsAppGoogleAdsConversion();
          trackMetaContact('WhatsApp_Floating', eventId);
          // fire-and-forget: não bloqueia a navegação para o WhatsApp
          fireMetaCapiContact(eventId);
        }}
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
