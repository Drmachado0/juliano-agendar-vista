import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProceduresSection from "@/components/ProceduresSection";
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
  // Structured data for SEO (ratingCount = total EXATO, exigido pelo Google)
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
      "ratingValue": String(reviews.rating),
      "bestRating": "5",
      "ratingCount": String(reviews.count)
    },
    "sameAs": [
      "https://www.instagram.com/drjulianomachado.oftalmo/"
    ]
  };

  return (
    <>
      <Helmet>
        <title>Dr. Juliano Machado – Oftalmologista em Paragominas e Belém</title>
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

      <div className="theme-obsidian min-h-screen bg-background">
        <Header />
        
        <main>
          <HeroSection />
          <AgendarSimplesSection />
          <AboutSection />
          <ProceduresSection />
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
