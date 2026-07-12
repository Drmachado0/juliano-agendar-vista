import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ShieldCheck,
  Star,
  MessageCircle,
  MapPin,
  Navigation,
  Menu,
  X,
  User,
  CalendarDays,
  CheckCircle2,
  Ear,
  Eye,
  MessageSquare,
  BadgeCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
const SERIF: React.CSSProperties = { fontFamily: "Fraunces, 'Playfair Display', Georgia, serif" };

type Local = {
  name: string;
  address: string;
  mapsLink: string;
  utmContent: string;
};

const LOCAIS: readonly Local[] = [
  {
    name: "Clinicor",
    address: "Rua Eixo W1, R. Célio Miranda, 729 — Paragominas/PA",
    mapsLink: "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    utmContent: "local_clinicor",
  },
  {
    name: "Hospital Geral de Paragominas",
    address: "R. Santa Terezinha, 304 — Centro, Paragominas/PA",
    mapsLink: "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
    utmContent: "local_hgp",
  },
] as const;

const MOTIVOS = [
  { title: "Mudança no grau", note: "Perto, longe ou ao dirigir." },
  { title: "Avaliação de rotina", note: "Check-up periódico." },
  { title: "Catarata", note: "Avaliação do cristalino." },
  { title: "Glaucoma", note: "Pressão intraocular." },
  { title: "Pterígio", note: "Crescimento sobre a córnea." },
  { title: "Retorno e acompanhamento", note: "Reavaliação clínica." },
] as const;

const PASSOS = [
  { icon: User, t: "Dados", d: "Nome e WhatsApp para contato." },
  { icon: CalendarDays, t: "Atendimento", d: "Local, data e horário disponíveis." },
  { icon: CheckCircle2, t: "Confirmação", d: "A equipe confirma pelo WhatsApp." },
] as const;

