import { Button } from "@/components/ui/button";
import { Star, CalendarCheck, MessageCircle, ShieldCheck, ArrowRight, MapPin, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import drJulianoHeroWebp from "@/assets/dr-juliano-hero.webp";
import drJulianoHeroVideo from "@/assets/dr-juliano-hero.mp4";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { DOCTOR } from "@/lib/constants";
import { formatReviewCount } from "@/lib/utils";

const HeroSection = () => {
  const { trackCTAClick, trackWhatsAppClick } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const reviews = useGoogleReviews();
  const heroWaUrl = waLink(
    "Olá! Vi o site do Dr. Juliano Machado e gostaria de agendar uma consulta oftalmológica em Paragominas.",
    "home_hero"
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  // Renderiza o vídeo sempre que possível (inclusive mobile).
  // Só desabilita se o usuário pediu reduced-motion ou está em save-data/2g.
  const [enableVideo, setEnableVideo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as any).connection;
    const saveData = !!(conn && (conn.saveData || /2g/.test(conn.effectiveType || "")));
    setEnableVideo(!reducedMotion && !saveData);
  }, []);

  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };


  return (
    <section className="relative overflow-hidden hero-gradient min-h-[88vh] lg:min-h-[92vh] flex items-center pt-24 pb-12 sm:pt-32 sm:pb-16">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[30%] left-[28%] w-[420px] h-[420px] rounded-full bg-primary/8 blur-[110px]" />
        <div className="absolute -bottom-40 -left-40 w-[360px] h-[360px] rounded-full bg-primary/5 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.04] hidden sm:block"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at 35% 40%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 35% 40%, black, transparent 70%)",
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-center">
          {/* Content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            {/* City + credential eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel mb-5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground/90 tracking-wide uppercase">
                Oftalmologista em Paragominas e Belém
              </span>
            </div>

            {/* Heading — LCP, sem animação de opacity/delay */}
            <h1 className="text-[2rem] leading-[1.1] sm:text-4xl lg:text-[3.5rem] font-extrabold mb-5 text-foreground">
              Cuide da sua visão com{" "}
              <span className="gradient-text-accent">atendimento em Paragominas e Belém</span>
            </h1>

            {/* Subtitle — apoio direto */}
            <p className="text-[15px] sm:text-lg text-muted-foreground leading-relaxed mb-7 max-w-xl mx-auto lg:mx-0">
              Consultas e acompanhamento oftalmológico com o{" "}
              <span className="text-foreground font-semibold">{DOCTOR.name}</span> na{" "}
              <span className="text-foreground font-semibold">Clinicor</span> e no{" "}
              <span className="text-foreground font-semibold">HGP</span> (Paragominas), e no{" "}
              <span className="text-foreground font-semibold">IOB</span> e{" "}
              <span className="text-foreground font-semibold">Vitria</span> (Belém).
            </p>

            {/* CTAs — CTA primária "Ver horários disponíveis" */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
              <Link to="/agendamento" className="w-full sm:w-auto">
                <Button
                  variant="obsidian"
                  size="lg"
                  onClick={() => trackCTAClick("ver_horarios", "hero", "Ver horários disponíveis")}
                  className="w-full sm:w-auto text-base group min-h-[52px]"
                >
                  <CalendarCheck className="w-5 h-5" />
                  Ver horários disponíveis
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <a
                href={heroWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(heroWaUrl, "Falar no WhatsApp", "whatsapp_hero", "hero")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[52px] rounded-full px-8 text-base font-semibold glass-panel text-foreground hover:bg-white/10 transition-all duration-300"
              >
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                Falar no WhatsApp
              </a>
            </div>

            {/* Trust line — CRM + nota real, sem números inventados */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span className="font-medium text-foreground/90">{DOCTOR.crm}</span>
              </span>
              <span className="inline-flex items-center gap-1.5" aria-label={`${reviews.rating.toFixed(1)} de 5 no Google`}>
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                <span className="font-semibold text-foreground/90">{reviews.rating.toFixed(1)}</span>
                <span>({formatReviewCount(reviews.count)} avaliações)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary" />
                {DOCTOR.yearsExperienceLong}
              </span>
            </div>
          </div>

          {/* Portrait — menor no mobile pra CTA aparecer above the fold */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2">
            <div className="relative">
              <div className="absolute -inset-8 rounded-full border border-primary/10 hidden lg:block" />
              <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/15 to-transparent blur-2xl" />

              <div className="relative w-44 h-56 sm:w-64 sm:h-80 lg:w-[23rem] lg:h-[30rem] rounded-[1.75rem] lg:rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-2xl bg-card">
                {enableVideo ? (
                  <>
                    <video
                      ref={videoRef}
                      src={drJulianoHeroVideo}
                      poster={drJulianoHeroWebp}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="none"
                      aria-label={`${DOCTOR.name} - ${DOCTOR.specialty}`}
                      className="w-full h-full object-cover object-top"
                      onPlay={() => setVideoPaused(false)}
                      onPause={() => setVideoPaused(true)}
                    />
                    <button
                      type="button"
                      onClick={toggleVideo}
                      aria-label={videoPaused ? "Reproduzir vídeo" : "Pausar vídeo"}
                      className="absolute bottom-2 right-2 z-10 w-9 h-9 rounded-full glass-panel flex items-center justify-center text-foreground/90 hover:text-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                    >
                      {videoPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  </>
                ) : (
                  <img
                    src={drJulianoHeroWebp}
                    alt={`${DOCTOR.name} - ${DOCTOR.specialty}`}
                    width={368}
                    height={480}
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as any)}
                    className="w-full h-full object-cover object-top"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                <div className="absolute inset-0 rounded-[1.75rem] lg:rounded-[2rem] ring-1 ring-inset ring-primary/15 pointer-events-none" />
              </div>

              {/* Google rating chip — só desktop pra reduzir ruído no mobile */}
              <div className="absolute top-4 -right-3 sm:-right-6 hidden sm:flex glass-panel rounded-xl px-3 py-2 items-center gap-1.5">
                <Star className="w-4 h-4 text-accent fill-accent" />
                <span className="text-sm font-bold text-foreground">{reviews.rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">Google</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
