import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Award,
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
  Hospital,
  Heart,
  CalendarDays,
  ListChecks,
  CheckCircle2,
  Building2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import TestimonialsSection from "@/components/TestimonialsSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import logoImage from "@/assets/dr-juliano-logo.svg";
import drHero from "@/assets/dr-juliano-hero.webp";
import drHero2x from "@/assets/dr-juliano-hero@2x.webp";
import { DOCTOR, GOOGLE_REVIEWS } from "@/lib/constants";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { buildAgendamentoLink } from "@/lib/agendamentoLink";

const CANONICAL = "https://drjulianomachado.com/paragominas";

type Local = {
  number: string;
  name: string;
  cityLabel: string;
  address: string;
  mapsLink: string;
  icon: typeof Heart;
  utmContent: string;
};

const LOCAIS: readonly Local[] = [
  {
    number: "01",
    name: "Clinicor",
    cityLabel: "Paragominas · PA",
    address: "Rua Eixo W1, R. Célio Miranda, N° 729 — Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    icon: Heart,
    utmContent: "local_clinicor",
  },
  {
    number: "02",
    name: "Hospital Geral de Paragominas",
    cityLabel: "Paragominas · PA",
    address: "R. Santa Terezinha, 304 — Centro, Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
    icon: Hospital,
    utmContent: "local_hgp",
  },
] as const;

// Bento: primeiro card em destaque (col-span 2 no desktop), demais compactos.
const MOTIVOS = [
  {
    icon: Eye,
    title: "Avaliação de rotina",
    description:
      "Check-up oftalmológico para acompanhar a saúde dos olhos, mesmo sem sintomas.",
    featured: true,
  },
  {
    icon: Glasses,
    title: "Alteração do grau",
    description: "Visão embaçada de perto ou de longe.",
  },
  {
    icon: Sparkles,
    title: "Catarata",
    description: "Avaliação do cristalino e conduta.",
  },
  {
    icon: Activity,
    title: "Glaucoma",
    description: "Pressão intraocular e risco.",
  },
  {
    icon: CircleDot,
    title: "Pterígio",
    description: "Crescimento sobre a córnea.",
  },
  {
    icon: RefreshCw,
    title: "Retorno / acompanhamento",
    description: "Reavaliação e exames complementares.",
  },
] as const;

const STEPS = [
  {
    number: "01",
    icon: ListChecks,
    title: "Informe seus dados",
    description: "Nome e WhatsApp para contato.",
  },
  {
    number: "02",
    icon: CalendarDays,
    title: "Escolha o atendimento",
    description: "Tipo, local, data e horário disponíveis.",
  },
  {
    number: "03",
    icon: CheckCircle2,
    title: "Receba a confirmação",
    description: "A equipe confirma pelo WhatsApp.",
  },
] as const;

const FAQ = [
  {
    q: "O que acontece na consulta?",
    a: "A consulta inclui anamnese e avaliação oftalmológica conforme indicação médica. Exames complementares podem ser solicitados caso o Dr. Juliano entenda necessário.",
  },
  {
    q: "O que devo levar?",
    a: "Documento de identificação com foto, óculos ou lentes em uso, receitas antigas e resultados de exames oftalmológicos anteriores, se tiver.",
  },
  {
    q: "Posso dirigir depois?",
    a: "Se houver dilatação da pupila para exame de fundo, a visão pode ficar embaçada e sensível à luz por algumas horas. Nesses casos, é prudente não dirigir e levar acompanhante.",
  },
  {
    q: "Com quanto tempo de antecedência devo chegar?",
    a: "Chegue com cerca de 15 minutos de antecedência para o preenchimento da ficha e triagem visual.",
  },
] as const;

