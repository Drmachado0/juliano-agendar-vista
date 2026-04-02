import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Star, Quote, Loader2, MessageSquare, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { buscarAvaliacoesGoogle, type AvaliacaoGoogle } from "@/services/avaliacoesGoogle";

interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  image?: string;
  rating: 4 | 5;
  text: string;
  date: string;
  source: 'Google';
}

const AUTO_ROTATE_INTERVAL = 6000;

function convertToTestimonial(avaliacao: AvaliacaoGoogle): Testimonial {
  const initials = avaliacao.author_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return {
    id: avaliacao.id,
    name: avaliacao.author_name,
    avatar: initials,
    image: avaliacao.author_photo_url || undefined,
    rating: (avaliacao.rating >= 4 ? avaliacao.rating : 4) as 4 | 5,
    text: avaliacao.text || "Excelente atendimento!",
    date: avaliacao.relative_time_description || "Avaliação recente",
    source: 'Google',
  };
}

const TestimonialsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedTestimonials, setDisplayedTestimonials] = useState<Testimonial[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  const { data: avaliacoesGoogle, isLoading } = useQuery({
    queryKey: ['avaliacoes-google'],
    queryFn: buscarAvaliacoesGoogle,
    staleTime: 1000 * 60 * 30,
  });

  const allTestimonials = useMemo(() => {
    if (avaliacoesGoogle && avaliacoesGoogle.length > 0) {
      return avaliacoesGoogle.map(convertToTestimonial);
    }
    return [];
  }, [avaliacoesGoogle]);

  const shuffleArray = useCallback((array: Testimonial[]): Testimonial[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  const loadNewTestimonials = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      const shuffled = shuffleArray(allTestimonials);
      setDisplayedTestimonials(shuffled.slice(0, 3));
      setIsTransitioning(false);
    }, 400);
  }, [shuffleArray, allTestimonials]);

  useEffect(() => {
    if (allTestimonials.length > 0) {
      const shuffled = shuffleArray(allTestimonials);
      setDisplayedTestimonials(shuffled.slice(0, 3));
    }
  }, [shuffleArray, allTestimonials]);

  useEffect(() => {
    if (isHovered || allTestimonials.length <= 3) {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
        autoRotateRef.current = null;
      }
      return;
    }
    autoRotateRef.current = setInterval(() => loadNewTestimonials(), AUTO_ROTATE_INTERVAL);
    return () => { if (autoRotateRef.current) clearInterval(autoRotateRef.current); };
  }, [isHovered, loadNewTestimonials, allTestimonials.length]);

  const averageRating = useMemo(() => {
    if (displayedTestimonials.length === 0) return "5.0";
    const sum = displayedTestimonials.reduce((acc, t) => acc + t.rating, 0);
    return (sum / displayedTestimonials.length).toFixed(1);
  }, [displayedTestimonials]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${index < rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
      />
    ));

  const GoogleIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  return (
    <section id="depoimentos" className="py-20 md:py-28 bg-gradient-to-b from-secondary/20 via-background to-secondary/20 relative noise-overlay" ref={sectionRef}>
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Giant decorative quote */}
      <div className="absolute top-20 left-10 opacity-[0.02] pointer-events-none hidden lg:block">
        <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor" className="text-foreground">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>
      </div>

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            <MessageSquare className="w-3.5 h-3.5" />
            O que dizem os pacientes
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nota máxima <span className="gradient-text">no Google</span>
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl">
              <div className="flex items-center gap-0.5">
                {renderStars(Math.round(parseFloat(averageRating)))}
              </div>
              <span className="font-bold text-foreground text-lg">{averageRating}</span>
            </div>
            <span className="text-muted-foreground text-sm flex items-center gap-1.5">
              <GoogleIcon /> {allTestimonials.length > 0 ? `baseado em ${allTestimonials.length} avaliações` : 'no Google'}
            </span>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && allTestimonials.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>As avaliações estão sendo carregadas.</p>
          </div>
        )}

        {/* Testimonials Grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {displayedTestimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`card-shimmer card-glass rounded-2xl p-6 relative overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 ease-out-expo ${
                isVisible
                  ? isTransitioning
                    ? 'opacity-0 scale-95 translate-y-2'
                    : 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 scale-90'
              }`}
              style={{ transitionDelay: isVisible && !isTransitioning ? `${index * 100}ms` : '0ms' }}
            >
              {/* Top gradient accent line */}
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
                background: 'linear-gradient(to right, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3), transparent)'
              }} />

              {/* Quote watermark */}
              <Quote className="absolute top-5 right-5 w-10 h-10 text-primary/6 animate-pulse-slow" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                {testimonial.image ? (
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20 ring-offset-2 ring-offset-card"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center text-primary font-semibold text-sm ring-2 ring-primary/20 ring-offset-2 ring-offset-card">
                    {testimonial.avatar}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-foreground text-sm font-sans">{testimonial.name}</h4>
                  <p className="text-xs text-muted-foreground">{testimonial.date}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {renderStars(testimonial.rating)}
              </div>

              {/* Text */}
              <p className="text-muted-foreground text-sm leading-relaxed italic">
                "{testimonial.text}"
              </p>

              {/* Google Badge */}
              <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/40">
                <GoogleIcon />
                <span className="text-xs text-muted-foreground font-medium">Avaliação verificada do Google</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={`text-center mt-10 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <a
            href="https://g.page/r/CTkTpXB1m13mEBI/review"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-card border border-primary/30 hover:border-primary/50 transition-all text-foreground font-medium text-sm hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10"
          >
            <GoogleIcon />
            Ler todas as avaliações no Google
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
