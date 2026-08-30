import { useState } from "react";
import { Star, MessageSquare, ArrowRight, Plus, PencilLine } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { useTestimonials } from "@/hooks/useTestimonials";
import { GOOGLE_REVIEW_URL } from "@/lib/constants";
import { formatReviewCount, initialsFrom } from "@/lib/utils";
import { type TestimonialItem } from "@/lib/testimonialsPool";

/**
 * Prova social das avaliacoes do Google, com o comentario visivel.
 *
 * DECISAO E CONTRADECISAO, ambas em 29/08/2026. De manha esta secao perdeu os
 * cartoes de depoimento na Fase 0 do ajuste as normas de publicidade medica,
 * pela leitura de que reproduzir a avaliacao publica do Google no proprio site
 * e publicar depoimento de paciente. A noite o medico revisou, foi avisado do
 * conflito com a decisao dele mesmo, e pediu os comentarios completos de volta.
 * A escolha e dele e esta registrada aqui de proposito.
 *
 * O ALCANCE E SO ESTA SECAO, que aparece na home e em 12 paginas de
 * procedimento. /agendamento e /paragominas continuam sem depoimento, como
 * ficaram na Fase 0. Se um dia isso voltar atras de novo, os quatro pontos
 * estao mapeados na mensagem do commit 9170e90.
 *
 * NAO E O CARROSSEL ANTIGO. O formato anterior girava tres cartoes de cada vez,
 * com auto-rotate, paginacao e swipe. As 17 avaliacoes tem 94 caracteres em
 * media, texto curto demais para justificar aquele maquinario. Viraram um mural
 * que mostra seis e abre o resto num clique: sem timer, sem estado de pagina,
 * sem pausar em hover, e o leitor le no ritmo dele.
 *
 * REDESENHO PROVA SOCIAL. O agregado subiu de uma linha no subtitulo para um
 * painel proprio: nota gigante, estrelas, total de avaliacoes e o retrato de
 * quem avaliou, no formato que o visitante reconhece do perfil do Google. O
 * mural embaixo continua o mesmo conceito, cartao com cara da avaliacao
 * original: avatar, nome, data, estrelas, texto, selo do Google no canto.
 */

/** Quantos cartoes aparecem antes de o visitante pedir mais. */
const INITIAL_VISIBLE = 6;

/** Quantos retratos entram no empilhado do painel agregado. */
const AVATAR_STACK_SIZE = 5;

/** Teto do atraso escalonado, para o ultimo cartao nao entrar meio segundo depois. */
const MAX_STAGGER_STEPS = 6;
const STAGGER_MS = 70;

/** URL publica da aba de avaliacoes do perfil no Google Maps, para leitura. */
const GOOGLE_MAPS_REVIEWS_URL =
  "https://www.google.com/maps/place/Dr+Juliano+Machado+-+Oftalmologista/@-2.9927566,-47.3578126,17z/data=!4m8!3m7!1s0x92b75df6a9424bcf:0xe65d9b7570a51339!8m2!3d-2.9927566!4d-47.3552377!9m1!1b1!16s%2Fg%2F11l2j4k6yb";

const GoogleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
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

