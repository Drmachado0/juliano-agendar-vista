import { Button } from "@/components/ui/button";
import { Eye, Award, Clock, MapPin } from "lucide-react";

interface HeroSectionProps {
  onScheduleClick: () => void;
}

const HeroSection = ({ onScheduleClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 hero-gradient overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-8 animate-fade-in">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Especialista em Oftalmologia</span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up">
            <span className="text-foreground">Dr. Juliano</span>
            <br />
            <span className="gradient-text">Machado</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Cuidando da sua visão com excelência e tecnologia de ponta. 
            Atendimento humanizado em Paragominas e Belém.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="lg" onClick={onScheduleClick}>
              Agendar consulta
            </Button>
            <Button variant="outline" size="lg" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>
              Saiba mais
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="card-glass rounded-2xl p-6 text-center">
              <Award className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-2xl font-bold text-foreground mb-1">+15 anos</div>
              <div className="text-sm text-muted-foreground">de experiência</div>
            </div>
            <div className="card-glass rounded-2xl p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-2xl font-bold text-foreground mb-1">Atendimento</div>
              <div className="text-sm text-muted-foreground">personalizado</div>
            </div>
            <div className="card-glass rounded-2xl p-6 text-center">
              <MapPin className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-2xl font-bold text-foreground mb-1">3 locais</div>
              <div className="text-sm text-muted-foreground">de atendimento</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-primary rounded-full animate-pulse-slow" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
