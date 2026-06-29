import { Button } from "@/components/ui/button";
import { Star, CalendarCheck, MessageCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import drJulianoHeroJpg from "@/assets/dr-juliano-hero.jpg";
import drJulianoHeroVideo from "@/assets/dr-juliano-hero.mp4";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { DOCTOR, GOOGLE_REVIEWS } from "@/lib/constants";

const HeroSection = () => {
  const { trackCTAClick, trackWhatsAppClick } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const heroWaUrl = waLink("Olá! Vi o site do Dr. Juliano Machado e gostaria de agendar uma consulta oftalmológica.");
  const [count, setCount] = useState(0);

  // Animated counter for patients
  useEffect(() => {
    const target = DOCTOR.patientsServed;
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
    <section className="relative overflow-hidden hero-gradient min-h-[92vh] flex items-center pt-28 pb-16 sm:pt-32">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* deep teal glow — afastado da foto */}
        <div className="absolute top-[30%] left-[28%] w-[520px] h-[520px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[440px] h-[440px] rounded-full bg-primary/5 blur-[110px]" />
        {/* fine grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at 35% 40%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 35% 40%, black, transparent 70%)",
          }}
        />
        {/* drifting eye-light beam */}
        <div className="absolute top-1/3 left-1/4 w-[360px] h-[100px] bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-2xl animate-eye-light" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-center">
          {/* Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            {/* Credential eyebrow (CFM) */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel mb-7 opacity-0 animate-fade-in animation-delay-200">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-foreground/90 tracking-wide">
                {DOCTOR.specialty} · {DOCTOR.crm}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-[5rem] font-extrabold leading-[0.95] uppercase mb-6 opacity-0 animate-slide-up animation-delay-300">
              <span className="text-foreground">Enxergar bem</span>
              <br />
              <span className="gradient-text-accent">muda tudo.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-9 max-w-xl mx-auto lg:mx-0 opacity-0 animate-slide-up animation-delay-400">
              Há mais de <span className="text-foreground font-semibold">{DOCTOR.yearsExperience} anos</span>, o{" "}
              <span className="text-foreground font-semibold">{DOCTOR.name}</span> une tecnologia diagnóstica e cuidado
              próximo para avaliar e tratar a sua visão — em{" "}
              <span className="text-primary font-medium">Paragominas</span> e{" "}
              <span className="text-primary font-medium">Belém</span>. Do exame à cirurgia.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-9 opacity-0 animate-slide-up animation-delay-500">
              <Link to="/agendamento" className="w-full sm:w-auto">
                <Button
                  variant="obsidian"
                  size="lg"
                  onClick={() => trackCTAClick("agendar_consulta", "hero", "Agendar avaliação")}
                  className="w-full sm:w-auto text-base group"
                >
                  <CalendarCheck className="w-5 h-5" />
                  Agendar avaliação
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a
                href={heroWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(heroWaUrl, "Falar no WhatsApp", "whatsapp_hero", "hero")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-14 rounded-full px-8 text-base font-semibold glass-panel text-foreground hover:bg-white/10 transition-all duration-300"
              >
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                Falar no WhatsApp
              </a>
            </div>

            {/* Social proof — glass strip */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 opacity-0 animate-fade-in animation-delay-600">
              <ProofChip
                main={
                  <span className="inline-flex items-center gap-1">
                    <span className="font-bold">{GOOGLE_REVIEWS.rating.toFixed(1)}</span>
                    <span className="inline-flex text-accent">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </span>
                  </span>
                }
                sub={`${GOOGLE_REVIEWS.count} avaliações · Google`}
              />
              <ProofChip main={<span className="font-bold">+{count.toLocaleString("pt-BR")}</span>} sub="pacientes atendidos" />
              <ProofChip main={<span className="font-bold">+{DOCTOR.yearsExperience} anos</span>} sub="de oftalmologia" />
            </div>
          </div>

          {/* Photo */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2 opacity-0 animate-scale-in animation-delay-200 ease-out-expo">
            <div className="relative">
              {/* iris ring decoration */}
              <div className="absolute -inset-8 rounded-full border border-primary/10 animate-iris hidden lg:block" />
              {/* teal halo (atrás da foto) */}
              <div className="absolute -inset-3 rounded-[2.2rem] bg-gradient-to-br from-primary/20 to-transparent blur-2xl" />

              {/* photo / living portrait */}
              <div className="relative w-64 h-80 sm:w-72 sm:h-[24rem] lg:w-[23rem] lg:h-[30rem] rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-2xl bg-card">
                <video
                  src={drJulianoHeroVideo}
                  poster={drJulianoHeroJpg}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label={`${DOCTOR.name} - Médico ${DOCTOR.specialty}`}
                  className="w-full h-full object-cover object-top"
                />
                {/* leve fade só na base */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />
                {/* teal rim light */}
                <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-primary/15" />
              </div>

              {/* Floating glass credential card */}
              <div className="absolute -bottom-5 -left-4 sm:-left-10 glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 opacity-0 animate-slide-up animation-delay-700">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground leading-tight">{DOCTOR.name}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{DOCTOR.crm}</p>
                </div>
              </div>

              {/* Floating Google rating chip */}
              <div className="absolute top-4 -right-3 sm:-right-6 glass-panel rounded-xl px-3 py-2 flex items-center gap-1.5 opacity-0 animate-slide-up animation-delay-700">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="text-sm font-bold text-foreground">{GOOGLE_REVIEWS.rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">Google</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Sub-component ---------- */

const ProofChip = ({ main, sub }: { main: React.ReactNode; sub: string }) => (
  <div className="glass-panel rounded-xl px-4 py-2.5 text-left">
    <div className="text-base text-foreground leading-none mb-1">{main}</div>
    <div className="text-xs text-muted-foreground leading-none">{sub}</div>
  </div>
);

export default HeroSection;
