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
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import AgendarSimplesSection from "@/components/AgendarSimplesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import WhatsAppButton from "@/components/WhatsAppButton";
import logoImage from "@/assets/dr-juliano-logo.svg";
import { DOCTOR, GOOGLE_REVIEWS } from "@/lib/constants";
import { useGoogleTag } from "@/hooks/useGoogleTag";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { useGoogleReviews } from "@/hooks/useGoogleReviews";
import { buildAgendamentoLink } from "@/lib/agendamentoLink";

const CANONICAL = "https://drjulianomachado.com/paragominas";

const LOCAIS = [
  {
    name: "Clinicor",
    address: "Rua Eixo W1, R. Célio Miranda, N° 729 — Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Clinicor+Rua+Celio+Miranda+729+Paragominas+PA",
    icon: Heart,
    utmContent: "local_clinicor",
  },
  {
    name: "Hospital Geral de Paragominas",
    address: "R. Santa Terezinha, 304 — Centro, Paragominas/PA",
    mapsLink:
      "https://maps.google.com/?q=Hospital+Geral+Paragominas+Santa+Terezinha+304",
    icon: Hospital,
    utmContent: "local_hgp",
  },
] as const;

const MOTIVOS = [
  {
    icon: Eye,
    title: "Avaliação de rotina",
    description:
      "Check-up oftalmológico para acompanhar a saúde dos olhos, mesmo sem sintomas.",
  },
  {
    icon: Glasses,
    title: "Alteração do grau ou visão embaçada",
    description:
      "Investigação e conduta para dificuldade de enxergar de perto ou de longe.",
  },
  {
    icon: Sparkles,
    title: "Catarata",
    description:
      "Avaliação do cristalino e orientação sobre acompanhamento e conduta cirúrgica.",
  },
  {
    icon: Activity,
    title: "Glaucoma",
    description:
      "Medida da pressão intraocular e avaliação de risco conforme indicação médica.",
  },
  {
    icon: CircleDot,
    title: "Pterígio",
    description:
      "Avaliação do crescimento sobre a córnea e discussão de conduta adequada.",
  },
  {
    icon: RefreshCw,
    title: "Retorno e acompanhamento",
    description:
      "Reavaliação de conduta prévia, exames complementares e acompanhamento clínico.",
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: DOCTOR.name,
    medicalSpecialty: "Ophthalmology",
    url: CANONICAL,
    telephone: undefined,
    identifier: DOCTOR.crm,
    areaServed: {
      "@type": "City",
      name: "Paragominas",
      addressRegion: "PA",
      addressCountry: "BR",
    },
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
          content="Consulta oftalmológica em Paragominas com Dr. Juliano Machado (CRM-PA 15253). Atendimento na Clinicor e no Hospital Geral de Paragominas."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Oftalmologista em Paragominas | Dr. Juliano Machado" />
        <meta
          property="og:description"
          content="Consulta oftalmológica em Paragominas: Clinicor e Hospital Geral de Paragominas. Agende online."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Oftalmologista em Paragominas | Dr. Juliano Machado" />
        <meta
          name="twitter:description"
          content="Atendimento oftalmológico em Paragominas com o Dr. Juliano Machado (CRM-PA 15253)."
        />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background">
        {/* Header compacto (sem menu institucional, sem "Entrar") */}
        <header
          className="sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-border/50"
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
          {/* HERO */}
          <section
            className="relative py-14 md:py-20 bg-gradient-to-b from-background via-background to-secondary/20 noise-overlay"
            aria-labelledby="hero-heading"
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-5">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                Atendimento oftalmológico em Paragominas
              </p>
              <h1
                id="hero-heading"
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4"
              >
                Consulta oftalmológica completa em{" "}
                <span className="gradient-text">Paragominas</span>
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl">
                Atendimento com o Dr. Juliano Machado na Clinicor e no Hospital Geral de
                Paragominas.
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
                    className="w-full sm:w-auto min-h-[48px] text-base group"
                  >
                    Ver horários disponíveis
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
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
                  Prefere falar antes? Chamar no WhatsApp
                </a>
              </div>

              {/* Prova compacta */}
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <li className="inline-flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>+{DOCTOR.yearsExperience} anos de experiência</span>
                </li>
                <li className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>{DOCTOR.crm}</span>
                </li>
                <li className="inline-flex items-center gap-2">
                  <Star className="w-4 h-4 fill-primary text-primary" aria-hidden="true" />
                  <span>
                    {ratingValue.toFixed(1)} no Google ({ratingCount} avaliações)
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* AGENDAR É SIMPLES (reuso do componente existente) */}
          <AgendarSimplesSection />

          {/* MOTIVOS DE CONSULTA */}
          <section
            id="motivos"
            className="py-16 md:py-20 bg-card relative noise-overlay"
            aria-labelledby="motivos-heading"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="container mx-auto px-4">
              <div className="text-center mb-10 max-w-2xl mx-auto">
                <h2 id="motivos-heading" className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Motivos comuns para uma consulta
                </h2>
                <p className="text-muted-foreground text-sm md:text-base">
                  Alguns exemplos de situações em que uma avaliação oftalmológica é indicada.
                </p>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MOTIVOS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <li
                      key={m.title}
                      className="card-glass rounded-2xl p-5 border border-border/40 hover:border-primary/25 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1.5">{m.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* LOCAIS EM PARAGOMINAS */}
          <section
            id="locais"
            className="py-16 md:py-20 bg-gradient-to-b from-background via-secondary/10 to-background relative noise-overlay"
            aria-labelledby="locais-heading"
          >
            <div className="container mx-auto px-4 max-w-5xl">
              <div className="text-center mb-10">
                <h2 id="locais-heading" className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Onde atendo em <span className="gradient-text">Paragominas</span>
                </h2>
                <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
                  Escolha o local mais conveniente para a sua consulta.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {LOCAIS.map((l) => {
                  const Icon = l.icon;
                  const bookLink = buildAgendamentoLink({ utm_content: l.utmContent });
                  return (
                    <article
                      key={l.name}
                      className="card-glass rounded-2xl p-6 border border-border/40 flex flex-col"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{l.name}</h3>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">
                            Paragominas · PA
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground flex items-start gap-2 mb-5">
                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{l.address}</span>
                      </p>

                      <div className="mt-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                          className="inline-flex items-center justify-center gap-2 px-4 h-11 min-h-[44px] rounded-md text-sm font-medium border border-border/60 text-foreground hover:border-primary/40 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          aria-label={`Abrir ${l.name} no Google Maps`}
                        >
                          <Navigation className="w-4 h-4" aria-hidden="true" />
                          Abrir no Maps
                          <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* AVALIAÇÕES — variante compacta reutilizando o carrossel real */}
          <TestimonialsSection
            variant="compact"
            sectionId="avaliacoes-paragominas"
            ariaLabel="Avaliações reais no Google"
          />

          {/* FAQ CURTO */}
          <section
            id="faq"
            className="py-14 md:py-16 bg-card relative noise-overlay"
            aria-labelledby="faq-heading"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="container mx-auto px-4 max-w-3xl">
              <div className="text-center mb-8">
                <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Perguntas frequentes
                </h2>
                <p className="text-muted-foreground text-sm md:text-base">
                  Informações rápidas para você chegar tranquilo no dia da consulta.
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-base font-medium">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="text-center mt-10">
                <Link to={finalLink}>
                  <Button
                    variant="obsidian"
                    size="lg"
                    onClick={() =>
                      trackCTAClick(
                        "ver_horarios_final",
                        "landing_paragominas_final",
                        "Ver horários em Paragominas"
                      )
                    }
                    className="min-h-[48px] text-base group"
                  >
                    Ver horários em Paragominas
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
};

export default Paragominas;
