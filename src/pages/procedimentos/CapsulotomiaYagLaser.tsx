import { Helmet } from "react-helmet-async";
import { REVISAO_CLINICA } from "@/lib/constants";
import { BASE_URL, localPorSlug } from "@/lib/locations";
import { procedureGraph } from "@/lib/schema";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import TestimonialsSection from "@/components/TestimonialsSection";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import YagVisionSlider from "@/components/procedimentos/yag/YagVisionSlider";
import YagAntesDepois from "@/components/procedimentos/yag/YagAntesDepois";
import YagTimeline from "@/components/procedimentos/yag/YagTimeline";
import YagTriage from "@/components/procedimentos/yag/YagTriage";
import YagLocation from "@/components/procedimentos/yag/YagLocation";
import YagSchedulingForm from "@/components/procedimentos/yag/YagSchedulingForm";
import {
  FAQS,
  SECTIONS,
  SINAIS_ALERTA,
  VALOR_YAG_COMPLETO,
  WHATSAPP_MENSAGEM,
  WHATSAPP_ORIGEM,
} from "@/components/procedimentos/yag/yagContent";


/**
 * Unidade onde a capsulotomia YAG e feita, vinda da fonte unica de NAP.
 *
 * O endereco estava escrito a mao dentro do JSON-LD desta pagina, copiado de
 * src/lib/locations.ts. O cabecalho daquele arquivo pede que endereco e
 * telefone mudem la e so la, porque o Google reconcilia NAP entre o schema e o
 * Google Business Profile. Copia a mao envelhece em silencio.
 */
const HGP = localPorSlug("hgp")

/**
 * Metadados de SEO da página, exportados para permitir asserção em teste
 * sem montar o layout (que depende de APIs de browser).
 *
 * O procedimento passou a ser realizado exclusivamente em Paragominas, no
 * Hospital Geral de Paragominas (HGP). A página não deve comunicar Belém.
 */
export const YAG_SEO = {
  slug: "capsulotomia-yag-laser",
  procedureName: "Capsulotomia YAG Laser",
  pageTitle: "Capsulotomia YAG Laser em Paragominas | Dr. Juliano Machado",
  metaDescription:
    "Capsulotomia YAG Laser no Hospital Geral de Paragominas (HGP), com o Dr. Juliano Machado. Trata a opacificação da cápsula posterior após catarata.",
  h1: "Capsulotomia YAG Laser em Paragominas",
  intro:
    "A capsulotomia YAG é um procedimento a laser que trata a opacificação da cápsula posterior — a chamada catarata secundária — que pode surgir meses ou anos após a cirurgia de catarata. O procedimento é realizado no Hospital Geral de Paragominas (HGP), mediante avaliação e agendamento com o Dr. Juliano Machado.",
  cidade: "Paragominas",
  local: HGP.name,
} as const;

