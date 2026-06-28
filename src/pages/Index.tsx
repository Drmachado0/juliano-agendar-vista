import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProceduresSection from "@/components/ProceduresSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import AgendarSimplesSection from "@/components/AgendarSimplesSection";
import LocationsSection from "@/components/LocationsSection";
import InsuranceSection from "@/components/InsuranceSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileStickyCTA from "@/components/MobileStickyCTA";
import Footer from "@/components/Footer";

import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { GOOGLE_REVIEWS } from "@/lib/constants";

const Index = () => {
  const { raw: waRaw } = useSiteWhatsApp();
  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "name": "Dr. Juliano Machado",
    "description": "Oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém.",
    "medicalSpecialty": "Ophthalmology",
    "url": "https://drjulianomachado.com",
    "image": "https://drjulianomachado.com/og-image.jpg",
    "telephone": `+${waRaw}`,
    "priceRange": "$$",
    "address": [
      {
        "@type": "PostalAddress",
        "streetAddress": "Rua Eixo W1, R. Célio Miranda, N° 729",
        "addressLocality": "Paragominas",
        "addressRegion": "PA",
        "addressCountry": "BR"
      },
      {
        "@type": "PostalAddress",
        "streetAddress": "Av. Generalíssimo Deodoro, 904 - Nazaré",
        "addressLocality": "Belém",
        "addressRegion": "PA",
        "addressCountry": "BR"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": String(GOOGLE_REVIEWS.rating),
      "bestRating": "5",
      "ratingCount": String(GOOGLE_REVIEWS.count)
    },
    "sameAs": [
      "https://www.instagram.com/drjulianomachado.oftalmo/"
    ]
  };

  return (
    <>
      <Helmet>
        <title>Oftalmologista em Paragominas e Belém | Dr. Juliano Machado</title>
        <meta
          name="description"
          content="Oftalmologista em Paragominas e Belém. Dr. Juliano Machado, 13+ anos, nota 5.0. Catarata, pterígio, glaucoma. Agende sua consulta online."
        />
        <meta
          name="keywords"
          content="oftalmologista Paragominas, oftalmologista Belém, catarata, pterígio, OCT, campo visual, Dr. Juliano Machado, agendar consulta oftalmologista"
        />
        <link rel="canonical" href="https://drjulianomachado.com/" />
        <meta property="og:title" content="Dr. Juliano Machado – Oftalmologista em Paragominas e Belém" />
        <meta property="og:description" content="Agende sua consulta oftalmológica. +13 anos de experiência. Cirurgia de catarata, pterígio, exames e mais." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drjulianomachado.com/" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main>
          <HeroSection />
          <AboutSection />
          <ProceduresSection />
          <TestimonialsSection />
          <AgendarSimplesSection />
          <LocationsSection />
          <InsuranceSection />
        </main>

        <Footer />
        <WhatsAppButton />
        <MobileStickyCTA />
      </div>
    </>
  );
};

export default Index;