/** Hook: mostra a barra sticky mobile só quando o hero saiu da viewport e o footer ainda não entrou. */
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
  const { trackCTAClick, trackWhatsAppClick } = useGoogleTag();
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

  const heroRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const stickyVisible = useMobileStickyVisibility(heroRef, footerRef);

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
        <meta
          property="og:description"
          content="Consulta oftalmológica em Paragominas com Dr. Juliano Machado. Clinicor e HGP. Agende online."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Oftalmologista em Paragominas | Dr. Juliano Machado" />
        <meta
          name="twitter:description"
          content="Atendimento oftalmológico em Paragominas com Dr. Juliano Machado (CRM-PA 15253)."
        />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background overflow-x-hidden">
        {/* Header */}
        <header
          className="sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border/40"
          role="banner"
        >
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Ir para a página inicial"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/25 flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoImage} alt="" aria-hidden="true" className="w-8 h-8 object-contain" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold text-foreground truncate">{DOCTOR.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Oftalmologista · {DOCTOR.crm}
                </p>
              </div>
            </Link>

            <Link
              to={headerLink}
              onClick={() =>
                trackCTAClick("ver_horarios_header", "landing_paragominas_header", "Ver horários")
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 h-11 min-h-[44px] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="relative overflow-hidden pt-10 md:pt-16 pb-14 md:pb-24 noise-overlay"
            aria-labelledby="hero-heading"
            style={{
              background:
                "radial-gradient(1200px 500px at 80% -10%, hsl(var(--accent) / 0.10), transparent 60%), radial-gradient(700px 400px at 10% 20%, hsl(var(--primary) / 0.06), transparent 60%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 60%, hsl(var(--secondary) / 0.25) 100%)",
            }}
          >
            {/* Lente/íris abstrata sutil */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] opacity-40 hidden md:block motion-reduce:hidden"
              viewBox="0 0 400 400"
              fill="none"
            >
              <defs>
                <radialGradient id="iris" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.35" />
                  <stop offset="60%" stopColor="hsl(var(--accent))" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <circle cx="200" cy="200" r="180" fill="url(#iris)" />
              <circle cx="200" cy="200" r="130" stroke="hsl(var(--accent) / 0.15)" strokeWidth="1" />
              <circle cx="200" cy="200" r="90" stroke="hsl(var(--accent) / 0.10)" strokeWidth="1" />
            </svg>

            <div className="container mx-auto px-4 max-w-6xl relative">
              <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
                {/* Coluna esquerda: conteúdo */}
                <div className="order-1">
                  <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-[hsl(var(--accent))] text-[11px] font-semibold uppercase tracking-[0.14em] mb-6">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    Atendimento em Paragominas
                  </p>
                  <h1
                    id="hero-heading"
                    className="font-bold text-foreground leading-[1.05] mb-5 text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[3.4rem] tracking-tight"
                  >
                    <span className="block">Consulta oftalmológica</span>
                    <span className="block">
                      completa em{" "}
                      <span className="gradient-text-accent italic font-serif">Paragominas</span>
                    </span>
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
                    Atendimento com Dr. Juliano Machado na Clinicor e no Hospital Geral de
                    Paragominas. Escolha o local e o horário mais convenientes no agendamento.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
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
                        className="w-full sm:w-auto min-h-[52px] text-base group shadow-lg shadow-primary/10"
                      >
                        Ver horários disponíveis
                        <ArrowRight
                          className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-1"
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
                          "Prefere falar antes? Chamar no WhatsApp",
                          "whatsapp_landing_paragominas_hero",
                          "landing_paragominas_hero"
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 py-3 px-3 rounded-lg min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden="true" />
                      Chamar no WhatsApp
                    </a>
                  </div>

                  {/* Trust rail */}
                  <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                    <li className="inline-flex items-center gap-2">
                      <Award className="w-4 h-4 text-[hsl(var(--accent))]" aria-hidden="true" />
                      <span>+{DOCTOR.yearsExperience} anos de experiência</span>
                    </li>
                    <li className="inline-flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[hsl(var(--accent))]" aria-hidden="true" />
                      <span>Clinicor e HGP</span>
                    </li>
                    <li className="inline-flex items-center gap-2">
                      <Star className="w-4 h-4 fill-[hsl(var(--accent))] text-[hsl(var(--accent))]" aria-hidden="true" />
                      <span>
                        {ratingValue.toFixed(1)} no Google ({ratingCount})
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Coluna direita: foto editorial */}
                <div className="order-2 relative mx-auto w-full max-w-[440px] lg:max-w-none">
                  {/* Halo/lente abstrata atrás */}
                  <div
                    aria-hidden="true"
                    className="absolute -inset-6 rounded-[2rem] blur-3xl opacity-70 motion-reduce:opacity-40"
                    style={{
                      background:
                        "radial-gradient(60% 60% at 60% 40%, hsl(var(--accent) / 0.22), transparent 70%)",
                    }}
                  />
                  <div className="relative">
                    {/* Moldura teal fina + cantos assimétricos */}
                    <div
                      className="relative overflow-hidden bg-card ring-1 ring-[hsl(var(--accent)/0.35)] shadow-2xl shadow-primary/20"
                      style={{
                        borderTopLeftRadius: "1.75rem",
                        borderTopRightRadius: "0.5rem",
                        borderBottomLeftRadius: "0.5rem",
                        borderBottomRightRadius: "1.75rem",
                      }}
                    >
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
                        />
                      </picture>

                      {/* Overlay linear no rodapé para leitura dos selos */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
                        style={{
                          background:
                            "linear-gradient(180deg, transparent 0%, hsl(var(--background) / 0.65) 100%)",
                        }}
                      />

                      {/* Selo CRM */}
                      <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur-md border border-[hsl(var(--accent)/0.3)] px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-md">
                        <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--accent))]" aria-hidden="true" />
                        {DOCTOR.crm}
                      </div>

                      {/* Selo avaliação */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl bg-background/85 backdrop-blur-md border border-border/60 px-3.5 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex items-center gap-0.5">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <Star
                                key={i}
                                className="w-3.5 h-3.5 fill-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {ratingValue.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            · {ratingCount} avaliações no Google
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Feixe/lente pequeno decorativo */}
                    <svg
                      aria-hidden="true"
                      className="absolute -bottom-8 -right-6 w-28 h-28 opacity-70 motion-reduce:hidden"
                      viewBox="0 0 100 100"
                      fill="none"
                    >
                      <circle cx="50" cy="50" r="30" stroke="hsl(var(--accent) / 0.5)" strokeWidth="1" />
                      <circle cx="50" cy="50" r="18" stroke="hsl(var(--accent) / 0.3)" strokeWidth="1" />
                      <circle cx="50" cy="50" r="6" fill="hsl(var(--accent) / 0.6)" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= FAIXA DE CONFIANÇA ================= */}
          <section aria-label="Como funciona o atendimento" className="border-y border-border/40 bg-card/50">
            <div className="container mx-auto px-4 py-6">
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-2 text-sm">
                {[
                  { icon: MapPin, text: "Dois locais em Paragominas" },
                  { icon: CalendarDays, text: "Agendamento online" },
                  { icon: MessageCircle, text: "Confirmação pela equipe no WhatsApp" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 sm:justify-center">
                    <span className="inline-flex w-9 h-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="text-foreground font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ================= AGENDAR É SIMPLES — VARIANTE LANDING ================= */}
          <section
            id="passos"
            aria-labelledby="passos-heading"
            className="py-16 md:py-20 relative noise-overlay"
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center mb-10 md:mb-14">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold uppercase tracking-[0.14em] mb-4">
                  Sem complicação
                </span>
                <h2
                  id="passos-heading"
                  className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground"
                >
                  Agendar é <span className="gradient-text-accent italic font-serif">simples</span>
                </h2>
              </div>

              {/* Timeline conectada */}
              <div className="relative">
                {/* Linha desktop */}
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-8 left-[10%] right-[10%] h-px"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, hsl(var(--accent) / 0.5), transparent)",
                  }}
                />
                <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
                  {STEPS.map((s) => {
                    const Icon = s.icon;
                    return (
                      <li key={s.number} className="relative text-center md:px-4">
                        <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-[hsl(var(--accent)/0.4)] text-[hsl(var(--accent))] mb-4 shadow-md shadow-primary/10">
                          <Icon className="w-6 h-6" aria-hidden="true" />
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--background))] text-[10px] font-bold">
                            {s.number}
                          </span>
                        </div>
                        <h3 className="text-base md:text-lg font-semibold text-foreground mb-1.5">
                          {s.title}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          {s.description}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="text-center mt-10">
                <Link to={stepsLink}>
                  <Button
                    variant="obsidian"
                    size="lg"
                    onClick={() =>
                      trackCTAClick(
                        "comecar_agendamento",
                        "landing_paragominas_passos",
                        "Começar agendamento"
                      )
                    }
                    className="min-h-[48px] group"
                  >
                    Começar agendamento
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* ================= MOTIVOS — BENTO ================= */}
          <section
            id="motivos"
            className="py-16 md:py-20 bg-card relative noise-overlay"
            aria-labelledby="motivos-heading"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.35)] to-transparent" />
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-start mb-10">
                <div>
                  <h2 id="motivos-heading" className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3">
                    Motivos comuns para consultar
                  </h2>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-md">
                    Situações frequentes em que uma avaliação oftalmológica é indicada. A conduta é sempre individual e definida em consulta.
                  </p>
                </div>
              </div>

              <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {MOTIVOS.map((m, i) => {
                  const Icon = m.icon;
                  const featured = "featured" in m && m.featured;
                  return (
                    <li
                      key={m.title}
                      className={`group card-glass rounded-2xl border border-border/40 hover:border-[hsl(var(--accent)/0.4)] transition-all duration-300 p-4 md:p-5 focus-within:border-[hsl(var(--accent)/0.4)] ${
                        featured ? "col-span-2 md:col-span-2 md:row-span-1 md:p-6" : ""
                      }`}
                    >
                      {/* Ícone em círculo de lente */}
                      <div className="relative w-11 h-11 mb-3">
                        <div className="absolute inset-0 rounded-full bg-[hsl(var(--accent)/0.10)]" />
                        <div className="absolute inset-[3px] rounded-full border border-[hsl(var(--accent)/0.25)]" />
                        <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--accent))]">
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                      </div>
                      <h3 className={`font-semibold text-foreground mb-1 ${featured ? "text-lg md:text-xl" : "text-sm md:text-base"}`}>
                        {m.title}
                      </h3>
                      <p className={`text-muted-foreground leading-relaxed ${featured ? "text-sm md:text-base" : "text-xs md:text-sm"}`}>
                        {m.description}
                      </p>
                      {/* keep index used for stable ordering */}
                      <span className="sr-only">{i + 1}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* ================= LOCAIS ================= */}
          <section
            id="locais"
            className="py-16 md:py-20 relative noise-overlay"
            aria-labelledby="locais-heading"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--secondary) / 0.15) 100%)",
            }}
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="mb-10 max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[hsl(var(--accent))] mb-3">
                  Onde atendo
                </p>
                <h2 id="locais-heading" className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-3">
                  Dois locais em <span className="gradient-text-accent italic font-serif">Paragominas</span>
                </h2>
                <p className="text-muted-foreground text-sm md:text-base">
                  Escolha o local durante o agendamento.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {LOCAIS.map((l) => {
                  const Icon = l.icon;
                  const bookLink = buildAgendamentoLink({ utm_content: l.utmContent });
                  return (
                    <article
                      key={l.name}
                      className="card-glass rounded-2xl border border-border/40 overflow-hidden flex flex-col hover:border-[hsl(var(--accent)/0.4)] transition-colors"
                    >
                      {/* Faixa superior + rota abstrata */}
                      <div className="relative h-24 overflow-hidden border-b border-border/40" style={{
                        background:
                          "linear-gradient(135deg, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.18))",
                      }}>
                        <svg
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full opacity-70"
                          viewBox="0 0 300 96"
                          preserveAspectRatio="none"
                          fill="none"
                        >
                          <path
                            d="M-10 70 C 60 40, 120 90, 180 50 S 300 20, 320 40"
                            stroke="hsl(var(--accent) / 0.55)"
                            strokeWidth="1.5"
                            strokeDasharray="3 5"
                          />
                          <circle cx="60" cy="55" r="3" fill="hsl(var(--accent))" />
                          <circle cx="230" cy="42" r="3" fill="hsl(var(--accent))" />
                        </svg>
                        <span className="absolute top-3 left-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-background/90 bg-foreground/40 backdrop-blur px-2 py-0.5 rounded-full">
                          {l.number} · Paragominas
                        </span>
                        <span className="absolute bottom-3 right-4 inline-flex items-center gap-1 text-[11px] font-medium text-background/95">
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                          {l.name.length > 22 ? "Local" : l.name}
                        </span>
                      </div>

                      <div className="p-5 md:p-6 flex flex-col flex-1">
                        <h3 className="text-lg md:text-xl font-semibold text-foreground">{l.name}</h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5 mb-3">
                          {l.cityLabel}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-start gap-2 mb-5">
                          <MapPin className="w-4 h-4 text-[hsl(var(--accent))] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{l.address}</span>
                        </p>
                        <div className="mt-auto flex flex-col sm:flex-row items-stretch gap-2.5">
                          <Link to={bookLink} className="flex-1">
                            <Button
                              variant="obsidian"
                              size="sm"
                              onClick={() =>
                                trackCTAClick(
                                  "agendar_local",
                                  `landing_paragominas_${l.utmContent}`,
                                  `Agendar — ${l.name}`
                                )
                              }
                              className="w-full min-h-[44px]"
                            >
                              Agendar neste local
                              <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                            </Button>
                          </Link>
                          <a
                            href={l.mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-4 h-11 min-h-[44px] rounded-md text-sm font-medium border border-border/60 text-foreground hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--accent))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            aria-label={`Abrir ${l.name} no Google Maps`}
                          >
                            <Navigation className="w-4 h-4" aria-hidden="true" />
                            Maps
                            <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ================= AVALIAÇÕES ================= */}
          <section
            aria-label="Avaliações reais no Google"
            className="py-4 md:py-8 bg-card/40"
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div
                className="rounded-3xl border border-border/40 card-glass p-4 md:p-6"
                style={{
                  background:
                    "radial-gradient(600px 200px at 20% 0%, hsl(var(--accent) / 0.06), transparent 60%), hsl(var(--card))",
                }}
              >
                <div className="flex items-center justify-between gap-4 mb-2 px-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} className="w-4 h-4 fill-[hsl(var(--accent))] text-[hsl(var(--accent))]" aria-hidden="true" />
                      ))}
                    </div>
                    <div className="leading-tight">
                      <p className="text-lg md:text-xl font-bold text-foreground tabular-nums">
                        {ratingValue.toFixed(1)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">no Google</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ratingCount} avaliações reais de pacientes
                      </p>
                    </div>
                  </div>
                </div>
                <TestimonialsSection
                  variant="compact"
                  sectionId="avaliacoes-paragominas"
                  ariaLabel="Avaliações reais no Google"
                />
              </div>
            </div>
          </section>

          {/* ================= FAQ + CTA FINAL ================= */}
          <section
            id="faq"
            className="py-16 md:py-24 bg-card relative noise-overlay"
            aria-labelledby="faq-heading"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.35)] to-transparent" />
            <div className="container mx-auto px-4 max-w-6xl">
              <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start">
                {/* Coluna esquerda: título + CTA */}
                <div className="lg:sticky lg:top-24">
                  <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[hsl(var(--accent))] mb-3">
                    Perguntas frequentes
                  </p>
                  <h2
                    id="faq-heading"
                    className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground leading-tight mb-4"
                  >
                    Sua visão merece{" "}
                    <span className="gradient-text-accent italic font-serif">atenção cuidadosa</span>.
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-md">
                    Escolha o local e consulte os horários disponíveis em Paragominas.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link to={finalLink}>
                      <Button
                        variant="obsidian"
                        size="lg"
                        onClick={() =>
                          trackCTAClick(
                            "ver_horarios_final",
                            "landing_paragominas_final",
                            "Ver horários disponíveis"
                          )
                        }
                        className="min-h-[52px] w-full sm:w-auto group"
                      >
                        Ver horários disponíveis
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
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 py-3 px-3 rounded-lg min-h-[44px]"
                    >
                      <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden="true" />
                      Chamar no WhatsApp
                    </a>
                  </div>
                </div>

                {/* Coluna direita: accordion */}
                <Accordion type="single" collapsible className="w-full">
                  {FAQ.map((f, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-left text-base md:text-lg font-medium">
                        {f.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        {f.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
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
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground leading-none">
                Paragominas
              </p>
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                Consulta oftalmológica
              </p>
            </div>
            <Link
              to={stickyLink}
              tabIndex={stickyVisible ? 0 : -1}
              onClick={() =>
                trackCTAClick(
                  "ver_horarios_sticky",
                  "landing_paragominas_mobile_sticky",
                  "Ver horários"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 h-11 min-h-[44px] shadow-lg shadow-primary/20"
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
