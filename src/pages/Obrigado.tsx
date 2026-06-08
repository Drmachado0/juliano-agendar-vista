import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle, MessageCircle, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { supabase } from "@/integrations/supabase/client";

const DEDUP_STORAGE_KEY = "obrigado_tracking_fired_v1";

const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
};

const getUtm = (key: string): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get(key);
  if (fromUrl) return fromUrl;
  try {
    return window.sessionStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

const sendMetaCapi = async (eventName: "Lead" | "CompleteRegistration", eventId: string) => {
  try {
    const utm_source = getUtm("utm_source");
    const utm_medium = getUtm("utm_medium");
    const utm_campaign = getUtm("utm_campaign");
    const utm_content = getUtm("utm_content");
    const utm_term = getUtm("utm_term");

    const payload = {
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      user_data: {
        country: "BR",
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        client_user_agent: navigator.userAgent,
      },
      custom_data: {
        content_name: "Agendamento Confirmado",
        content_category: "Consulta Oftalmológica",
        value: 300,
        currency: "BRL",
        ...(utm_source && { utm_source }),
        ...(utm_medium && { utm_medium }),
        ...(utm_campaign && { utm_campaign }),
        ...(utm_content && { utm_content }),
        ...(utm_term && { utm_term }),
      },
    };

    const { error } = await supabase.functions.invoke("meta-capi", { body: payload });
    if (error) console.warn(`[meta-capi] ${eventName} falhou:`, error);
  } catch (err) {
    console.warn(`[meta-capi] ${eventName} erro:`, err);
  }
};

const Obrigado = () => {
  const { trackWhatsAppClick, trackWhatsAppGoogleAdsConversion } = useGoogleTag();
  const { trackContact: trackMetaContact } = useMetaPixel();
  const { waLink } = useSiteWhatsApp();

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

      // Reforço server-side via Meta CAPI — mesmo event_id do Pixel/GTM para dedup.
      void sendMetaCapi("Lead", eventId);
      void sendMetaCapi("CompleteRegistration", eventId);

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
        <link rel="canonical" href="https://drjulianomachado.com/obrigado" />
        <meta property="og:title" content="Agendamento Confirmado | Dr. Juliano Machado" />
        <meta property="og:description" content="Confirmação do seu agendamento com o Dr. Juliano Machado, oftalmologista em Paragominas e Belém." />
        <meta property="og:url" content="https://drjulianomachado.com/obrigado" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="noindex, follow" />
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
          href={waLink("Olá! Acabei de agendar minha consulta com o Dr. Juliano Machado.")}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            const url = waLink("Olá! Acabei de agendar minha consulta com o Dr. Juliano Machado.");
            trackWhatsAppClick(
              url,
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
