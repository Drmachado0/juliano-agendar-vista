import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Star,
  MessageCircle,
  MapPin,
  Navigation,
  ExternalLink,
  Eye,
  Glasses,
  CircleDot,
  Sparkles,
  Activity,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import logoImage from "@/assets/dr-juliano-logo.svg";
import drHero from "@/assets/dr-juliano-hero.webp";
import drHero2x from "@/assets/dr-juliano-hero@2x.webp";
import drConsultorio from "@/assets/dr-juliano-consultorio.jpg";
import { DOCTOR, GOOGLE_REVIEWS } from "@/lib/constants";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { buildAgendamentoLink } from "@/lib/agendamentoLink";
import { buscarAvaliacoesGoogle } from "@/services/avaliacoesGoogle";
import { buildTestimonialPool } from "@/lib/testimonialsPool";
import RefractionClarityExperience from "@/components/paragominas/RefractionClarityExperience";

const CANONICAL = "https://drjulianomachado.com/paragominas";

type Local = {
  number: string;
  name: string;
  address: string;
  mapsLink: string;
  utmContent: string;
};

const LOCAIS: readonly Local[] = [
  {
    number: "01",
    name: "Clinicor",
    address: "Rua Eixo W1, R. Célio Miranda, 729 — Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    utmContent: "local_clinicor",
  },
  {
    number: "02",
    name: "Hospital Geral de Paragominas",
    address: "R. Santa Terezinha, 304 — Centro, Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
    utmContent: "local_hgp",
  },
] as const;

const MOTIVOS_LIST = [
  { icon: Glasses, title: "Mudança no grau ou visão embaçada", note: "Perto, longe ou ao dirigir." },
  { icon: Eye, title: "Avaliação de rotina", note: "Check-up periódico." },
  { icon: Sparkles, title: "Catarata", note: "Avaliação do cristalino." },
  { icon: Activity, title: "Glaucoma", note: "Pressão intraocular." },
  { icon: CircleDot, title: "Pterígio", note: "Crescimento sobre a córnea." },
  { icon: RefreshCw, title: "Retorno e acompanhamento", note: "Reavaliação clínica." },
] as const;

const FAQ = [
  {
    q: "O que acontece na consulta?",
    a: "A consulta inclui anamnese e avaliação oftalmológica conforme indicação. Exames complementares podem ser solicitados quando o Dr. Juliano entender necessário.",
  },
  {
    q: "O que devo levar?",
    a: "Documento com foto, óculos ou lentes em uso, receitas antigas e resultados de exames anteriores.",
  },
  {
    q: "Posso dirigir depois?",
    a: "Se houver dilatação da pupila, a visão pode ficar embaçada por algumas horas. Nesses casos, evite dirigir e leve acompanhante.",
  },
  {
    q: "Com quanto tempo devo chegar?",
    a: "Cerca de 15 minutos antes do horário, para triagem visual e preenchimento da ficha.",
  },
] as const;

const useMobileStickyVisibility = (
  heroRef: React.RefObject<HTMLElement>,
  footerRef: React.RefObject<HTMLDivElement>,
) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let heroOut = false;
    let footerIn = false;
    const compute = () => setVisible(heroOut && !footerIn);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === heroRef.current) heroOut = !e.isIntersecting;
        if (e.target === footerRef.current) footerIn = e.isIntersecting;
      }
      compute();
    }, { threshold: 0 });
    if (heroRef.current) io.observe(heroRef.current);
    if (footerRef.current) io.observe(footerRef.current);
    return () => io.disconnect();
  }, [heroRef, footerRef]);
  return visible;
};

