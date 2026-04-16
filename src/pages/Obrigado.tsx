import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle, MessageCircle, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Obrigado = () => {
  useEffect(() => {
    // Meta Pixel - Lead conversion (direct fbq)
    if (typeof (window as any).fbq === 'function') {
      (window as any).fbq('track', 'Lead', {
        content_name: 'Agendamento Confirmado',
        content_category: 'Consulta Oftalmológica',
        value: 300,
        currency: 'BRL',
      });
      (window as any).fbq('track', 'CompleteRegistration', {
        content_name: 'Página Obrigado',
        value: 300,
        currency: 'BRL',
      });
    }

    // Google Ads Conversion (real label)
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'conversion', {
        send_to: 'AW-436492720/3Y-4COmQ1dUbELCzkdAB',
        value: 300,
        currency: 'BRL',
      });
    }

    // DataLayer for GTM
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'meta_lead',
      content_name: 'Agendamento Confirmado',
    });
    window.dataLayer.push({
      event: 'google_ads_conversion',
      send_to: 'AW-436492720/3Y-4COmQ1dUbELCzkdAB',
      value: 300,
      currency: 'BRL',
    });
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
          href="https://wa.me/5591936180476?text=Ol%C3%A1!%20Acabei%20de%20agendar%20minha%20consulta%20com%20o%20Dr.%20Juliano%20Machado."
          target="_blank"
          rel="noopener noreferrer"
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
          <p>Oftalmologista &middot; CRM-PA 12345</p>
          <p>Cirurgia de Catarata &middot; Glaucoma &middot; Retina</p>
        </footer>
      </div>
    </>
  );
};

export default Obrigado;