const Stars = ({ rating, className = "w-4 h-4" }: { rating: number; className?: string }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} de 5 estrelas`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        aria-hidden="true"
        className={`${className} ${i < rating ? "fill-accent text-accent" : "text-muted-foreground/25"}`}
      />
    ))}
  </span>
);

/*
  A FOTO VEM DO GOOGLE, de lh3.googleusercontent.com, e nao do nosso dominio.
  Por isso referrerPolicy no-referrer, para nao contar ao Google de qual pagina
  do site o visitante veio.

  O FALLBACK E DO RADIX, via components/ui/avatar. Ele ja mostra as iniciais
  enquanto a imagem carrega e continua nelas se a URL expirar, o que acontece
  sozinho com o tempo. A versao anterior refazia essa maquina de estado a mao.
*/
const ReviewerAvatar = ({
  name,
  src,
  sizeClass = "w-10 h-10",
  textClass = "text-xs",
  ringClass = "ring-1 ring-primary/20",
}: {
  name: string;
  src?: string;
  sizeClass?: string;
  textClass?: string;
  ringClass?: string;
}) => (
  <Avatar className={`${sizeClass} ${ringClass}`}>
    <AvatarImage
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="object-cover"
    />
    <AvatarFallback
      className={`bg-gradient-to-br from-primary/25 to-primary/10 text-primary font-semibold ${textClass}`}
    >
      {initialsFrom(name)}
    </AvatarFallback>
  </Avatar>
);

/*
  RETRATOS EMPILHADOS, a prova social com rosto. Mostra os primeiros autores do
  pool e um "+N" com o restante do TOTAL do perfil, nao do pool: quem le ve o
  tamanho real da amostra, o mesmo numero do HeroSection.
*/
const AvatarStack = ({ pool, total }: { pool: TestimonialItem[]; total: number }) => {
  const faces = pool.slice(0, AVATAR_STACK_SIZE);
  const rest = Math.max(0, total - faces.length);

  return (
    <div className="flex items-center" aria-hidden="true">
      <div className="flex -space-x-2.5">
        {faces.map((t) => (
          <ReviewerAvatar
            key={t.id}
            name={t.name}
            src={t.image}
            sizeClass="w-9 h-9"
            textClass="text-[0.625rem]"
            ringClass="ring-2 ring-background"
          />
        ))}
        {rest > 0 && (
          <div className="w-9 h-9 shrink-0 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-[0.625rem] ring-2 ring-background">
            +{rest}
          </div>
        )}
      </div>
    </div>
  );
};

/*
  PAINEL AGREGADO, a peca que transforma a secao em prova social. Nota gigante
  e estrelas a esquerda, retratos e total ao centro, acoes a direita: ler no
  Google Maps e deixar avaliacao, a mesma dupla do perfil original. No mobile
  empilha tudo.
*/
const AggregatePanel = ({
  rating,
  count,
  pool,
}: {
  rating: number;
  count: number;
  pool: TestimonialItem[];
}) => (
  <div className="card-glass rounded-3xl border border-border/50 p-6 md:p-8 relative overflow-hidden">
    <div
      className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none"
      aria-hidden="true"
    />

    <div className="flex flex-col md:flex-row md:items-center gap-8 relative">
      <div className="flex items-center gap-5 md:pr-8 md:border-r md:border-border/50">
        <span className="text-6xl md:text-7xl font-bold leading-none text-foreground tabular-nums">
          {rating.toFixed(1)}
        </span>
        <div className="space-y-1.5">
          <Stars rating={Math.round(rating)} className="w-5 h-5" />
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
            <GoogleIcon className="w-3.5 h-3.5" />
            {formatReviewCount(count)} avaliações
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {pool.length > 0 && <AvatarStack pool={pool} total={count} />}
        <p className="text-sm md:text-[0.9375rem] text-muted-foreground leading-relaxed max-w-md">
          Avaliações públicas de pacientes no perfil do Google, reproduzidas aqui sem edição.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:pl-8 md:border-l md:border-border/50">
        <a
          href={GOOGLE_MAPS_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 whitespace-nowrap"
        >
          <GoogleIcon />
          Ler no Google
          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
        </a>
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border/60 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors whitespace-nowrap"
        >
          <PencilLine className="w-4 h-4" />
          Avaliar no Google
        </a>
      </div>
    </div>
  </div>
);

/*
  FIGURE COM BLOCKQUOTE, e nao article com paragrafo. A citacao tem autor, e
  figcaption e o unico lugar do HTML que atribui uma citacao sem inventar um
  heading. O nome nao vira h3 nem h4: 17 nomes de paciente no outline do
  documento seriam 17 secoes falsas da pagina.

  A ENTRADA E CSS, nao estado. Usa .animate-slide-up, que ja existe no
  index.css, com animation-delay para o escalonado e fill-mode both para o
  cartao nao piscar visivel antes da vez dele. A versao anterior gastava um
  useState, um useEffect e um requestAnimationFrame por cartao para fazer o
  mesmo, e ainda deixava o HTML pre-renderizado com opacity zero.
*/
const ReviewCard = ({ t, delayMs }: { t: TestimonialItem; delayMs: number }) => (
  <figure
    style={{ animationDelay: `${delayMs}ms`, animationFillMode: "both" }}
    className="card-glass animate-slide-up break-inside-avoid mb-5 rounded-2xl p-5 border border-border/50 relative transition-colors hover:border-primary/30"
  >
    <div className="flex items-center gap-3">
      <ReviewerAvatar name={t.name} src={t.image} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground text-sm truncate">{t.name}</p>
        <p className="text-xs text-muted-foreground">{t.date}</p>
      </div>
      <GoogleIcon className="w-4 h-4 shrink-0 opacity-60" />
    </div>

    <div className="mt-3">
      <Stars rating={t.rating} className="w-3.5 h-3.5" />
    </div>

    <blockquote className="mt-2.5 text-[0.9375rem] leading-relaxed text-foreground/85">
      {t.text}
    </blockquote>

    <figcaption className="mt-3 pt-3 border-t border-border/40 text-[0.6875rem] uppercase tracking-wide text-muted-foreground/70">
      Avaliação publicada no Google
      <span className="sr-only">
        {" "}por {t.name}, {t.date}
      </span>
    </figcaption>
  </figure>
);

/** Esqueleto com a altura aproximada do cartao real, para o mural nao pular. */
const CardSkeleton = () => (
  <div className="card-glass break-inside-avoid mb-5 rounded-2xl p-5 border border-border/50">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
    <Skeleton className="mt-4 h-3 w-20" />
    <div className="mt-3 space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
);

/*
  SEM PROPS, de proposito. O id "depoimentos" fica cravado porque o menu do
  Header e o rodape rolam ate ele, e os tres chamadores, pages/Index.tsx,
  procedimentos/ProcedurePageLayout.tsx e procedimentos/CapsulotomiaYagLaser.tsx,
  usam <TestimonialsSection /> pelado. Superficie configuravel que ninguem
  configura e so mais coisa para manter.
*/
const TestimonialsSection = () => {
  const [expanded, setExpanded] = useState(false);
  const { ref: sectionRef, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const aggregate = useGoogleReviews();

  /*
    A BUSCA SO COMECA QUANDO A SECAO APARECE. O mural fica bem abaixo da dobra
    nas 13 rotas onde ele existe, e o mesmo observador que anima a entrada serve
    de gatilho. Sem isso a requisicao, mais a cascata de avatares do Google,
    disputava banda com o carregamento inicial da pagina.
  */
  const { pool, isLoading } = useTestimonials(isVisible);

  /*
    A NOTA E O TOTAL VEM PRONTOS DO HOOK. useGoogleReviews ja resolve o agregado
    real do Google com queda para a constante, entao qualquer ternario aqui em
    cima seria uma segunda resposta para a mesma pergunta. Ja foi assim, com um
    ramo que nunca executava porque GOOGLE_REVIEWS.count e 111 e nunca zero.
  */
  const displayRating = aggregate.rating;
  const displayCount = aggregate.count;

  const title = displayRating >= 4.95 ? "Nota máxima no Google" : "Avaliação dos pacientes no Google";

  const visible = expanded ? pool : pool.slice(0, INITIAL_VISIBLE);
  const remaining = pool.length - visible.length;

  return (
    <section
      id="depoimentos"
      ref={sectionRef}
      aria-label="Avaliações de pacientes no Google"
      className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-secondary/20 via-background to-secondary/20 noise-overlay"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <div
          className={`text-center mb-10 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
            <MessageSquare className="w-3.5 h-3.5" />
            Avaliações no Google
          </span>

          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {title.replace(" no Google", "")} <span className="gradient-text">no Google</span>
          </h2>

          <p className="text-muted-foreground max-w-xl mx-auto">
            O que os pacientes escrevem sobre o atendimento, direto do perfil público.
          </p>
        </div>

        <div
          className={`mb-12 transition-all duration-700 delay-150 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <AggregatePanel rating={displayRating} count={displayCount} pool={pool} />
        </div>

        {isLoading && (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5" aria-hidden="true">
            {Array.from({ length: INITIAL_VISIBLE }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/*
          SEM ESTADO VAZIO NA TELA. Se a consulta falhar ou o banco vier limpo, o
          mural simplesmente nao aparece e ficam o painel agregado e os links.
          Dizer "as avaliacoes estao sendo carregadas" para quem ja viu a busca
          falhar e so um erro com roupa de espera.
        */}
        {!isLoading && pool.length > 0 && (
          <>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
              {visible.map((t, i) => (
                <ReviewCard
                  key={t.id}
                  t={t}
                  delayMs={Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}
                />
              ))}
            </div>

            {remaining > 0 && (
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus className="w-4 h-4" />
                  Ver mais {remaining} {remaining === 1 ? "avaliação" : "avaliações"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
