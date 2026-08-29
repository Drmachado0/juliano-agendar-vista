import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronRight, CalendarCheck, CheckCircle2, MapPin, Clock, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import TestimonialsSection from "@/components/TestimonialsSection";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { REVISAO_CLINICA } from "@/lib/constants";
import { BASE_URL } from "@/lib/locations";
import { procedureGraph } from "@/lib/schema";

export interface ProcedureSection {
  title: string;
  paragraphs: React.ReactNode[];
  bullets?: string[];
}

export interface ProcedureFAQ {
  question: string;
  answer: string;
}

export interface ProcedurePageData {
  slug: string;
  procedureName: string; // "Cirurgia de Catarata"
  pageTitle: string; // full <title>
  metaDescription: string;
  h1: string; // includes cities
  intro: string;
  sections: ProcedureSection[];
  faqs: ProcedureFAQ[];
  /** Titulo e texto do CTA lateral. Sem override, cai no generico — o que
   *  fazia Consulta, Catarata e Pterigio servirem o MESMO bloco palavra por
   *  palavra, padrao que a auditoria de SEO apontou como conteudo duplicado. */
  sidebarCta?: { title: string; text: string };
  /** Idem para o CTA de fechamento da pagina. */
  finalCta?: { title: string; text: string };
  medicalProcedureType?: string; // schema.org procedureType
  bodyLocation?: string;
  /** Override opcional dos locais exibidos (chip, sidebar e CTA final).
   *  Usado quando o procedimento é ofertado apenas em algumas cidades. */
  locations?: {
    /** Rótulo curto exibido no chip do hero. Ex.: "Belém" ou "Paragominas e Belém". */
    label: string;
    /** Itens da sidebar (cidade + clínicas). */
    sidebarItems: string[];
    /** Frase usada no CTA final ("Atendimento em <ctaSuffix>."). */
    ctaSuffix: string;
  };
}

const ProcedurePageLayout = ({ data }: { data: ProcedurePageData }) => {
  const url = `${BASE_URL}/procedimentos/${data.slug}`;
  const locations = data.locations ?? {
    label: "Paragominas e Belém",
    sidebarItems: [
      "Clinicor e Hospital Geral — Paragominas",
      "IOB e Vitria — Belém",
    ],
    ctaSuffix: "Paragominas e Belém",
  };


  // O grafo inteiro vem de procedureGraph, em lib/schema.ts. As doze paginas de
  // procedimento usam a mesma funcao, inclusive a de capsulotomia YAG, que nao
  // usa este layout. Ver o cabecalho de la para o porque.
  const structuredData = procedureGraph({
    url,
    pageTitle: data.pageTitle,
    metaDescription: data.metaDescription,
    procedureName: data.procedureName,
    faqs: data.faqs,
    procedureType: data.medicalProcedureType,
    bodyLocation: data.bodyLocation,
  });

  return (
    <>
      <Helmet>
        <title>{data.pageTitle}</title>
        <meta name="description" content={data.metaDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={data.pageTitle} />
        <meta property="og:description" content={data.metaDescription} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${BASE_URL}/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${BASE_URL}/og-image.jpg`} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background">
        <Header />

        <main className="pt-28 md:pt-32">
          <div className="container mx-auto px-4">
            {/* Breadcrumb */}
            <nav aria-label="breadcrumb" className="mb-8">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-primary transition-colors">
                    Início
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li>
                  <Link to="/procedimentos" className="hover:text-primary transition-colors">
                    Procedimentos
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="w-3.5 h-3.5" />
                </li>
                <li className="text-foreground font-medium" aria-current="page">
                  {data.procedureName}
                </li>
              </ol>
            </nav>

            {/* Hero */}
            <section className="max-w-3xl mb-14">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6">
                <ShieldCheck className="w-3.5 h-3.5" />
                Procedimento realizado pelo Dr. Juliano Machado
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5 leading-tight">
                {data.h1}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">{data.intro}</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/agendamento">
                  <Button variant="hero" size="lg" className="gap-2 w-full sm:w-auto">
                    <CalendarCheck className="w-5 h-5" />
                    Agendar consulta
                  </Button>
                </Link>
                <Link to="/#locais">
                  <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                    <MapPin className="w-5 h-5" />
                    Ver locais de atendimento
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" /> {locations.label}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> Resposta em até 2h úteis
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> CRM-PA 15253
                </span>
              </div>
            </section>

            {/* Sections */}
            <div className="grid lg:grid-cols-3 gap-10 mb-20">
              <div className="lg:col-span-2 space-y-10">
                {data.sections.map((section) => (
                  <section key={section.title} className="card-glass rounded-2xl p-6 md:p-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                      {section.title}
                    </h2>
                    <div className="space-y-4">
                      {section.paragraphs.map((p, i) => (
                        <p key={i} className="text-muted-foreground leading-relaxed">
                          {p}
                        </p>
                      ))}
                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="space-y-2.5 mt-4">
                          {section.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                ))}

                {/* FAQ */}
                <section className="card-glass rounded-2xl p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                    Perguntas frequentes
                  </h2>
                  <Accordion type="single" collapsible className="w-full">
                    {data.faqs.map((faq, i) => (
                      <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
                        <AccordionTrigger className="text-left text-foreground hover:no-underline font-semibold">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>

                <p className="mt-10 pt-5 border-t border-border/60 text-xs text-muted-foreground">
                  Conteúdo revisado por {REVISAO_CLINICA.por}, {REVISAO_CLINICA.crm},
                  em {REVISAO_CLINICA.dataLegivel}. Esta página é informativa e não
                  substitui a consulta: a indicação depende de avaliação presencial.
                </p>
              </div>

              {/* Sidebar CTA */}
              <aside className="lg:col-span-1">
                <div className="sticky top-28 card-glass rounded-2xl p-6 md:p-7 border border-primary/15">
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {data.sidebarCta?.title ?? "Agende sua avaliação"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {data.sidebarCta?.text ??
                      "A indicação e o planejamento do procedimento dependem de avaliação presencial. Marque sua consulta com o Dr. Juliano."}
                  </p>
                  <Link to="/agendamento" className="block">
                    <Button variant="hero" size="lg" className="w-full gap-2">
                      <CalendarCheck className="w-5 h-5" />
                      Agendar consulta
                    </Button>
                  </Link>
                  <div className="mt-5 pt-5 border-t border-border/50 space-y-2 text-sm text-muted-foreground">
                    {locations.sidebarItems.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>

          {/* Real Google reviews */}
          <TestimonialsSection />

          {/* Final CTA */}
          <section className="py-16 md:py-20 bg-secondary/20">
            <div className="container mx-auto px-4 text-center max-w-2xl">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                {data.finalCta?.title ?? "Pronto para cuidar da sua visão?"}
              </h2>
              <p className="text-muted-foreground mb-8">
                {data.finalCta?.text ??
                  `Agende sua consulta online em poucos minutos. Atendimento em ${locations.ctaSuffix}.`}
              </p>
              <Link to="/agendamento">
                <Button variant="hero" size="lg" className="gap-2">
                  <CalendarCheck className="w-5 h-5" />
                  Agendar consulta
                </Button>
              </Link>
            </div>
          </section>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
};

export default ProcedurePageLayout;
