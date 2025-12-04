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

  return (
    <>
      <Helmet>
        <title>Dr. Juliano Machado – Oftalmologista em Paragominas e Belém</title>
        <meta
          name="description"
          content="Agende sua consulta com Dr. Juliano Machado, oftalmologista especializado em catarata, pterígio, exames de campo visual e OCT. Atendimento em Paragominas e Belém."
        />
        <meta
          name="keywords"
          content="oftalmologista, Paragominas, Belém, catarata, pterígio, OCT, campo visual, Dr. Juliano Machado"
        />
        <link rel="canonical" href="https://drjulianomachado.com" />
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
