import { useEffect, useMemo, useRef, useState } from "react";
import {
  Star,
  Quote,
  Loader2,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { buscarAvaliacoesGoogle, type AvaliacaoGoogle } from "@/services/avaliacoesGoogle";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { GOOGLE_REVIEW_URL } from "@/lib/constants";
import { formatReviewCount } from "@/lib/utils";
import {
  useDocumentHidden,
  useItemsPerPage,
  useReducedMotion,
  useTestimonialsCarousel,
} from "@/hooks/useTestimonialsCarousel";

interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  image?: string;
  rating: number;
  text: string;
  date: string;
  source: "Google";
}

const AUTO_ROTATE_INTERVAL = 6000;
const MAX_CARDS = 20;
const TEXT_TRUNCATE_AT = 220;

function initialsFrom(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function convertToTestimonial(avaliacao: AvaliacaoGoogle): Testimonial | null {
  const text = (avaliacao.text || "").trim();
  // Sem texto real => omitir do carrossel textual (regra do briefing).
  if (!text) return null;
  return {
    id: avaliacao.id,
    name: avaliacao.author_name,
    avatar: initialsFrom(avaliacao.author_name),
    image: avaliacao.author_photo_url || undefined,
    rating: Math.max(1, Math.min(5, Math.round(avaliacao.rating || 5))),
    text,
    date: avaliacao.relative_time_description || "Avaliação recente",
    source: "Google",
  };
}

/** Deduplica por google_review_id (canônico), com fallback ao id da linha. */
function dedupe(list: AvaliacaoGoogle[]): AvaliacaoGoogle[] {
  const seen = new Set<string>();
  const out: AvaliacaoGoogle[] = [];
  for (const item of list) {
    const key = item.google_review_id || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Stars = ({ rating }: { rating: number }) => (
  <span className="inline-flex" role="img" aria-label={`${rating} de 5 estrelas`}>
    {Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        aria-hidden="true"
        className={`w-4 h-4 ${index < rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
      />
    ))}
  </span>
);

const TestimonialCard = ({ t }: { t: Testimonial }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncate = t.text.length > TEXT_TRUNCATE_AT;
  const shown = expanded || !needsTruncate ? t.text : t.text.slice(0, TEXT_TRUNCATE_AT).trimEnd() + "…";
  return (
    <article
      className="card-shimmer card-glass rounded-2xl p-6 relative overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500 ease-out-expo h-full flex flex-col"
      aria-roledescription="depoimento"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(to right, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3), transparent)",
        }}
      />
      <Quote className="absolute top-5 right-5 w-10 h-10 text-primary/6 animate-pulse-slow" aria-hidden="true" />

      <div className="flex items-center gap-3 mb-4">
        {t.image ? (
          <img
            src={t.image}
            alt={`Foto de ${t.name}`}
            loading="lazy"
            decoding="async"
            width={44}
            height={44}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20 ring-offset-2 ring-offset-card"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center text-primary font-semibold text-sm ring-2 ring-primary/20 ring-offset-2 ring-offset-card">
            {t.avatar}
          </div>
        )}
        <div>
          <h4 className="font-semibold text-foreground text-sm font-sans">{t.name}</h4>
          <p className="text-xs text-muted-foreground">{t.date}</p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 mb-3">
        <Stars rating={t.rating} />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed italic flex-1">
        &ldquo;{shown}&rdquo;
      </p>

      {needsTruncate && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start mt-3 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
          aria-expanded={expanded}
        >
          {expanded ? "Ler menos" : "Ler mais"}
        </button>
      )}

      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/40">
        <GoogleIcon />
        <span className="text-xs text-muted-foreground font-medium">Avaliação verificada do Google</span>
      </div>
    </article>
  );
};

const TestimonialsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reviews = useGoogleReviews();

  const { data: avaliacoesGoogle, isLoading } = useQuery({
    queryKey: ["avaliacoes-google"],
    queryFn: buscarAvaliacoesGoogle,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  const pool = useMemo<Testimonial[]>(() => {
    if (!avaliacoesGoogle || avaliacoesGoogle.length === 0) return [];
    const deduped = dedupe(avaliacoesGoogle);
    // Ordena por data mais recente e depois rating — não altera conteúdo.
    const sorted = [...deduped].sort((a, b) => {
      const tb = b.time_epoch || 0;
      const ta = a.time_epoch || 0;
      if (tb !== ta) return tb - ta;
      return (b.rating || 0) - (a.rating || 0);
    });
    const converted = sorted
      .map(convertToTestimonial)
      .filter((x): x is Testimonial => x !== null);
    return converted.slice(0, MAX_CARDS);
  }, [avaliacoesGoogle]);

  // Nota exibida: prioriza agregado real vindo do Google (site_config).
  const displayRating = reviews.hasRealAggregate
    ? reviews.rating
    : pool.length > 0
    ? pool.reduce((acc, t) => acc + t.rating, 0) / pool.length
    : 5.0;
  const ratingLabel = displayRating.toFixed(1);
  const title = displayRating >= 4.95 ? "Nota máxima no Google" : "Avaliação dos pacientes no Google";

  // Contagem exibida: apenas real; sem valor fixo se o agregado ainda não veio.
  const displayCount = reviews.hasRealAggregate ? reviews.count : pool.length;

  // Layout responsivo + auto-rotate controls.
  const itemsPerPage = useItemsPerPage();
  const reducedMotion = useReducedMotion();
  const documentHidden = useDocumentHidden();
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  const { page, pageCount, next, prev, goTo, isPaused, userPaused, setUserPaused } =
    useTestimonialsCarousel({
      totalItems: pool.length,
      itemsPerPage,
      intervalMs: AUTO_ROTATE_INTERVAL,
      paused: hovering || focusWithin || documentHidden,
      reducedMotion,
    });

  // Swipe horizontal simples para o mobile.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  // Item pageado com wrap-around para manter grid completo.
  const visible = useMemo(() => {
    if (pool.length === 0) return [] as Testimonial[];
    if (pool.length <= itemsPerPage) return pool;
    const start = page * itemsPerPage;
    const arr: Testimonial[] = [];
    for (let i = 0; i < itemsPerPage; i++) {
      arr.push(pool[(start + i) % pool.length]);
    }
    return arr;
  }, [pool, page, itemsPerPage]);

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

  return (
    <section
      id="depoimentos"
      className="py-20 md:py-28 bg-gradient-to-b from-secondary/20 via-background to-secondary/20 relative noise-overlay"
      ref={sectionRef}
      aria-label="Depoimentos de pacientes"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="absolute top-20 left-10 opacity-[0.02] pointer-events-none hidden lg:block" aria-hidden="true">
        <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor" className="text-foreground">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>
      </div>

      <div className="container mx-auto px-4">
        {/* Header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            <MessageSquare className="w-3.5 h-3.5" />
            O que dizem os pacientes
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {title.includes("Google") ? (
              <>
                {title.replace(" no Google", "")} <span className="gradient-text">no Google</span>
              </>
            ) : (
              title
            )}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl">
              <div className="flex items-center gap-0.5">
                <Stars rating={Math.round(displayRating)} />
              </div>
              <span className="font-bold text-foreground text-lg">{ratingLabel}</span>
            </div>
            <span className="text-muted-foreground text-sm flex items-center gap-1.5">
              <GoogleIcon /> baseado em {formatReviewCount(displayCount)} avaliações
            </span>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Carregando avaliações" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && pool.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>As avaliações estão sendo carregadas.</p>
          </div>
        )}

        {/* Carousel */}
        {pool.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setFocusWithin(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
            }}
          >
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              aria-roledescription="carrossel"
              aria-label="Avaliações reais do Google"
            >
              {visible.map((t, i) => (
                <TestimonialCard key={`${t.id}-p${page}-i${i}`} t={t} />
              ))}
            </div>

            {/* Controls */}
            {pageCount > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={prev}
                    className="w-11 h-11 rounded-full border border-border/60 bg-card hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Avaliações anteriores"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserPaused((v) => !v)}
                    className="w-11 h-11 rounded-full border border-border/60 bg-card hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={userPaused ? "Retomar rotação automática" : "Pausar rotação automática"}
                    aria-pressed={userPaused}
                  >
                    {userPaused || reducedMotion ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="w-11 h-11 rounded-full border border-border/60 bg-card hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label="Próximas avaliações"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5" role="tablist" aria-label="Página de avaliações">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === page}
                      aria-label={`Ir para página ${i + 1} de ${pageCount}`}
                      onClick={() => goTo(i)}
                      className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        i === page ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* aria-live: apenas status curto de página, não o depoimento inteiro. */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {pageCount > 1
                ? `Página ${page + 1} de ${pageCount}${isPaused ? " — pausado" : ""}`
                : ""}
            </p>
          </div>
        )}

        {/* CTA */}
        <div
          className={`text-center mt-10 transition-all duration-700 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <a
            href={GOOGLE_REVIEW_URL}
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
