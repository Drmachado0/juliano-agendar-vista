import { Button } from "@/components/ui/button";
import { Award, MapPin, Star, Users, Stethoscope, Eye, Scissors } from "lucide-react";
import drJulianoPhoto from "@/assets/dr-juliano-machado.jpg";

interface HeroSectionProps {
  onScheduleClick: () => void;
}

const HeroSection = ({ onScheduleClick }: HeroSectionProps) => {
  const stats = [
    { icon: Users, value: "+5.000", label: "pacientes atendidos" },
    { icon: Award, value: "+13 anos", label: "ajudando pessoas a enxergarem melhor" },
    { icon: MapPin, value: "Paragominas", label: "e Belém" },
    { icon: Star, value: "Referência", label: "em nossa região" },
  ];

  const services = [
    { icon: Stethoscope, label: "Consultas" },
    { icon: Eye, label: "Exames" },
    { icon: Scissors, label: "Cirurgias" },
  ];

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
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-xl mx-auto lg:mx-0 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Oftalmologia que combina <span className="text-primary font-medium">experiência</span> e <span className="text-primary font-medium">tecnologia</span>.
            </p>

            {/* Services Pills */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-8 animate-slide-up" style={{ animationDelay: "0.15s" }}>
              {services.map((service, index) => (
                <div key={index} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <service.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{service.label}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button variant="hero" size="lg" onClick={onScheduleClick}>
                Agendar consulta
              </Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}>
                Saiba mais
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: "0.3s" }}>
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="group relative p-4 rounded-xl bg-secondary/50 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <stat.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-lg font-bold text-primary">{stat.value}</span>
                  </div>
                  <span className="text-xs text-muted-foreground leading-tight block">{stat.label}</span>
                </div>
              ))}
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
                <span className="text-sm font-semibold text-foreground">Oftalmologista</span>
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