const CapsulotomiaYagLaser = () => {
  const { waLink } = useSiteWhatsApp();
  const url = `${BASE_URL}/procedimentos/${YAG_SEO.slug}`;

  const irParaFormulario = () => {
    const alvo = document.getElementById("agendar");
    if (!alvo) return;
    const suave =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
    alvo.scrollIntoView({ behavior: suave as ScrollBehavior, block: "start" });
  };

  // Mesma funcao das outras onze paginas de procedimento. Esta pagina nao usa o
  // ProcedurePageLayout, por ter estrutura propria, entao o ponto de reuso e a
  // lib de schema e nao o componente. Ver o cabecalho de procedureGraph.
  //
  // O location fica so aqui porque a capsulotomia YAG e feita apenas no HGP. E
  // a unica pagina de procedimento com local exclusivo.
  const structuredData = procedureGraph({
    url,
    pageTitle: YAG_SEO.pageTitle,
    metaDescription: YAG_SEO.metaDescription,
    procedureName: YAG_SEO.procedureName,
    faqs: FAQS,
    location: {
      "@type": "Hospital",
      name: HGP.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: HGP.streetAddress,
        addressLocality: HGP.addressLocality,
        addressRegion: HGP.addressRegion,
        addressCountry: HGP.addressCountry,
      },
    },
  });

  return (
    <>
      <Helmet>
        <title>{YAG_SEO.pageTitle}</title>
        <meta name="description" content={YAG_SEO.metaDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={YAG_SEO.pageTitle} />
        <meta property="og:description" content={YAG_SEO.metaDescription} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${BASE_URL}/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${BASE_URL}/og-image.jpg`} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-28 md:pt-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumb */}
              <nav aria-label="breadcrumb" className="mb-8">
                <ol className="flex flex-wrap items-center gap-1.5 text-base text-muted-foreground">
                  <li>
                    <Link to="/" className="hover:text-primary transition-colors">
                      Início
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight className="w-4 h-4" />
                  </li>
                  <li>
                    <Link
                      to="/procedimentos"
                      className="hover:text-primary transition-colors"
                    >
                      Procedimentos
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight className="w-4 h-4" />
                  </li>
                  <li
                    className="text-foreground font-medium"
                    aria-current="page"
                  >
                    {YAG_SEO.procedureName}
                  </li>
                </ol>
              </nav>

              {/* Hero */}
              <section className="mb-14">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-base mb-6">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  Procedimento realizado pelo Dr. Juliano Machado
                </span>

                <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
                  {YAG_SEO.h1}
                </h1>

                <p className="text-xl text-muted-foreground leading-relaxed mb-8">
                  {YAG_SEO.intro}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="button"
                    variant="hero"
                    size="lg"
                    onClick={irParaFormulario}
                    className="gap-2.5 w-full sm:w-auto min-h-16 text-lg"
                  >
                    <CalendarCheck className="w-6 h-6" aria-hidden="true" />
                    Solicitar agendamento
                  </Button>

                  <a
                    href={waLink(WHATSAPP_MENSAGEM, `${WHATSAPP_ORIGEM}_hero`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto min-h-16 px-7 rounded-xl border-2 border-[#25D366] text-[#25D366] text-lg font-bold hover:bg-[#25D366] hover:text-white transition"
                  >
                    <MessageCircle className="w-6 h-6" aria-hidden="true" />
                    Chamar no WhatsApp
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-7 text-base text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" aria-hidden="true" />
                    Paragominas — HGP
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
                    Poucos minutos, sem internação
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" aria-hidden="true" />
                    Particular: {VALOR_YAG_COMPLETO}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck
                      className="w-5 h-5 text-primary"
                      aria-hidden="true"
                    />
                    CRM-PA 15253
                  </span>
                </div>
              </section>

              <div className="space-y-8 mb-16">
                {/* O novo local — a notícia da página */}
                <YagLocation />

                {/* Formulário logo cedo: quem já decidiu não precisa rolar */}
                <YagSchedulingForm />

                {/* Como a opacificação afeta a visão */}
                <YagVisionSlider />

                {/* Antes e depois na cápsula (ilustração própria) */}
                <YagAntesDepois />

                {/* Conteúdo médico */}
                {SECTIONS.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    aria-labelledby={`${section.id}-titulo`}
                    className="card-glass rounded-2xl p-6 md:p-8"
                  >
                    <h2
                      id={`${section.id}-titulo`}
                      className="text-2xl md:text-3xl font-bold text-foreground mb-4"
                    >
                      {section.title}
                    </h2>
                    <div className="space-y-4">
                      {section.paragraphs.map((p, i) => (
                        <p
                          key={i}
                          className="text-lg md:text-xl text-muted-foreground leading-relaxed"
                        >
                          {p}
                        </p>
                      ))}
                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="space-y-3 mt-5">
                          {section.bullets.map((b) => (
                            <li
                              key={b}
                              className="flex items-start gap-3 text-lg text-muted-foreground leading-relaxed"
                            >
                              <CheckCircle2
                                className="w-6 h-6 text-primary shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                ))}

                {/* Sinais de alerta */}
                <section
                  aria-labelledby="alerta-titulo"
                  className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6 md:p-8"
                >
                  <h2
                    id="alerta-titulo"
                    className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground mb-4"
                  >
                    <AlertTriangle
                      className="w-7 h-7 text-destructive shrink-0"
                      aria-hidden="true"
                    />
                    Quando procurar atendimento
                  </h2>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-5">
                    Depois do procedimento, entre em contato sem esperar o
                    retorno se notar qualquer um destes sinais:
                  </p>
                  <ul className="space-y-3">
                    {SINAIS_ALERTA.map((s) => (
                      <li
                        key={s}
                        className="flex items-start gap-3 text-lg text-foreground leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2.5 w-2.5 h-2.5 rounded-full bg-destructive shrink-0"
                        />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Linha do tempo */}
                <YagTimeline />

                {/* Triagem */}
                <YagTriage onIrParaFormulario={irParaFormulario} />

                {/* FAQ */}
                <section
                  aria-labelledby="faq-titulo"
                  className="card-glass rounded-2xl p-6 md:p-8"
                >
                  <h2
                    id="faq-titulo"
                    className="text-2xl md:text-3xl font-bold text-foreground mb-6"
                  >
                    Perguntas frequentes
                  </h2>
                  <Accordion type="single" collapsible className="w-full">
                    {FAQS.map((faq, i) => (
                      <AccordionItem
                        key={faq.question}
                        value={`faq-${i}`}
                        className="border-border/50"
                      >
                        <AccordionTrigger className="text-left text-lg md:text-xl text-foreground hover:no-underline font-semibold py-5">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-lg text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              </div>
            </div>
          </div>

          {/* Avaliações reais do Google */}
          <TestimonialsSection />

          {/* CTA final */}
          <section className="py-16 md:py-20 bg-secondary/20">
            <div className="container mx-auto px-4 text-center max-w-2xl">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Pronto para voltar a enxergar nítido?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
                Procedimento realizado no Hospital Geral de Paragominas (HGP).
                Preencha o formulário e nossa equipe entra em contato para
                verificar as datas disponíveis e os valores.
              </p>
              <Button
                type="button"
                variant="hero"
                size="lg"
                onClick={irParaFormulario}
                className="gap-2.5 min-h-16 text-lg"
              >
                <CalendarCheck className="w-6 h-6" aria-hidden="true" />
                Solicitar agendamento
              </Button>
            </div>
          </section>
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="mt-4 pt-5 border-t border-border/60 text-xs text-muted-foreground">
              Conteúdo revisado por {REVISAO_CLINICA.por}, {REVISAO_CLINICA.crm}, em{" "}
              {REVISAO_CLINICA.dataLegivel}. Esta página é informativa e não substitui
              a consulta: a indicação depende de avaliação presencial.
            </p>
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
};

export default CapsulotomiaYagLaser;