const METODO = [
  { icon: Ear, label: "Escutar" },
  { icon: Eye, label: "Examinar" },
  { icon: MessageSquare, label: "Explicar" },
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

/* --------------------------------- COMPONENT --------------------------------- */

const Paragominas = () => {
  const { trackCTAClick, trackWhatsAppClick, trackEvent } = useGoogleTag();
  const { waLink } = useSiteWhatsApp();
  const reviews = useGoogleReviews();

  const ratingValue = reviews.hasRealAggregate ? reviews.rating : GOOGLE_REVIEWS.rating;
  const ratingCount = reviews.hasRealAggregate ? reviews.count : GOOGLE_REVIEWS.count;

  const whatsappHelpUrl = waLink(
    "Olá! Tenho uma dúvida sobre a consulta em Paragominas antes de agendar. (origem: landing_paragominas)"
  );

  const heroLink    = buildAgendamentoLink({ utm_content: "hero_paragominas" });
  const headerLink  = buildAgendamentoLink({ utm_content: "header_paragominas" });
  const finalLink   = buildAgendamentoLink({ utm_content: "final_paragominas" });
  const stepsLink   = buildAgendamentoLink({ utm_content: "steps_paragominas" });
  const stickyLink  = buildAgendamentoLink({ utm_content: "sticky_paragominas" });
  const motivosLink = buildAgendamentoLink({ utm_content: "motivos_paragominas" });

  const heroRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const stickyVisible = useMobileStickyVisibility(heroRef, footerRef);

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
  const previews = [pool[(reviewIndex + 1) % Math.max(1, pool.length)], pool[(reviewIndex + 2) % Math.max(1, pool.length)]];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: DOCTOR.name,
    medicalSpecialty: "Ophthalmology",
    url: CANONICAL,
    identifier: DOCTOR.crm,
    areaServed: [{ "@type": "City", name: "Paragominas", addressRegion: "PA", addressCountry: "BR" }],
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
    memberOf: DOCTOR.memberships.map((name) => ({
      "@type": "MedicalOrganization",
      name,
    })),
  };

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Oftalmologista em Paragominas | Dr. Juliano Machado</title>
        <meta name="description" content="Consulta oftalmológica em Paragominas com Dr. Juliano Machado (CRM-PA 15253). Atendimento na Clinicor e no Hospital Geral de Paragominas. Agende online." />
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

      <div
        className="theme-paragominas-premium min-h-screen overflow-x-hidden"
        style={{ background: "var(--pgm-marfim)", color: "var(--pgm-grafite)" }}
      >
        {/* =============================== HEADER =============================== */}
        <header
          className="sticky top-0 z-40"
          style={{
            background: "rgba(243,240,232,0.92)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--pgm-line)",
          }}
          role="banner"
        >
          <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="Ir para a página inicial">
              <img src={logoImage} alt="" aria-hidden="true" className="w-9 h-9 object-contain" />
              <div className="min-w-0 leading-tight hidden sm:block">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--pgm-petroleo)" }}>
                  {DOCTOR.name}
                </p>
                <p className="pgm-eyebrow truncate" style={{ color: "var(--pgm-ink-soft)" }}>
                  Oftalmologia · {DOCTOR.crm}
                </p>
              </div>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden lg:flex items-center gap-8 text-sm" style={{ color: "var(--pgm-petroleo)" }}>
              <a href="#motivos" className="hover:opacity-70">Motivos</a>
              <a href="#locais" className="hover:opacity-70">Locais</a>
              <a href="#agendamento" className="hover:opacity-70">Agendamento</a>
              <a href="#faq" className="hover:opacity-70">Dúvidas</a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to={headerLink}
                onClick={() => trackCTAClick("ver_horarios_header", "landing_paragominas_header", "Ver horários")}
                className="pgm-btn pgm-btn--primary text-sm min-h-[44px] px-5"
                style={{ minHeight: 44 }}
              >
                Ver horários
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="lg:hidden inline-flex items-center justify-center w-10 h-10"
                style={{ color: "var(--pgm-petroleo)" }}
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="lg:hidden border-t" style={{ borderColor: "var(--pgm-line)" }}>
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-3 text-base" style={{ color: "var(--pgm-petroleo)" }}>
                <a onClick={() => setMenuOpen(false)} href="#motivos">Motivos</a>
                <a onClick={() => setMenuOpen(false)} href="#locais">Locais</a>
                <a onClick={() => setMenuOpen(false)} href="#agendamento">Agendamento</a>
                <a onClick={() => setMenuOpen(false)} href="#faq">Dúvidas</a>
              </nav>
            </div>
          )}
        </header>

        <main>
          {/* ================================ HERO ================================ */}
          <section
            ref={heroRef}
            aria-labelledby="hero-heading"
            className="relative overflow-hidden"
            style={{ background: "var(--pgm-marfim)" }}
          >
            {/* textura de papel — usada UMA vez */}
            <div className="pgm-grain" aria-hidden="true" />

            {/* Marcador vertical Paragominas · PA */}
            <p
              aria-hidden="true"
              className="hidden md:block absolute left-6 top-1/2 -translate-y-1/2 rotate-180 pgm-mono text-[10px] tracking-[0.6em] uppercase"
              style={{ writingMode: "vertical-rl", color: "var(--pgm-champagne)" }}
            >
              PARAGOMINAS · PA · 68625
            </p>

            <div className="container mx-auto px-4 max-w-7xl pt-12 md:pt-20 pb-16 md:pb-24 relative">
              {/* Cabeçalho de campanha */}
              <div className="mb-10 md:mb-14 flex items-center gap-5">
                <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                  Oftalmologista em Paragominas
                </span>
                <div className="pgm-rule flex-1 max-w-[280px]" />
              </div>

              <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-16 items-end">
                {/* Conteúdo */}
                <div>
                  <h1
                    id="hero-heading"
                    className="leading-[0.94] tracking-[-0.025em] mb-8"
                    style={{
                      ...SERIF,
                      color: "var(--pgm-petroleo)",
                      fontSize: "clamp(2.6rem, 8vw, 6.2rem)",
                    }}
                  >
                    <span className="block">Sua visão,</span>
                    <span className="block italic" style={{ color: "var(--pgm-grafite)" }}>
                      com mais clareza.
                    </span>
                  </h1>

                  <p
                    className="text-base md:text-lg leading-relaxed max-w-xl mb-10"
                    style={{ color: "var(--pgm-ink-soft)" }}
                  >
                    Consulta oftalmológica completa em Paragominas.
                    Atendimento humano, exame minucioso e explicação clara — na{" "}
                    <span style={{ color: "var(--pgm-petroleo)" }}>Clinicor</span> e no{" "}
                    <span style={{ color: "var(--pgm-petroleo)" }}>Hospital Geral de Paragominas</span>.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
                    <Link
                      to={heroLink}
                      onClick={() => trackCTAClick("ver_horarios_disponiveis", "landing_paragominas_hero", "Ver horários disponíveis")}
                      className="pgm-btn pgm-btn--primary w-full sm:w-auto"
                    >
                      Ver horários disponíveis
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
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
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium min-h-[44px] py-3 px-2"
                      style={{ color: "var(--pgm-petroleo)" }}
                    >
                      <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} aria-hidden="true" />
                      Chamar no WhatsApp
                    </a>
                  </div>

                  {/* Credenciais em linha editorial */}
                  <div className="pgm-rule mb-6 max-w-lg" />
                  <dl className="grid grid-cols-3 gap-6 max-w-lg text-sm">
                    <div>
                      <dt className="pgm-eyebrow mb-1.5" style={{ color: "var(--pgm-ink-soft)" }}>Registro</dt>
                      <dd className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--pgm-petroleo)" }}>
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        {DOCTOR.crm}
                      </dd>
                    </div>
                    <div>
                      <dt className="pgm-eyebrow mb-1.5" style={{ color: "var(--pgm-ink-soft)" }}>Google</dt>
                      <dd className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--pgm-petroleo)" }}>
                        <Star className="w-3.5 h-3.5 fill-current" style={{ color: "var(--pgm-champagne)" }} aria-hidden="true" />
                        <span className="tabular-nums">{ratingValue.toFixed(1)}</span>
                        <span className="font-normal" style={{ color: "var(--pgm-ink-soft)" }}>· {ratingCount}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="pgm-eyebrow mb-1.5" style={{ color: "var(--pgm-ink-soft)" }}>Experiência</dt>
                      <dd className="font-semibold" style={{ color: "var(--pgm-petroleo)" }}>
                        {DOCTOR.yearsExperienceLabel}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Foto */}
                <div className="relative">
                  <div className="relative">
                    <picture>
                      <source
                        type="image/webp"
                        srcSet={`${drHero} 900w, ${drHero2x} 1400w`}
                        sizes="(min-width: 1024px) 520px, (min-width: 640px) 440px, 90vw"
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
                          filter: "grayscale(0.05) contrast(1.02)",
                          borderTopLeftRadius: "999px 320px",
                          borderTopRightRadius: "999px 320px",
                        }}
                      />
                    </picture>

                    {/* Cantoneiras champagne */}
                    <span className="absolute -bottom-2 -right-2 w-14 h-px" style={{ background: "var(--pgm-champagne)" }} />
                    <span className="absolute -bottom-2 -right-2 w-px h-14" style={{ background: "var(--pgm-champagne)" }} />
                  </div>

                  {/* Caption */}
                  <div className="mt-6 pl-1">
                    <p className="pgm-serif italic text-base max-w-xs leading-snug" style={{ ...SERIF, color: "var(--pgm-grafite)" }}>
                      &ldquo;Tecnologia para examinar. Tempo para explicar.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* =========================== FAIXA DE CONFIANÇA =========================== */}
          <section
            aria-label="Como funciona"
            style={{
              background: "var(--pgm-marfim-2)",
              borderTop: "1px solid var(--pgm-line)",
              borderBottom: "1px solid var(--pgm-line)",
            }}
          >
            <div className="container mx-auto px-4 py-7 max-w-6xl">
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-2 text-sm">
                {[
                  { k: "Onde", v: "Clinicor e HGP · Paragominas" },
                  { k: "Como", v: "Agendamento 100% online" },
                  { k: "Contato", v: "Confirmação pelo WhatsApp" },
                ].map((it) => (
                  <li key={it.k} className="flex items-baseline gap-3 md:justify-center">
                    <span className="pgm-eyebrow whitespace-nowrap" style={{ color: "var(--pgm-champagne)" }}>
                      {it.k}
                    </span>
                    <span style={{ color: "var(--pgm-petroleo)" }}>{it.v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ====================== ASSOCIAÇÕES PROFISSIONAIS ====================== */}
          <section
            aria-labelledby="associacoes-heading"
            style={{
              background: "var(--pgm-marfim)",
              borderBottom: "1px solid var(--pgm-line)",
            }}
          >
            <div className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
              <div className="flex items-center gap-4 mb-6">
                <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                  Associações profissionais
                </span>
                <div className="pgm-rule flex-1 max-w-[200px]" />
              </div>
              <h2
                id="associacoes-heading"
                className="sr-only"
              >
                Associações profissionais
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {DOCTOR.memberships.map((org) => (
                  <li
                    key={org}
                    className="flex items-start gap-3 py-4 md:py-5 px-4 md:px-5"
                    style={{
                      background: "var(--pgm-marfim-2)",
                      border: "1px solid var(--pgm-line)",
                    }}
                  >
                    <BadgeCheck
                      className="w-5 h-5 mt-0.5 shrink-0"
                      style={{ color: "var(--pgm-champagne)" }}
                      aria-hidden="true"
                      strokeWidth={1.4}
                    />
                    <div className="min-w-0">
                      <p className="pgm-eyebrow mb-1" style={{ color: "var(--pgm-ink-soft)" }}>
                        Membro
                      </p>
                      <p
                        className="pgm-serif text-lg md:text-xl leading-snug"
                        style={{ ...SERIF, color: "var(--pgm-petroleo)" }}
                      >
                        {org}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>


          {/* ============================== II · REFRAÇÃO ============================== */}
          <RefractionClarityExperience
            onFirstInteract={() => trackEvent("clarity_demo_interaction", { section: "landing_paragominas" })}
          />

          {/* ============================== III · MOTIVOS ============================== */}
          <section
            id="motivos"
            aria-labelledby="motivos-heading"
            className="relative py-24 md:py-32"
            style={{ background: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <header className="mb-14 md:mb-20 max-w-3xl">
                <div className="flex items-center gap-4 mb-6">
                  <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                    Quando procurar
                  </span>
                  <div className="pgm-rule flex-1 max-w-[200px]" />
                </div>
                <h2
                  id="motivos-heading"
                  className="leading-[0.98] tracking-[-0.02em]"
                  style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "clamp(2.2rem, 6vw, 4.4rem)" }}
                >
                  Situações em que a visão
                  <br />
                  <span className="italic" style={{ color: "var(--pgm-grafite)" }}>pede atenção.</span>
                </h2>
              </header>

              <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-20 items-start">
                <div>
                  <p className="text-base md:text-lg leading-relaxed max-w-md mb-10" style={{ color: "var(--pgm-ink-soft)" }}>
                    A conduta é sempre individual e definida em consulta. Se algum destes sinais soa familiar, uma avaliação faz sentido.
                  </p>
                  <Link
                    to={motivosLink}
                    onClick={() => trackCTAClick("avaliar_visao", "landing_paragominas_motivos", "Quero avaliar minha visão")}
                    className="pgm-btn pgm-btn--primary"
                  >
                    Quero avaliar minha visão
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>

                <ul role="list" className="border-t" style={{ borderColor: "var(--pgm-line)" }}>
                  {MOTIVOS.map((m) => (
                    <li
                      key={m.title}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] items-baseline gap-2 md:gap-8 py-5 md:py-6 border-b"
                      style={{ borderColor: "var(--pgm-line)" }}
                    >
                      <p
                        className="pgm-serif text-xl md:text-2xl leading-snug"
                        style={{ ...SERIF, color: "var(--pgm-petroleo)" }}
                      >
                        {m.title}
                      </p>
                      <p className="text-sm md:text-base leading-relaxed" style={{ color: "var(--pgm-ink-soft)" }}>
                        {m.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============================ IV · SEÇÃO HUMANA ============================ */}
          <section
            aria-labelledby="humana-heading"
            className="relative py-24 md:py-32"
            style={{ background: "var(--pgm-grafite)", color: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
                {/* Foto do consultório */}
                <div className="relative order-2 lg:order-1">
                  <img
                    src={drConsultorio}
                    alt="Dr. Juliano Machado durante consulta no consultório oftalmológico"
                    loading="lazy"
                    decoding="async"
                    width={900}
                    height={1100}
                    className="block w-full h-auto object-cover"
                    style={{ filter: "contrast(1.05)" }}
                  />
                  {/* Filetes champagne */}
                  <span className="absolute -top-2 -left-2 w-14 h-px" style={{ background: "var(--pgm-champagne)" }} />
                  <span className="absolute -top-2 -left-2 w-px h-14" style={{ background: "var(--pgm-champagne)" }} />
                </div>

                <div className="order-1 lg:order-2">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                      Método
                    </span>
                    <div className="pgm-rule-dark flex-1 max-w-[160px]" />
                  </div>
                  <h2
                    id="humana-heading"
                    className="leading-[0.98] tracking-[-0.02em] mb-8"
                    style={{ ...SERIF, fontSize: "clamp(2.2rem, 6vw, 4.2rem)" }}
                  >
                    Não é só ler
                    <br />
                    <span className="italic" style={{ color: "var(--pgm-champagne)" }}>
                      letras na parede.
                    </span>
                  </h2>
                  <p className="text-base md:text-lg leading-relaxed max-w-lg mb-10" style={{ color: "rgba(243,240,232,0.78)" }}>
                    Uma boa consulta combina escuta, exame e explicação clara. Cada etapa é definida
                    conforme a sua necessidade clínica — sem pressa, sem excesso, sem termos vagos.
                  </p>

                  {/* Três verbos com ícones — sem numeração */}
                  <ul className="flex items-center gap-5 md:gap-8 max-w-lg mb-10 flex-wrap">
                    {METODO.map((m, i) => {
                      const Icon = m.icon;
                      return (
                        <li key={m.label} className="flex items-center gap-3">
                          <Icon
                            className="w-5 h-5"
                            style={{ color: "var(--pgm-champagne)" }}
                            aria-hidden="true"
                            strokeWidth={1.4}
                          />
                          <span className="pgm-serif text-lg md:text-xl" style={{ ...SERIF }}>
                            {m.label}
                          </span>
                          {i < METODO.length - 1 && (
                            <span
                              className="hidden md:inline-block w-6 h-px ml-3"
                              style={{ background: "var(--pgm-line-dark)" }}
                              aria-hidden="true"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <p className="text-sm" style={{ color: "rgba(243,240,232,0.65)" }}>
                    <span className="font-semibold" style={{ color: "var(--pgm-marfim)" }}>{DOCTOR.name}</span>
                    {" · "}
                    <span>{DOCTOR.crm}</span>
                    {" · "}
                    <span>Oftalmologia</span>
                  </p>
                  <p className="text-sm mt-2" style={{ color: "rgba(243,240,232,0.6)" }}>
                    Membro da Sociedade Brasileira de Oftalmologia e da Sociedade Brasileira de Glaucoma.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ============================== V · LOCAIS ============================== */}
          <section
            id="locais"
            aria-labelledby="locais-heading"
            className="pt-24 md:pt-32 pb-16 md:pb-20"
            style={{ background: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <header className="mb-10 md:mb-14 max-w-3xl">
                <div className="flex items-center gap-4 mb-6">
                  <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                    Onde atendo
                  </span>
                  <div className="pgm-rule flex-1 max-w-[200px]" />
                </div>
                <h2
                  id="locais-heading"
                  className="leading-[0.98] tracking-[-0.02em]"
                  style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "clamp(2.2rem, 6vw, 4.4rem)" }}
                >
                  Dois endereços,
                  <br />
                  <span className="italic" style={{ color: "var(--pgm-grafite)" }}>
                    uma mesma consulta.
                  </span>
                </h2>
              </header>

              <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-stretch">
                {LOCAIS.map((l) => {
                  const bookLink = buildAgendamentoLink({ utm_content: l.utmContent });
                  return (
                    <article
                      key={l.name}
                      className="relative flex flex-col pt-8 border-t"
                      style={{ borderColor: "var(--pgm-line)" }}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <MapPin
                          className="w-4 h-4"
                          style={{ color: "var(--pgm-champagne)" }}
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                        <p className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                          Paragominas · PA
                        </p>
                      </div>
                      <h3
                        className="mb-4 leading-[1.05] min-h-[3.2em] md:min-h-[2.6em]"
                        style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}
                      >
                        {l.name}
                      </h3>
                      <p className="text-base leading-relaxed mb-8 flex items-start gap-3 max-w-md flex-1" style={{ color: "var(--pgm-ink-soft)" }}>
                        <Navigation className="w-4 h-4 shrink-0 mt-1" style={{ color: "var(--pgm-petroleo)" }} aria-hidden="true" />
                        <span>{l.address}</span>
                      </p>

                      <div className="flex items-center gap-6 flex-wrap">
                        <Link
                          to={bookLink}
                          onClick={() =>
                            trackCTAClick("agendar_local", `landing_paragominas_${l.utmContent}`, `Agendar — ${l.name}`)
                          }
                          className="pgm-btn pgm-btn--primary"
                        >
                          Agendar neste local
                          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <a
                          href={l.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pgm-btn--link-dark inline-flex items-center gap-1.5 text-sm"
                          aria-label={`Abrir ${l.name} no Google Maps`}
                        >
                          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                          Ver rota
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* =========================== VI · AGENDAMENTO =========================== */}
          <section
            id="agendamento"
            aria-labelledby="passos-heading"
            className="relative overflow-hidden py-24 md:py-32"
            style={{ background: "var(--pgm-petroleo)", color: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl relative">
              <header className="mb-16 md:mb-20 max-w-3xl">
                <div className="flex items-center gap-4 mb-6">
                  <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                    Agendamento
                  </span>
                  <div className="pgm-rule-dark flex-1 max-w-[200px]" />
                </div>
                <h2
                  id="passos-heading"
                  className="leading-[0.98] tracking-[-0.02em]"
                  style={{ ...SERIF, fontSize: "clamp(2.2rem, 6vw, 4.4rem)" }}
                >
                  Três passos claros,
                  <br />
                  <span className="italic" style={{ color: "var(--pgm-ciano)" }}>
                    como um raio de luz.
                  </span>
                </h2>
              </header>

              {/* Passos — ícones + timeline, sem numeração visual */}
              <ol className="grid md:grid-cols-3 gap-10 md:gap-0 relative">
                {/* Linha conectora desktop */}
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-6 left-[8%] right-[8%] h-px"
                  style={{ background: "var(--pgm-line-dark)" }}
                />
                {PASSOS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.t}
                      className="relative md:px-8 first:md:pl-0 last:md:pr-0"
                      style={{ borderLeft: "1px solid var(--pgm-line-dark)" }}
                    >
                      {/* ponto ciano no eixo da timeline */}
                      <span
                        className="absolute -left-[7px] top-4 w-3 h-3 rounded-full"
                        style={{
                          background: "var(--pgm-ciano)",
                          boxShadow: "0 0 0 4px var(--pgm-petroleo)",
                        }}
                        aria-hidden="true"
                      />
                      <div className="pl-6 md:pl-8">
                        <Icon
                          className="w-6 h-6 mb-5"
                          style={{ color: "var(--pgm-champagne)" }}
                          strokeWidth={1.4}
                          aria-hidden="true"
                        />
                        <h3
                          className="mb-3"
                          style={{ ...SERIF, fontSize: "1.6rem", lineHeight: 1.1 }}
                        >
                          {s.t}
                        </h3>
                        <p className="text-sm md:text-base leading-relaxed" style={{ color: "rgba(243,240,232,0.72)" }}>
                          {s.d}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-16 md:mt-20 flex items-center gap-6 flex-wrap">
                <Link
                  to={stepsLink}
                  onClick={() => trackCTAClick("comecar_agendamento", "landing_paragominas_passos", "Começar agendamento")}
                  className="pgm-btn pgm-btn--ivory"
                >
                  Começar agendamento
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <a
                  href={whatsappHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackWhatsAppClick(whatsappHelpUrl, "WhatsApp agendamento", "whatsapp_landing_paragominas_steps", "landing_paragominas_steps")
                  }
                  className="pgm-btn pgm-btn--ghost text-sm min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Tirar dúvidas antes
                </a>
              </div>
            </div>
          </section>

          {/* =========================== VII · AVALIAÇÕES =========================== */}
          <section
            aria-label="Avaliações reais no Google"
            className="py-24 md:py-32"
            style={{ background: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-6xl">
              <header className="flex items-end justify-between gap-6 flex-wrap mb-14">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                      Palavra dos pacientes
                    </span>
                    <div className="pgm-rule flex-1 max-w-[200px]" />
                  </div>
                  <h2
                    className="leading-[0.98] tracking-[-0.02em]"
                    style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "clamp(2.2rem, 6vw, 4rem)" }}
                  >
                    O que dizem
                    <br />
                    <span className="italic" style={{ color: "var(--pgm-grafite)" }}>no Google.</span>
                  </h2>
                </div>
                <div className="inline-flex items-baseline gap-3 text-sm">
                  <span className="pgm-serif" style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "3rem", lineHeight: 1 }}>
                    {ratingValue.toFixed(1)}
                  </span>
                  <span className="flex items-baseline gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-current" style={{ color: "var(--pgm-champagne)" }} aria-hidden="true" />
                    ))}
                  </span>
                  <span style={{ color: "var(--pgm-ink-soft)" }}>· {ratingCount} avaliações</span>
                </div>
              </header>

              {main ? (
                <div className="grid lg:grid-cols-[1.7fr_1fr] gap-10 lg:gap-16 items-start" aria-live="polite">
                  <blockquote className="relative pt-6" style={{ borderTop: "1px solid var(--pgm-line)" }}>
                    <span
                      aria-hidden="true"
                      className="pgm-serif absolute -top-10 -left-3 select-none pointer-events-none italic"
                      style={{ ...SERIF, fontSize: "7rem", lineHeight: 1, color: "var(--pgm-champagne)", opacity: 0.5 }}
                    >
                      “
                    </span>
                    <p
                      className="leading-[1.3] max-w-3xl"
                      style={{ ...SERIF, color: "var(--pgm-grafite)", fontSize: "clamp(1.35rem, 3vw, 2rem)" }}
                    >
                      {main.text}
                    </p>
                    <footer className="mt-8 pt-4 flex items-center justify-between gap-4 text-sm" style={{ borderTop: "1px solid var(--pgm-line)", color: "var(--pgm-ink-soft)" }}>
                      <span>
                        <span className="font-semibold" style={{ color: "var(--pgm-petroleo)" }}>{main.name}</span>
                        {main.date && <> · {main.date}</>}
                      </span>
                      <span className="pgm-mono text-[10px] tracking-[0.3em] uppercase" style={{ color: "var(--pgm-champagne)" }}>
                        Google Reviews
                      </span>
                    </footer>
                  </blockquote>

                  <div className="hidden lg:flex flex-col gap-6 pl-8" style={{ borderLeft: "1px solid var(--pgm-line)" }}>
                    {previews.filter(Boolean).map((r) => (
                      <p key={r!.id} className="text-sm leading-relaxed italic" style={{ ...SERIF, color: "var(--pgm-ink-soft)" }}>
                        &ldquo;{r!.text.slice(0, 160)}{r!.text.length > 160 ? "…" : ""}&rdquo;
                        <span className="not-italic block mt-2 text-xs" style={{ color: "var(--pgm-petroleo)" }}>
                          — {r!.name}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--pgm-ink-soft)" }}>Avaliações carregando…</p>
              )}
            </div>
          </section>

          {/* ================================ VIII · FAQ ================================ */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="py-24 md:py-32"
            style={{ background: "var(--pgm-marfim-2)" }}
          >
            <div className="container mx-auto px-4 max-w-4xl">
              <div className="flex items-center gap-4 mb-10">
                <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
                  Perguntas frequentes
                </span>
                <div className="pgm-rule flex-1" />
              </div>
              <h2 id="faq-heading" className="sr-only">Perguntas frequentes</h2>

              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={{ borderColor: "var(--pgm-line)" }}>
                    <AccordionTrigger
                      className="text-left py-6 hover:no-underline"
                      style={{ ...SERIF, color: "var(--pgm-petroleo)", fontSize: "1.15rem" }}
                    >
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-base leading-relaxed pb-6" style={{ color: "var(--pgm-ink-soft)" }}>
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* ============================= IX · CTA FINAL ============================= */}
          <section
            aria-label="Agendar consulta"
            className="relative overflow-hidden py-28 md:py-40"
            style={{ background: "var(--pgm-petroleo)", color: "var(--pgm-marfim)" }}
          >
            <div className="container mx-auto px-4 max-w-5xl text-center relative">
              <p className="pgm-eyebrow mb-8" style={{ color: "var(--pgm-champagne)" }}>
                Encerramento
              </p>
              <h3
                className="leading-[0.95] tracking-[-0.025em] mb-10"
                style={{ ...SERIF, fontSize: "clamp(2.6rem, 8vw, 6rem)" }}
              >
                Veja melhor.
                <br />
                <span className="italic" style={{ color: "var(--pgm-ciano)" }}>Viva com mais segurança.</span>
              </h3>
              <div className="pgm-rule-dark mx-auto max-w-[240px] mb-10" />
              <p className="text-base md:text-lg mb-12 max-w-md mx-auto" style={{ color: "rgba(243,240,232,0.72)" }}>
                Escolha Clinicor ou HGP e consulte os horários disponíveis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to={finalLink}
                  onClick={() => trackCTAClick("ver_horarios_final", "landing_paragominas_final", "Ver horários em Paragominas")}
                  className="pgm-btn pgm-btn--ivory"
                >
                  Ver horários em Paragominas
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <a
                  href={whatsappHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackWhatsAppClick(whatsappHelpUrl, "WhatsApp final Paragominas", "whatsapp_landing_paragominas_final", "landing_paragominas_final")
                  }
                  className="pgm-btn pgm-btn--ghost text-sm min-h-[44px]"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  Chamar no WhatsApp
                </a>
              </div>
            </div>
          </section>
        </main>

        <div ref={footerRef}>
          <Footer />
        </div>
        <WhatsAppButton />

        {/* ============================== STICKY MOBILE ============================== */}
        <div
          aria-hidden={!stickyVisible}
          className={`fixed bottom-0 inset-x-0 z-30 lg:hidden transition-transform duration-300 ${
            stickyVisible ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div
            className="mx-3 mb-3 flex items-center gap-3 pl-4 pr-2 py-2"
            style={{
              background: "var(--pgm-petroleo)",
              border: "1px solid var(--pgm-line-dark)",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="pgm-eyebrow leading-none" style={{ color: "var(--pgm-champagne)" }}>
                Paragominas
              </p>
              <p
                className="text-sm leading-tight truncate mt-1"
                style={{ ...SERIF, color: "var(--pgm-marfim)" }}
              >
                Consulta oftalmológica
              </p>
            </div>
            <Link
              to={stickyLink}
              tabIndex={stickyVisible ? 0 : -1}
              onClick={() => trackCTAClick("ver_horarios_sticky", "landing_paragominas_mobile_sticky", "Ver horários")}
              className="pgm-btn pgm-btn--ivory text-sm min-h-[44px] px-4"
            >
              Ver horários
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Paragominas;