const Paragominas = () => {
  const { trackCTAClick, trackWhatsAppClick, trackEvent } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const reviews = useGoogleReviews();

  const ratingValue = reviews.hasRealAggregate ? reviews.rating : GOOGLE_REVIEWS.rating;
  const ratingCount = reviews.hasRealAggregate ? reviews.count : GOOGLE_REVIEWS.count;

  const whatsappHelpUrl = waLink(
    "Olá! Tenho uma dúvida sobre a consulta em Paragominas antes de agendar. (origem: landing_paragominas)"
  );

  const heroLink = buildAgendamentoLink({ utm_content: "hero_paragominas" });
  const headerLink = buildAgendamentoLink({ utm_content: "header_paragominas" });
  const finalLink = buildAgendamentoLink({ utm_content: "final_paragominas" });
  const stepsLink = buildAgendamentoLink({ utm_content: "steps_paragominas" });
  const stickyLink = buildAgendamentoLink({ utm_content: "sticky_paragominas" });
  const motivosLink = buildAgendamentoLink({ utm_content: "motivos_paragominas" });

  const heroRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const stickyVisible = useMobileStickyVisibility(heroRef, footerRef);

  // Editorial testimonials — carrega pool real; auto-rotate simples.
  const { data: avaliacoes } = useQuery({
    queryKey: ["avaliacoes-google"],
    queryFn: buscarAvaliacoesGoogle,
    staleTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
  });
  const pool = useMemo(() => (avaliacoes ? buildTestimonialPool(avaliacoes) : []), [avaliacoes]);
  const [reviewIndex, setReviewIndex] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return;
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setReviewIndex((i) => (i + 1) % pool.length), 7000);
    return () => window.clearInterval(id);
  }, [pool.length]);
  const main = pool[reviewIndex];
  const preview = [pool[(reviewIndex + 1) % Math.max(1, pool.length)], pool[(reviewIndex + 2) % Math.max(1, pool.length)]];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: DOCTOR.name,
    medicalSpecialty: "Ophthalmology",
    url: CANONICAL,
    identifier: DOCTOR.crm,
    areaServed: [
      { "@type": "City", name: "Paragominas", addressRegion: "PA", addressCountry: "BR" },
    ],
    address: LOCAIS.map((l) => ({
      "@type": "PostalAddress",
      streetAddress: l.address,
      addressLocality: "Paragominas",
      addressRegion: "PA",
      addressCountry: "BR",
    })),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(ratingValue),
      bestRating: "5",
      ratingCount: String(ratingCount),
    },
  };

  return (
    <>
      <Helmet>
        <title>Oftalmologista em Paragominas | Dr. Juliano Machado</title>
        <meta
          name="description"
          content="Consulta oftalmológica em Paragominas com Dr. Juliano Machado (CRM-PA 15253). Atendimento na Clinicor e no Hospital Geral de Paragominas. Agende online."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Oftalmologista em Paragominas | Dr. Juliano Machado" />
        <meta property="og:description" content="Consulta oftalmológica em Paragominas com Dr. Juliano Machado. Clinicor e HGP. Agende online." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Oftalmologista em Paragominas | Dr. Juliano Machado" />
        <meta name="twitter:description" content="Atendimento oftalmológico em Paragominas com Dr. Juliano Machado (CRM-PA 15253)." />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background overflow-x-hidden">
        {/* Header minimalista */}
        <header className="sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border/30" role="banner">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2.5 min-w-0" aria-label="Ir para a página inicial">
              <img src={logoImage} alt="" aria-hidden="true" className="w-8 h-8 object-contain" />
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold text-foreground truncate">{DOCTOR.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">Oftalmologista · {DOCTOR.crm}</p>
              </div>
            </Link>
            <Link
              to={headerLink}
              onClick={() => trackCTAClick("ver_horarios_header", "landing_paragominas_header", "Ver horários")}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 h-11 min-h-[44px] hover:opacity-95"
            >
              Ver horários
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <main>
          {/* ================= HERO ================= */}
          <section
            ref={heroRef}
            className="relative overflow-hidden pt-10 md:pt-20 pb-16 md:pb-28"
            aria-labelledby="hero-heading"
            style={{
              background:
                "radial-gradient(1200px 600px at 85% -10%, hsl(var(--primary) / 0.12), transparent 60%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)",
            }}
          >
            {/* Grande arco de lente atrás */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -right-40 md:-right-32 w-[720px] h-[720px] opacity-60 motion-reduce:opacity-30"
              viewBox="0 0 600 600"
              fill="none"
            >
              <defs>
                <radialGradient id="lens" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                  <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <circle cx="300" cy="300" r="290" fill="url(#lens)" />
              <circle cx="300" cy="300" r="230" stroke="hsl(var(--primary) / 0.20)" strokeWidth="1" />
              <circle cx="300" cy="300" r="170" stroke="hsl(var(--primary) / 0.15)" strokeWidth="1" />
              <circle cx="300" cy="300" r="110" stroke="hsl(var(--primary) / 0.10)" strokeWidth="1" />
            </svg>

            {/* Microtipografia vertical */}
            <p
              aria-hidden="true"
              className="hidden md:block absolute left-6 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.5em] uppercase text-muted-foreground/50 rotate-180"
              style={{ writingMode: "vertical-rl" }}
            >
              PARAGOMINAS · PA
            </p>

            <div className="container mx-auto px-4 max-w-6xl relative">
              <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
                {/* Conteúdo — no mobile vem antes da foto (order-1) */}
                <div className="order-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-6">
                    Oftalmologista em Paragominas
                  </p>
                  <h1
                    id="hero-heading"
                    className="font-serif text-foreground leading-[1.02] tracking-tight mb-6 text-[2.4rem] sm:text-[3rem] md:text-[3.6rem] lg:text-[4.2rem]"
                    style={{ fontFamily: "Fraunces, Georgia, serif" }}
                  >
                    <span className="block">Sua visão,</span>
                    <span className="block italic text-[hsl(var(--primary))]">com mais clareza.</span>
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                    Consulta oftalmológica completa em Paragominas, com atendimento na Clinicor e no HGP.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10">
                    <Link to={heroLink} className="w-full sm:w-auto">
                      <Button
                        variant="obsidian"
                        size="lg"
                        onClick={() =>
                          trackCTAClick(
                            "ver_horarios_disponiveis",
                            "landing_paragominas_hero",
                            "Ver horários disponíveis"
                          )
                        }
                        className="w-full sm:w-auto min-h-[52px] text-base group"
                      >
                        Ver horários disponíveis
                        <ArrowRight
                          className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </Button>
                    </Link>
                    <a
                      href={whatsappHelpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackWhatsAppClick(
                          whatsappHelpUrl,
                          "Prefere falar antes? WhatsApp",
                          "whatsapp_landing_paragominas_hero",
                          "landing_paragominas_hero"
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors py-3 px-3 min-h-[44px]"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden="true" />
                      Chamar no WhatsApp
                    </a>
                  </div>

                  {/* CRM e rating integrados como linha editorial (sem badges soltos) */}
                  <div className="flex items-center gap-6 text-sm text-muted-foreground border-t border-border/40 pt-6 max-w-lg">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))]" aria-hidden="true" />
                      <span className="text-foreground font-medium">{DOCTOR.crm}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" aria-hidden="true" />
                      <span className="tabular-nums text-foreground font-medium">{ratingValue.toFixed(1)}</span>
                      <span>· {ratingCount} avaliações</span>
                    </span>
                    <span className="hidden sm:inline">+{DOCTOR.yearsExperience} anos</span>
                  </div>
                </div>

                {/* Foto — no mobile depois do conteúdo (order-2) */}
                <div className="order-2 relative mx-auto w-full max-w-[440px] lg:max-w-none">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-8 rounded-full blur-3xl opacity-60 motion-reduce:opacity-30"
                    style={{
                      background:
                        "radial-gradient(60% 60% at 50% 40%, hsl(var(--primary) / 0.28), transparent 70%)",
                    }}
                  />
                  <div className="relative">
                    <picture>
                      <source
                        type="image/webp"
                        srcSet={`${drHero} 900w, ${drHero2x} 1400w`}
                        sizes="(min-width: 1024px) 460px, (min-width: 640px) 440px, 90vw"
                      />
                      <img
                        src={drHero}
                        width={900}
                        height={1200}
                        alt="Dr. Juliano Machado, oftalmologista, durante atendimento clínico"
                        {...({ fetchpriority: "high" } as Record<string, string>)}
                        decoding="async"
                        className="block w-full h-auto object-cover"
                        style={{
                          clipPath:
                            "polygon(6% 0, 100% 0, 100% 94%, 94% 100%, 0 100%, 0 6%)",
                        }}
                      />
                    </picture>

                    <p className="mt-5 max-w-[320px] text-sm text-muted-foreground italic leading-snug">
                      &ldquo;Tecnologia para examinar. Tempo para explicar.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= FAIXA DE CONFIANÇA (minimal) ================= */}
          <section aria-label="Como funciona o atendimento" className="border-y border-border/30">
            <div className="container mx-auto px-4 py-5">
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2 text-sm">
                {[
                  { icon: MapPin, text: "Clinicor e HGP em Paragominas" },
                  { icon: CalendarDays, text: "Agendamento online" },
                  { icon: MessageCircle, text: "Confirmação pelo WhatsApp" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 sm:justify-center text-muted-foreground">
                    <Icon className="w-4 h-4 text-[hsl(var(--primary))]" aria-hidden="true" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ================= 2 · SEÇÃO ASSINATURA — CLAREZA ================= */}
          <RefractionClarityExperience
            onFirstInteract={() => trackEvent("clarity_demo_interaction", { section: "landing_paragominas" })}
          />

          {/* ================= 3 · MOTIVOS — LISTA EM LINHAS ================= */}
          <section
            id="motivos"
            className="relative py-20 md:py-28 overflow-hidden"
            aria-labelledby="motivos-heading"
          >
            {/* Fundo tipográfico */}
            <p
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-serif text-[16vw] leading-none tracking-tight text-foreground/[0.03] select-none whitespace-nowrap"
              style={{ fontFamily: "Fraunces, Georgia, serif" }}
            >
              VER · LER · DIRIGIR · TRABALHAR
            </p>

            <div className="container mx-auto px-4 max-w-6xl relative">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-4">
                    01 — Quando procurar
                  </p>
                  <h2
                    id="motivos-heading"
                    className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight text-foreground mb-6"
                    style={{ fontFamily: "Fraunces, Georgia, serif" }}
                  >
                    Quando a visão <br />
                    <span className="italic text-[hsl(var(--primary))]">pede atenção.</span>
                  </h2>
                  <p className="text-muted-foreground leading-relaxed max-w-md mb-8">
                    Situações frequentes em que uma avaliação oftalmológica é indicada. A conduta é sempre individual e definida em consulta.
                  </p>
                  <Link to={motivosLink}>
                    <Button
                      variant="obsidian"
                      size="lg"
                      onClick={() =>
                        trackCTAClick("avaliar_visao", "landing_paragominas_motivos", "Quero avaliar minha visão")
                      }
                      className="min-h-[48px] group"
                    >
                      Quero avaliar minha visão
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>

                <ul role="list" className="divide-y divide-border/40">
                  {MOTIVOS_LIST.map(({ icon: Icon, title, note }) => (
                    <li key={title} className="py-5 flex items-center gap-4">
                      <Icon className="w-5 h-5 text-[hsl(var(--primary))] shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base md:text-lg font-medium text-foreground">{title}</p>
                        <p className="text-sm text-muted-foreground">{note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ================= 4 · SEÇÃO HUMANA ================= */}
          <section
            aria-labelledby="humana-heading"
            className="py-20 md:py-28"
            style={{ background: "hsl(210 18% 10%)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <div className="grid lg:grid-cols-[45fr_55fr] gap-10 lg:gap-16 items-center">
                <img
                  src={drConsultorio}
                  alt="Dr. Juliano Machado em atendimento no consultório"
                  loading="lazy"
                  decoding="async"
                  width={900}
                  height={1100}
                  className="w-full h-auto object-cover rounded-sm shadow-2xl shadow-black/40"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-4">
                    Uma consulta feita para você entender
                  </p>
                  <h2
                    id="humana-heading"
                    className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight text-foreground mb-6"
                    style={{ fontFamily: "Fraunces, Georgia, serif" }}
                  >
                    Não é só ler <br />
                    <span className="italic">letras na parede.</span>
                  </h2>
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg mb-8">
                    Uma boa avaliação combina escuta, exame e explicação clara. Cada etapa é definida conforme a sua necessidade clínica.
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-[hsl(var(--primary))]/80 mb-6">
                    Escutar · Examinar · Explicar
                  </p>
                  <p className="text-sm text-muted-foreground border-t border-border/40 pt-4">
                    Dr. Juliano Machado · <span className="text-foreground font-medium">{DOCTOR.crm}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================= 5 · AGENDAMENTO — TRAJETÓRIA ÓPTICA ================= */}
          <section
            id="passos"
            aria-labelledby="passos-heading"
            className="relative py-20 md:py-28 overflow-hidden"
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center mb-14">
                <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-3">
                  Agendamento
                </p>
                <h2
                  id="passos-heading"
                  className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight text-foreground"
                  style={{ fontFamily: "Fraunces, Georgia, serif" }}
                >
                  Três passos, <span className="italic text-[hsl(var(--primary))]">como um raio de luz.</span>
                </h2>
              </div>

              {/* Desktop: trajetória horizontal atravessa lente central */}
              <div className="relative hidden md:block">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 800 140"
                  className="w-full h-40"
                  fill="none"
                >
                  <line x1="60" y1="70" x2="740" y2="70" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1" strokeDasharray="4 6" />
                  <circle cx="400" cy="70" r="34" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" fill="hsl(var(--background))" />
                  <circle cx="400" cy="70" r="20" stroke="hsl(var(--primary) / 0.35)" strokeWidth="1" />
                  <circle cx="400" cy="70" r="6" fill="hsl(var(--primary))" />
                  <text x="60" y="115" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Dados</text>
                  <text x="60" y="132" fill="hsl(var(--muted-foreground))" fontSize="11">Nome e WhatsApp</text>
                  <text x="360" y="130" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Atendimento</text>
                  <text x="340" y="147" fill="hsl(var(--muted-foreground))" fontSize="11">Local, data e horário</text>
                  <text x="660" y="115" fill="hsl(var(--foreground))" fontSize="14" fontWeight="600">Confirmação</text>
                  <text x="638" y="132" fill="hsl(var(--muted-foreground))" fontSize="11">Equipe confirma no WhatsApp</text>
                  <circle cx="60" cy="70" r="8" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <circle cx="740" cy="70" r="8" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Mobile: timeline vertical */}
              <ol className="md:hidden relative pl-8 space-y-8 border-l border-border/40 ml-3">
                {[
                  { t: "Dados", d: "Nome e WhatsApp para contato." },
                  { t: "Atendimento", d: "Local, data e horário disponíveis." },
                  { t: "Confirmação", d: "A equipe confirma pelo WhatsApp." },
                ].map((s, i) => (
                  <li key={s.t} className="relative">
                    <span className="absolute -left-[35px] top-1 w-5 h-5 rounded-full border border-[hsl(var(--primary))] bg-background flex items-center justify-center text-[10px] font-bold text-[hsl(var(--primary))]">
                      {i + 1}
                    </span>
                    <p className="font-semibold text-foreground">{s.t}</p>
                    <p className="text-sm text-muted-foreground">{s.d}</p>
                  </li>
                ))}
              </ol>

              <div className="text-center mt-10">
                <Link to={stepsLink}>
                  <Button
                    variant="obsidian"
                    size="lg"
                    onClick={() =>
                      trackCTAClick("comecar_agendamento", "landing_paragominas_passos", "Começar agendamento")
                    }
                    className="min-h-[52px] group"
                  >
                    Começar agendamento
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* ================= 6 · LOCAIS — ROTA ================= */}
          <section
            id="locais"
            className="py-20 md:py-28"
            aria-labelledby="locais-heading"
            style={{ background: "hsl(210 22% 7%)" }}
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="mb-12 max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-3">
                  Onde atendo
                </p>
                <h2
                  id="locais-heading"
                  className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight text-foreground mb-3"
                  style={{ fontFamily: "Fraunces, Georgia, serif" }}
                >
                  Dois locais em <span className="italic text-[hsl(var(--primary))]">Paragominas.</span>
                </h2>
                <p className="text-muted-foreground">
                  Escolha o local durante o agendamento.
                </p>
              </div>

              {/* Desktop: rota horizontal */}
              <div className="hidden md:grid grid-cols-[1fr_120px_1fr] gap-6 items-center">
                {LOCAIS.map((l, idx) => {
                  const bookLink = buildAgendamentoLink({ utm_content: l.utmContent });
                  return (
                    <Fragment key={l.name}>
                      {idx === 1 && (
                        <svg aria-hidden="true" viewBox="0 0 120 100" fill="none" className="w-full h-20">
                          <path d="M5 50 C 40 20, 80 80, 115 50" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.2" strokeDasharray="4 5" />
                          <circle cx="5" cy="50" r="4" fill="hsl(var(--primary))" />
                          <circle cx="115" cy="50" r="4" fill="hsl(var(--primary))" />
                        </svg>
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--primary))] mb-2">
                          {l.number} · Paragominas
                        </p>
                        <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-2 font-serif" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                          {l.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-start gap-2 mb-5">
                          <MapPin className="w-4 h-4 text-[hsl(var(--primary))] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{l.address}</span>
                        </p>
                        <div className="flex items-center gap-4">
                          <Link
                            to={bookLink}
                            onClick={() =>
                              trackCTAClick(
                                "agendar_local",
                                `landing_paragominas_${l.utmContent}`,
                                `Agendar — ${l.name}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--primary))] hover:opacity-80"
                          >
                            Agendar neste local
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </Link>
                          <a
                            href={l.mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                            aria-label={`Abrir ${l.name} no Google Maps`}
                          >
                            <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                            Ver no Maps
                            <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>

              {/* Mobile: rota vertical */}
              <ol className="md:hidden relative space-y-10 pl-8 border-l border-border/40 ml-3">
                {LOCAIS.map((l) => {
                  const bookLink = buildAgendamentoLink({ utm_content: l.utmContent });
                  return (
                    <li key={l.name} className="relative">
                      <span className="absolute -left-[35px] top-1 w-5 h-5 rounded-full border border-[hsl(var(--primary))] bg-background flex items-center justify-center text-[10px] font-bold text-[hsl(var(--primary))]">
                        {l.number}
                      </span>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--primary))] mb-1">Paragominas</p>
                      <h3 className="text-xl font-semibold text-foreground mb-2 font-serif" style={{ fontFamily: "Fraunces, Georgia, serif" }}>{l.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{l.address}</p>
                      <div className="flex flex-col gap-2">
                        <Link
                          to={bookLink}
                          onClick={() =>
                            trackCTAClick("agendar_local", `landing_paragominas_${l.utmContent}`, `Agendar — ${l.name}`)
                          }
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--primary))]"
                        >
                          Agendar neste local <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <a
                          href={l.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                        >
                          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                          Ver no Maps
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* ================= 7 · AVALIAÇÕES EDITORIAIS ================= */}
          <section
            aria-label="Avaliações reais no Google"
            className="py-16 md:py-24"
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <div className="flex items-baseline justify-between gap-4 mb-8 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-2">
                    Pacientes reais
                  </p>
                  <h2 className="font-serif text-2xl md:text-4xl leading-tight text-foreground" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                    O que dizem no Google.
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" aria-hidden="true" />
                    ))}
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{ratingValue.toFixed(1)}</span>
                  <span>· {ratingCount} avaliações</span>
                </div>
              </div>

              {main ? (
                <div className="grid lg:grid-cols-[1.6fr_1fr] gap-8 items-start" aria-live="polite">
                  <blockquote className="relative">
                    <span aria-hidden="true" className="font-serif text-[8rem] leading-none text-[hsl(var(--primary))]/20 absolute -top-8 -left-4 select-none">“</span>
                    <p className="font-serif text-xl md:text-2xl lg:text-[1.65rem] leading-[1.4] text-foreground pl-6 md:pl-10" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                      {main.text}
                    </p>
                    <footer className="mt-6 pl-6 md:pl-10 text-sm text-muted-foreground">
                      — <span className="text-foreground font-medium">{main.name}</span> · {main.date}
                    </footer>
                  </blockquote>
                  <div className="hidden lg:flex flex-col gap-4 border-l border-border/40 pl-6">
                    {preview.filter(Boolean).map((r) => (
                      <p key={r!.id} className="text-sm text-muted-foreground italic leading-relaxed line-clamp-4">
                        &ldquo;{r!.text.slice(0, 180)}{r!.text.length > 180 ? "…" : ""}&rdquo;
                        <span className="not-italic block mt-1 text-xs text-foreground/70">— {r!.name}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Avaliações carregando…</p>
              )}
            </div>
          </section>

          {/* ================= 8 · FAQ + FECHAMENTO ================= */}
          <section id="faq" className="py-20 md:py-28" aria-labelledby="faq-heading" style={{ background: "hsl(210 24% 6%)" }}>
            <div className="container mx-auto px-4 max-w-4xl">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--primary))] mb-3">
                Perguntas frequentes
              </p>
              <h2 id="faq-heading" className="sr-only">Perguntas frequentes</h2>
              <Accordion type="single" collapsible className="w-full mb-16">
                {FAQ.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-border/30">
                    <AccordionTrigger className="text-left text-base md:text-lg font-medium">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {/* CTA final editorial */}
              <div className="text-center border-t border-border/30 pt-16">
                <h3 className="font-serif text-3xl md:text-5xl leading-[1.05] tracking-tight text-foreground mb-4" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                  Veja melhor. <br />
                  <span className="italic text-[hsl(var(--primary))]">Viva com mais segurança.</span>
                </h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Escolha Clinicor ou HGP e consulte os horários disponíveis.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Link to={finalLink}>
                    <Button
                      variant="obsidian"
                      size="lg"
                      onClick={() =>
                        trackCTAClick("ver_horarios_final", "landing_paragominas_final", "Ver horários em Paragominas")
                      }
                      className="min-h-[52px] group"
                    >
                      Ver horários em Paragominas
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Button>
                  </Link>
                  <a
                    href={whatsappHelpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackWhatsAppClick(
                        whatsappHelpUrl,
                        "WhatsApp final Paragominas",
                        "whatsapp_landing_paragominas_final",
                        "landing_paragominas_final"
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors py-3 px-3 min-h-[44px]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden="true" />
                    Chamar no WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        <div ref={footerRef}>
          <Footer />
        </div>
        <WhatsAppButton />

        {/* Sticky mobile CTA */}
        <div
          aria-hidden={!stickyVisible}
          className={`fixed bottom-0 inset-x-0 z-30 lg:hidden transition-transform duration-300 ${
            stickyVisible ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-3 mb-3 rounded-2xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl shadow-black/40 p-2.5 pr-3 flex items-center gap-2">
            <div className="pl-1.5 min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground leading-none">Paragominas</p>
              <p className="text-sm font-semibold text-foreground leading-tight truncate">Consulta oftalmológica</p>
            </div>
            <Link
              to={stickyLink}
              tabIndex={stickyVisible ? 0 : -1}
              onClick={() =>
                trackCTAClick("ver_horarios_sticky", "landing_paragominas_mobile_sticky", "Ver horários")
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 h-11 min-h-[44px]"
            >
              Ver horários
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Paragominas;
