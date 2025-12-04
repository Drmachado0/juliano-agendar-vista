import { Button } from "@/components/ui/button";
import { Award, Clock, MapPin } from "lucide-react";
import drJulianoPhoto from "@/assets/dr-juliano-machado.jpg";

interface HeroSectionProps {
  onScheduleClick: () => void;
}

const HeroSection = ({ onScheduleClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 hero-gradient overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-6 animate-fade-in">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">Especialista em Oftalmologia</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-slide-up">
              <span className="text-foreground">Dr. Juliano</span>
              <br />
              <span className="gradient-text">Machado</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Cuidando da sua visão com excelência e tecnologia de ponta. 
              Atendimento humanizado em Paragominas e Belém.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button variant="hero" size="lg" onClick={onScheduleClick}>
                Agendar consulta
              </Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>
                Saiba mais
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
                  <Award className="w-5 h-5 text-primary" />
                  <span className="text-xl font-bold text-foreground">+11</span>
                </div>
                <span className="text-xs text-muted-foreground">anos de experiência</span>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-xl font-bold text-foreground">5000+</span>
                </div>
                <span className="text-xs text-muted-foreground">cirurgias realizadas</span>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-xl font-bold text-foreground">3</span>
                </div>
                <span className="text-xs text-muted-foreground">locais de atendimento</span>
              </div>
            </div>
          </div>

          {/* Doctor Photo */}
          <div className="order-1 lg:order-2 flex justify-center animate-fade-in">
            <div className="relative">
              {/* Glow effect behind photo */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30 rounded-3xl blur-3xl scale-90" />
              
              {/* Photo container */}
              <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-3xl overflow-hidden border-2 border-primary/20 shadow-2xl">
                <img
                  src={drJulianoPhoto}
                  alt="Dr. Juliano Machado - Médico Oftalmologista"
                  className="w-full h-full object-cover object-top"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-card border border-border shadow-lg">
                <span className="text-sm font-semibold text-foreground">CRM Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float hidden lg:block">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse-slow" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
