import { Helmet } from "react-helmet-async";
import { BASE_URL, clinicNodes } from "@/lib/locations";
import { FAQS_AGENDAMENTO } from "@/lib/faqsAgendamento";
import {
  physicianNode,
  websiteNode,
  medicalWebPageNode,
  faqPageNode,
} from "@/lib/schema";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProceduresSection from "@/components/ProceduresSection";
import YagLaserSection from "@/components/YagLaserSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import AgendarSimplesSection from "@/components/AgendarSimplesSection";
import AgendarFAQSection from "@/components/AgendarFAQSection";
import LocationsSection from "@/components/LocationsSection";
import InsuranceSection from "@/components/InsuranceSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileStickyCTA from "@/components/MobileStickyCTA";
import Footer from "@/components/Footer";

import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";

const Index = () => {
  const { raw: waRaw } = useSiteWhatsApp();
  // JSON-LD em @graph. Um no por entidade real, todos amarrados por @id:
  //   Physician  -> quem atende (o mesmo no de /sobre e /agendamento)
  //   WebSite    -> o site, ancora de isPartOf
  //   MedicalWebPage -> esta pagina, com lastReviewed/reviewedBy (YMYL)
  //   FAQPage    -> as perguntas que a propria pagina exibe
  //   MedicalClinic x4 -> um por endereco fisico
  //
  // O no do medico sai de lib/schema.ts e os enderecos de lib/locations.ts:
  // a mesma fonte que alimenta a interface. Antes o Physician era escrito a
  // mao aqui, e /agendamento tinha uma segunda copia sem @id — duas pessoas
  // diferentes para o Google.
  const HOME_URL = `${BASE_URL}/`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      physicianNode({
        telephoneRaw: waRaw,
        mainEntityOfPage: HOME_URL,
      }),
      websiteNode(),
      medicalWebPageNode({
        name: "Dr. Juliano Machado — Oftalmologista em Paragominas e Belém",
        description:
          "Oftalmologista em Paragominas e Belém. Catarata, pterígio, glaucoma, campo visual e OCT.",
        url: HOME_URL,
      }),
      faqPageNode(FAQS_AGENDAMENTO, HOME_URL),
      ...clinicNodes(),
    ],
  };

  return (
    <>
      <Helmet>
        <title>Dr. Juliano Machado – Oftalmologista em Paragominas e Belém</title>
        <meta
          name="description"
          content="Oftalmologista em Paragominas e Belém. Dr. Juliano Machado, CRM-PA 15253. Catarata, pterígio, glaucoma. Agende sua consulta online."
        />
        <link rel="canonical" href="https://drjulianomachado.com/" />
        <meta property="og:title" content="Dr. Juliano Machado – Oftalmologista em Paragominas e Belém" />
        <meta property="og:description" content="Agende sua consulta oftalmológica. Mais de 15 anos de experiência. Cirurgia de catarata, pterígio, exames e mais." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drjulianomachado.com/" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background">
        <Header />
        
        <main>
          <HeroSection />
          <AboutSection />
          <AgendarSimplesSection />
          <ProceduresSection />
          <YagLaserSection />
          <TestimonialsSection />
          <LocationsSection />
          <InsuranceSection />
          <AgendarFAQSection />
        </main>

        <Footer />
        <WhatsAppButton />
        <MobileStickyCTA />
      </div>
    </>
  );
};

export default Index;
