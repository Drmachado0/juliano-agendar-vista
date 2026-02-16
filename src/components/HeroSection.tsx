import { Button } from "@/components/ui/button";
import { Award, MapPin, Users, Star, Shield, CalendarCheck, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import drJulianoPhoto from "@/assets/dr-juliano-machado.jpg";
import { useGoogleTag } from "@/hooks/useGoogleTag";

interface HeroSectionProps {
  onScheduleClick: () => void;
}

const HeroSection = ({ onScheduleClick }: HeroSectionProps) => {
  const { trackCTAClick } = useGoogleTag();
  const [scrollY, setScrollY] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animated counter for patients
  useEffect(() => {
    const target = 6000;
    const duration = 2000;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[100dvh] flex items-center pt-20 pb-12 hero-gradient overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 -right-32 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px]"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        />
        <div
          className="absolute bottom-1/3 -left-24 w-[400px] h-[400px] bg-accent/6 rounded-full blur-[80px]"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(hsl(42 87% 55% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(42 87% 55% / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 mb-8 opacity-0 animate-fade-in">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground/80 font-medium">
                Membro da Sociedade Brasileira de Oftalmologia
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold leading-[1.1] mb-6 opacity-0 animate-slide-up animation-delay-100">
              <span className="text-foreground">Sua visão merece</span>
              <br />
              <span className="gradient-text">cuidado especializado</span>
            </h1>

            {/* Subtitle with value proposition */}
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0 opacity-0 animate-slide-up animation-delay-200">
              Dr. Juliano Machado — <span className="text-foreground font-medium">+13 anos</span> transformando vidas
              com oftalmologia de excelência em{" "}
              <span className="text-primary font-medium">Paragominas</span> e{" "}
              <span className="text-primary font-medium">Belém</span>.
            </p>

            {/* CTA Group */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10 opacity-0 animate-slide-up animation-delay-400">
              <Button
                variant="hero"
                size="lg"
                onClick={() => {
                  trackCTAClick('agendar_consulta', 'hero', 'Agendar minha consulta');
                  onScheduleClick();
                }}
                className="w-full sm:w-auto text-base py-6 sm:py-3 group relative overflow-hidden"
              >
                <CalendarCheck className="w-5 h-5 mr-1" />
                Agendar minha consulta
                <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  trackCTAClick('saiba_mais', 'hero', 'Conhecer procedimentos');
                  document.getElementById("procedimentos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full sm:w-auto text-base py-6 sm:py-3 border-border/60"
              >
                Conhecer procedimentos
              </Button>
            </div>

            {/* Social proof stats */}
            <div className="grid grid-cols-3 gap-4 lg:gap-6 opacity-0 animate-slide-up animation-delay-600">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">
                    +{count.toLocaleString('pt-BR')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground leading-tight block">
                  pacientes atendidos
                </span>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 mb-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-xl lg:text-2xl font-bold text-foreground">5.0</span>
                </div>
                <span className="text-xs text-muted-foreground leading-tight block">
                  avaliação no Google
                </span>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-1.5 mb-1">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-xl lg:text-2xl font-bold text-foreground">+13 anos</span>
                </div>
                <span className="text-xs text-muted-foreground leading-tight block">
                  de experiência
                </span>
              </div>
            </div>
          </div>

          {/* Doctor Photo */}
          <div className="order-1 lg:order-2 flex justify-center opacity-0 animate-scale-in animation-delay-200">
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/15 rounded-[2rem] blur-3xl scale-90 animate-glow" />

              {/* Photo */}
              <div className="relative w-72 h-80 md:w-[22rem] md:h-[26rem] rounded-[2rem] overflow-hidden border border-primary/15 shadow-2xl shadow-primary/10">
                <img
                  src={drJulianoPhoto}
                  alt="Dr. Juliano Machado - Médico Oftalmologista"
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

                {/* Name overlay */}
                <div className="absolute bottom-0 inset-x-0 p-5">
                  <p className="text-foreground font-bold text-lg font-sans">Dr. Juliano Machado</p>
                  <p className="text-primary text-sm font-medium font-sans">Oftalmologista</p>
                </div>
              </div>

              {/* Location badges */}
              <div className="absolute -left-3 md:-left-6 top-1/3 flex flex-col gap-2 opacity-0 animate-slide-right animation-delay-500">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/90 backdrop-blur-md border border-border/60 shadow-lg">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Paragominas</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/90 backdrop-blur-md border border-border/60 shadow-lg">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Belém</span>
                </div>
              </div>

              {/* Google rating badge */}
              <div className="absolute -right-3 md:-right-6 top-8 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/90 backdrop-blur-md border border-border/60 shadow-lg opacity-0 animate-scale-in animation-delay-700">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm font-bold text-foreground">5.0</span>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-float hidden lg:flex flex-col items-center gap-2 text-muted-foreground/40 hover:text-primary/60 transition-colors cursor-pointer"
        aria-label="Rolar para baixo"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] font-medium font-sans">Saiba mais</span>
        <ChevronDown className="w-5 h-5" />
      </button>
    </section>
  );
};

export default HeroSection;
