import { Helmet } from "react-helmet-async";
import { DOCTOR } from "@/lib/constants";
import { BASE_URL, PHYSICIAN_ID, clinicNodes, citiesServed } from "@/lib/locations";
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
import { useGoogleReviews } from "@/hooks/useGoogleReviews";

const Index = () => {
  const { raw: waRaw } = useSiteWhatsApp();
  const reviews = useGoogleReviews();
  // JSON-LD em @graph: um no Physician + um MedicalClinic por endereco fisico.
  // Antes era uma unica entidade Physician com array de 2 address (de 4 reais),
  // o que faz o Google associar telefone e avaliacoes a um local so. Os
  // enderecos vem de lib/locations.ts, a mesma fonte que alimenta a interface.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Physician",
        "@id": PHYSICIAN_ID,
        "name": DOCTOR.name,
        "description":
          "Oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém.",
        "medicalSpecialty": "Ophthalmology",
        "url": BASE_URL,
        "image": `${BASE_URL}/og-image.jpg`,
        "telephone": `+${waRaw}`,
        "priceRange": "$$",
        "identifier": {
          "@type": "PropertyValue",
          "propertyID": "CRM",
          "value": DOCTOR.crm,
        },
        "memberOf": DOCTOR.memberships.map((m) => ({
          "@type": "Organization",
          "name": m,
        })),
        "areaServed": citiesServed().map((c) => ({ "@type": "City", "name": c })),
        // ratingCount = total EXATO, exigido pelo Google
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": String(reviews.rating),
          "bestRating": "5",
          "ratingCount": String(reviews.count),
        },
        "workLocation": clinicNodes().map((c) => ({ "@id": c["@id"] })),
        "sameAs": ["https://www.instagram.com/drjulianomachado.oftalmo/"],
      },
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
        <meta
          name="keywords"
          content="oftalmologista Paragominas, oftalmologista Belém, catarata, pterígio, OCT, campo visual, Dr. Juliano Machado, agendar consulta oftalmologista"
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
