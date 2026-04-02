import { Button } from "@/components/ui/button";
import { Award, Users, Star, Shield, CalendarCheck, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import drJulianoHero from "@/assets/dr-juliano-hero.png";
import { useGoogleTag } from "@/hooks/useGoogleTag";

interface HeroSectionProps {
  onScheduleClick: () => void;
}

const HeroSection = ({ onScheduleClick }: HeroSectionProps) => {
  const { trackCTAClick } = useGoogleTag();
  const [count, setCount] = useState(0);

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
    <section className="relative min-h-[75dvh] flex items-center pt-24 sm:pt-24 pb-10 hero-gradient noise-overlay overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Radial glow behind photo area */}
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        {/* Accent teal glow — bottom right */}
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]" />
        {/* Diagonal grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          transform: 'rotate(45deg) scale(1.5)',
          transformOrigin: 'center center',
        }} />
        {/* Decorative line */}
        <div className="absolute top-0 left-1/3 w-px h-24 bg-gradient-to-b from-transparent via-primary/20 to-transparent hidden lg:block" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-[2fr_3fr] gap-8 lg:gap-14 items-center">
          {/* Photo Column — left on desktop */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-1 lg:mt-8 opacity-0 animate-scale-in animation-delay-100 ease-out-expo">
            <div className="relative noise-overlay">
              {/* Glow ring */}
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl" />

              {/* Decorative iris circles */}
              <div className="absolute -bottom-8 -left-8 w-[200px] h-[200px] rounded-full border border-primary/15 hidden lg:block" />
              <div className="absolute -bottom-4 -left-4 w-[140px] h-[140px] rounded-full border border-primary/8 hidden lg:block" />

              {/* Photo container */}
              <div className="relative w-56 h-72 sm:w-64 sm:h-80 md:w-72 md:h-[22rem] lg:w-[22rem] lg:h-[28rem] rounded-[2rem] rounded-bl-[4rem] overflow-hidden border-2 border-primary/25 shadow-2xl shadow-primary/10">
                <img
                  src={drJulianoHero}
                  alt="Dr. Juliano Machado - Médico Oftalmologista"
                  className="w-full h-full object-cover object-top"
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/10 to-transparent" />
              </div>

              {/* Name tag below photo on mobile */}
              <div className="text-center mt-4 lg:hidden">
                <p className="text-foreground font-bold text-lg font-sans">Dr. Juliano Machado</p>
                <p className="text-primary text-sm font-medium">Oftalmologista</p>
              </div>
            </div>
          </div>

          {/* Content Column */}
          <div className="text-center lg:text-left order-2 lg:order-2">
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 mb-6 opacity-0 animate-blur-in animation-delay-300">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-[0.08em]">
                Sociedade Brasileira de Oftalmologia
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-extrabold leading-[1.08] mb-4 opacity-0 animate-slide-up animation-delay-400 tracking-[-0.02em]">
               <span className="text-foreground">Enxergar bem</span>
              <br />
              <span className="gradient-text opacity-0 animate-reveal-up animation-delay-600">muda tudo</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-7 max-w-md mx-auto lg:mx-0 opacity-0 animate-slide-up animation-delay-500">
              <span className="text-foreground font-semibold">Dr. Juliano Machado</span> já devolveu a clareza de visão para mais de 6.000 pacientes em{" "}
              <span className="text-primary font-medium">Paragominas</span> e{" "}
              <span className="text-primary font-medium">Belém</span>. Do primeiro exame à cirurgia, ele cuida de você.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8 opacity-0 animate-slide-up animation-delay-600">
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
                Agendar consulta
                <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  trackCTAClick('saiba_mais', 'hero', 'Conhecer procedimentos');
                  document.getElementById("procedimentos")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full sm:w-auto text-base py-6 sm:py-3 border-primary/35 text-primary/90 hover:border-primary/60 hover:text-primary"
              >
                Ver procedimentos
              </Button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-4 opacity-0 animate-blur-in animation-delay-700">
              <StatCard
                icon={<Users className="w-4 h-4 text-primary" />}
                value={`+${count.toLocaleString('pt-BR')}`}
                label="pacientes atendidos"
              />
              <StatCard
                icon={<Star className="w-4 h-4 text-primary fill-primary" />}
                value="5.0"
                label="nota máxima no Google"
                highlight
                extra={
                  <svg className="w-3.5 h-3.5 ml-1" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                }
              />
              <StatCard
                icon={<Award className="w-4 h-4 text-primary" />}
                value="+13 anos"
                label="de oftalmologia"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={() => document.getElementById("sobre")?.scrollIntoView({ behavior: "smooth" })}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 text-muted-foreground/40 hover:text-primary/60 transition-colors cursor-pointer animate-[float_3s_ease-in-out_infinite]"
        style={{ animationTimingFunction: 'ease-in-out' }}
        aria-label="Rolar para baixo"
      >
        <span className="text-xs uppercase tracking-[0.2em] font-medium font-sans">Conheça o Dr. Juliano</span>
        <ChevronDown className="w-5 h-5" />
      </button>
    </section>
  );
};

/* ---------- Sub-component ---------- */

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  extra?: React.ReactNode;
  highlight?: boolean;
}

const StatCard = ({ icon, value, label, extra, highlight }: StatCardProps) => (
  <div className={`card-shimmer flex flex-col items-center lg:items-start gap-1 px-3 py-3 rounded-xl backdrop-blur-sm ${
    highlight
      ? 'bg-primary/5 border border-primary/30'
      : 'bg-card/50 border border-border/40'
  }`}>
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-lg lg:text-xl font-bold text-foreground tabular-nums">{value}</span>
      {extra}
    </div>
    <span className="text-xs text-muted-foreground leading-tight">{label}</span>
  </div>
);

export default HeroSection;
