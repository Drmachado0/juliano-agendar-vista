import { useEffect, useRef, useState } from "react";
import { Star, MessageSquare, ArrowRight } from "lucide-react";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { GOOGLE_REVIEW_URL, GOOGLE_REVIEWS } from "@/lib/constants";
import { formatReviewCount } from "@/lib/utils";

/**
 * Prova social do Google, em forma agregada.
 *
 * POR QUE NAO HA MAIS DEPOIMENTO INDIVIDUAL AQUI, decidido em 29/08/2026 com o
 * medico. Ate esta data a secao exibia cartoes com nome do paciente, foto,
 * nota e texto da avaliacao, num carrossel. A Resolucao CFM 1.974/2011 e o
 * Codigo de Etica Medica restringem depoimento de paciente em publicidade
 * medica, e reproduzir a avaliacao publica do Google no proprio site e
 * publicar depoimento, mesmo que a origem seja publica.
 *
 * A NOTA AGREGADA E OUTRA COISA e por isso continua. Ela nao reproduz relato de
 * paciente identificado, e o dado publico do perfil, e o link leva o
 * interessado a ler no Google, sob a responsabilidade do Google.
 *
 * NAO REINTRODUZA os cartoes sem falar com o medico. O que saiu junto: o
 * carrossel, a paginacao, o auto-rotate, o pool vindo do Supabase e o tipo
 * Testimonial. Ver o commit desta data para recuperar, se um dia a leitura da
 * norma mudar.
 */

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
    />
  </svg>
);

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "fill-accent text-accent" : "text-muted-foreground/30"
        }`}
      />
    ))}
  </div>
);

/*
  SEM PROPS, desde 29/08/2026.

  Havia variant, sectionId, maxVisible, showHeader, showCTA e ariaLabel, mais um
  ramo inteiro para o modo compacto. Nenhum dos tres chamadores passava nada:
  pages/Index.tsx, components/procedimentos/ProcedurePageLayout.tsx e
  pages/procedimentos/CapsulotomiaYagLaser.tsx usam <TestimonialsSection />.
  Superficie configuravel que ninguem configura e so mais coisa para manter.

  O id "depoimentos" fica cravado porque o menu do Header rola ate ele.
*/
const TestimonialsSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reviews = useGoogleReviews();

  const displayRating = reviews.hasRealAggregate
    ? reviews.rating
    : GOOGLE_REVIEWS.rating;
  const displayCount = reviews.hasRealAggregate
    ? reviews.count
    : GOOGLE_REVIEWS.count;
  const ratingLabel = displayRating.toFixed(1);
  const title =
    displayRating >= 4.95 ? "Nota máxima no Google" : "Avaliação dos pacientes no Google";


  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="depoimentos"
      ref={sectionRef}
      aria-label="Avaliações no Google"
      className="py-20 md:py-28 relative overflow-hidden"
    >
      <div className="container mx-auto px-4 max-w-4xl relative">
        {(
          <div
            className={`text-center transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
              <MessageSquare className="w-3.5 h-3.5" />
              Avaliações no Google
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {title.replace(" no Google", "")} <span className="gradient-text">no Google</span>
            </h2>
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              <div className="inline-flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl">
                <Stars rating={Math.round(displayRating)} />
                <span className="font-bold text-foreground text-lg">{ratingLabel}</span>
              </div>
              <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                <GoogleIcon /> baseado em {formatReviewCount(displayCount)} avaliações
              </span>
            </div>
          </div>
        )}

        {(
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
              Ler as avaliações no Google
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
