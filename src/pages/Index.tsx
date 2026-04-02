import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ProceduresSection from "@/components/ProceduresSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import LocationsSection from "@/components/LocationsSection";
import InsuranceSection from "@/components/InsuranceSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import Footer from "@/components/Footer";
import SchedulingModal from "@/components/scheduling/SchedulingModal";

const Index = () => {
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);

  const openScheduling = () => setIsSchedulingOpen(true);
  const closeScheduling = () => setIsSchedulingOpen(false);

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "name": "Dr. Juliano Machado",
    "description": "Oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém.",
    "medicalSpecialty": "Ophthalmology",
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
    "telephone": "+5591936180476",
    "url": "https://drjulianomachado.com",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5.0",
      "reviewCount": "100"
    }
  };

  return (
    <>
      <Helmet>
        <title>Dr. Juliano Machado · Oftalmologista — Paragominas e Belém | Agendar Consulta</title>
        <meta
          name="description"
          content="Consulta com oftalmologista em Paragominas e Belém. Dr. Juliano Machado — 13+ anos, nota 5.0 no Google, 6.000+ pacientes. Catarata, pterígio, glaucoma. Agende online."
        />
        <meta
          name="keywords"
          content="oftalmologista Paragominas, oftalmologista Belém, catarata, pterígio, OCT, campo visual, Dr. Juliano Machado, agendar consulta oftalmologista"
        />
        <link rel="canonical" href="https://drjulianomachado.com" />
        <meta property="og:title" content="Dr. Juliano Machado – Oftalmologista em Paragominas e Belém" />
        <meta property="og:description" content="Agende sua consulta oftalmológica. +13 anos de experiência. Cirurgia de catarata, pterígio, exames e mais." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://drjulianomachado.com" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header onScheduleClick={openScheduling} />
        
        <main>
          <HeroSection onScheduleClick={openScheduling} />
          <AboutSection />
          <ProceduresSection />
          <TestimonialsSection />
          <LocationsSection />
          <InsuranceSection onScheduleClick={openScheduling} />
        </main>

        <Footer />
        <WhatsAppButton />
        
        <SchedulingModal isOpen={isSchedulingOpen} onClose={closeScheduling} />
      </div>
    </>
  );
};

export default Index;
