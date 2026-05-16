import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle, MessageCircle, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";

const DEDUP_STORAGE_KEY = "obrigado_tracking_fired_v1";

const Obrigado = () => {
  const { trackWhatsAppClick, trackWhatsAppGoogleAdsConversion } = useGoogleTag();
  const { trackContact: trackMetaContact } = useMetaPixel();

  useEffect(() => {
    const fireObrigadoTracking = () => {
      if (typeof window === "undefined") return;

      try {
        if (window.sessionStorage?.getItem(DEDUP_STORAGE_KEY)) return;
      } catch {
        /* sessionStorage indisponível — segue */
      }

      let hasConsent = false;
      try {
        const raw = window.localStorage?.getItem("lgpd-consent");
        const consent = raw ? JSON.parse(raw) : null;
        hasConsent = !!(consent && (consent.analytics || consent.marketing));
      } catch {
        hasConsent = false;
      }

      // Sem consentimento ainda — não dispara e NÃO marca como fired,
      // para retentar quando o usuário aceitar cookies.
      if (!hasConsent) return;

      (window as any).dataLayer = (window as any).dataLayer || [];

      const eventId =
        window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `agendamento_${Date.now()}`;

      (window as any).dataLayer.push({
        event: "thank_you_page_view",
        page_path: "/obrigado",
        page_type: "agendamento_confirmado",
        conversion_value: 300,
        currency: "BRL",
        event_id: eventId,
        meta_event_id: eventId,
      });

      (window as any).dataLayer.push({
        event: "google_ads_conversion",
        send_to: "AW-436492720/tUOICNX06JwcELCzkdAB",
        value: 300,
        currency: "BRL",
        page_path: "/obrigado",
        page_type: "agendamento_confirmado",
        event_id: eventId,
        meta_event_id: eventId,
      });

      (window as any).dataLayer.push({
        event: "meta_lead",
        meta_event_name: "Lead",
        value: 300,
        currency: "BRL",
        page_path: "/obrigado",
        page_type: "agendamento_confirmado",
        event_id: eventId,
        meta_event_id: eventId,
      });

      (window as any).dataLayer.push({
        event: "meta_complete_registration",
        meta_event_name: "CompleteRegistration",
        value: 300,
        currency: "BRL",
        page_path: "/obrigado",
        page_type: "agendamento_confirmado",
        event_id: eventId,
        meta_event_id: eventId,
      });

      try {
        window.sessionStorage?.setItem(DEDUP_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    };

    fireObrigadoTracking();

    if (typeof window !== "undefined") {
      window.addEventListener("lgpd-consent-changed", fireObrigadoTracking);
      return () => {
        window.removeEventListener("lgpd-consent-changed", fireObrigadoTracking);
      };
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Agendamento Confirmado | Dr. Juliano Machado</title>
        <meta
          name="description"
          content="Seu agendamento com o Dr. Juliano Machado foi confirmado com sucesso."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{
          background: "linear-gradient(180deg, #0d1117 0%, #161b22 100%)",
        }}
      >
        <div className="mb-6 animate-scale-in">
          <CheckCircle className="h-20 w-20 text-green-400" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-center"
          style={{ color: "#58a6ff" }}
        >
          Agendamento Confirmado!
        </h1>

        <p className="text-gray-300 text-center max-w-md mb-8 leading-relaxed">
          Sua consulta com o Dr. Juliano Machado foi agendada com sucesso.
          Em breve você receberá uma confirmação pelo WhatsApp.
        </p>

        <div className="w-full max-w-md rounded-xl border border-gray-700 bg-[#1c2128] p-6 space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <MessageCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
            <p className="text-gray-300 text-sm">
              Nossa equipe entrará em contato para confirmar o agendamento.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
            <p className="text-gray-300 text-sm">
              Paragominas e Belém, PA
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
            <p className="text-gray-300 text-sm">
              Consulte a confirmação pelo WhatsApp.
            </p>
          </div>
        </div>

        <a
          href="https://wa.me/559184043477?text=Ol%C3%A1!%20Acabei%20de%20agendar%20minha%20consulta%20com%20o%20Dr.%20Juliano%20Machado."
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackWhatsAppClick(
              'https://wa.me/559184043477?text=Ol%C3%A1!%20Acabei%20de%20agendar%20minha%20consulta%20com%20o%20Dr.%20Juliano%20Machado.',
              'Falar pelo WhatsApp',
              'whatsapp_obrigado',
              'obrigado_page'
            );
            trackWhatsAppGoogleAdsConversion();
            trackMetaContact('WhatsApp');
          }}
          className="w-full max-w-md"
        >
          <Button variant="whatsapp" size="lg" className="w-full gap-2">
            <MessageCircle className="h-5 w-5" />
            Falar pelo WhatsApp
          </Button>
        </a>

        <Link to="/" className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors">
          Voltar ao site
        </Link>

        <footer className="mt-12 text-center text-gray-500 text-xs space-y-1">
          <p className="font-serif text-sm text-gray-400">Dr. Juliano Machado</p>
          <p>Médico Oftalmologista &middot; CRM-PA 15253</p>
          <p>Cirurgia de Catarata &middot; Glaucoma &middot; Retina</p>
        </footer>
      </div>
    </>
  );
};

export default Obrigado;
