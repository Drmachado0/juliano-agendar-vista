import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import AreasDeAtuacao from "@/components/AreasDeAtuacao";
import { Button } from "@/components/ui/button";
import { CalendarCheck, MapPin, Phone, Navigation, BadgeCheck } from "lucide-react";
import { DOCTOR } from "@/lib/constants";
import { LOCATIONS, BASE_URL, clinicNodes } from "@/lib/locations";
import {
  physicianNode,
  websiteNode,
  medicalWebPageNode,
  faqPageNode,
} from "@/lib/schema";

const CANONICAL = `${BASE_URL}/belem`;

/**
 * Pagina de cidade — Belem.
 *
 * O title, a description e o H1 do site vendiam "Paragominas e Belem", mas so
 * Paragominas tinha pagina propria. Belem nao tinha pagina, nem mapa, nem botao
 * de direcao, nem link de avaliacao — e /belem respondia HTTP 200 com conteudo
 * de not-found, o que e pior que um 404 real.
 *
 * Afirmacoes operacionais (o que e ofertado em cada unidade) revisadas e
 * aprovadas pelo Dr. Juliano Machado em 26/08/2026.
 */

const MOTIVOS = [
  { title: "Avaliação de rotina", note: "Check-up periódico da saúde ocular." },
  { title: "Mudança no grau", note: "Dificuldade para perto, longe ou ao dirigir." },
  { title: "Catarata", note: "Avaliação do cristalino e indicação cirúrgica." },
  { title: "Glaucoma", note: "Pressão intraocular e acompanhamento." },
  { title: "Pterígio", note: "Crescimento de tecido sobre a córnea." },
  { title: "Retorno", note: "Reavaliação e ajuste de conduta." },
] as const;

const FAQ = [
  {
    q: "Em qual das duas unidades eu sou atendido?",
    a: "Você escolhe a unidade no momento do agendamento, pela que for mais conveniente para você. A equipe confirma o local junto com o horário.",
  },
  {
    q: "Exames e cirurgias também acontecem em Belém?",
    a: "Sim. Consultas, exames e procedimentos são realizados nas duas cidades. A indicação e o local de cada procedimento são definidos na consulta, conforme o caso.",
  },
  {
    q: "Como recebo a confirmação do horário?",
    a: "O agendamento é feito online e a confirmação chega por WhatsApp, no número que você informar no formulário.",
  },
  {
    q: "Atende convênio em Belém?",
    a: "A cobertura varia conforme o plano e o tipo de atendimento. Entre em contato antes de agendar para confirmar o seu; o atendimento particular também está disponível.",
  },
] as const;

export default function Belem() {
  const unidades = LOCATIONS.filter((l) => l.city === "Belém");

  // Grafo completo da pagina, montado pelos mesmos helpers da home.
  //
  // Antes daqui saia SO um MedicalClinic por unidade. A pagina que responde por
  // "oftalmologista em Belem" nao declarava quem e o medico, nem que pagina e
  // esta, nem quando o conteudo foi revisado — os clinicos apontavam para um
  // @id de Physician que a propria pagina nunca definia. Para um mecanismo que
  // le esta URL isolada (e e assim que assistente de IA le), a entidade
  // principal simplesmente nao existia.
  //
  // O FAQ ja estava na tela em <dl>/<dt>/<dd> desde sempre, sem FAQPage. Como
  // faqPageNode recebe o MESMO array que a interface renderiza, nao ha risco de
  // marcar pergunta que o paciente nao ve.
  //
  // Sem `rating`: esta pagina nao exibe avaliacao, e aggregateRating so pode
  // sair onde a nota esta visivel.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      physicianNode({ mainEntityOfPage: CANONICAL }),
      websiteNode(),
      medicalWebPageNode({
        name: `Oftalmologista em Belém — ${DOCTOR.name}`,
        description: `Consultas, exames e cirurgias oftalmológicas em Belém com ${DOCTOR.name}, ${DOCTOR.crm}.`,
        url: CANONICAL,
      }),
      faqPageNode(
        FAQ.map((f) => ({ question: f.q, answer: f.a })),
        CANONICAL
      ),
      ...clinicNodes("Belém"),
    ],
  };

  return (
    <>
      <Helmet>
        <title>Oftalmologista em Belém | {DOCTOR.name}</title>
        <meta
          name="description"
          content={`Consulta oftalmológica em Belém com ${DOCTOR.name} (${DOCTOR.crm}). Atendimento no Instituto de Olhos de Belém e no Ed. Síntese 21. Agende online.`}
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={`Oftalmologista em Belém | ${DOCTOR.name}`} />
        <meta
          property="og:description"
          content={`Consultas, exames e cirurgias oftalmológicas em Belém com ${DOCTOR.name}, ${DOCTOR.crm}.`}
        />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-xs uppercase tracking-wider mb-5">
            <MapPin className="w-3.5 h-3.5" />
            Belém — PA
          </span>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Oftalmologista em Belém
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground mb-4">
            {DOCTOR.name}, {DOCTOR.crm}, atende em Belém em duas unidades. A
            consulta inclui avaliação oftalmológica completa, e os exames
            complementares são solicitados conforme a indicação de cada caso.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground mb-10">
            Formado em Medicina pelo CESUPA e com residência em Oftalmologia
            pelo Hospital Federal de Bonsucesso, tem fellowship em Glaucoma pela
            Unidade Paulista de Oftalmologia.{" "}
            <Link to="/sobre" className="text-primary hover:underline underline-offset-4">
              Ver formação completa
            </Link>
            .
          </p>

          <section aria-labelledby="unidades" className="mb-12">
            <h2 id="unidades" className="text-xl md:text-2xl font-bold text-foreground mb-6">
              Onde atendo em Belém
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {unidades.map((u) => (
                <div key={u.slug} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold text-foreground mb-3">{u.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-start gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {u.displayAddress}
                  </p>
                  <a
                    href={`tel:${u.phoneE164}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 mb-4"
                  >
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    {u.phone}
                  </a>
                  <a
                    href={u.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-sm font-semibold"
                  >
                    <Navigation className="w-4 h-4" />
                    Como chegar
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="motivos" className="mb-12">
            <h2 id="motivos" className="text-xl md:text-2xl font-bold text-foreground mb-6">
              Motivos mais comuns de consulta
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {MOTIVOS.map((m) => (
                <li key={m.title} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold text-foreground">{m.title}</span>
                    <span className="text-muted-foreground"> — {m.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="faq" className="mb-12">
            <h2 id="faq" className="text-xl md:text-2xl font-bold text-foreground mb-6">
              Perguntas frequentes
            </h2>
            <dl className="space-y-5">
              {FAQ.map((f) => (
                <div key={f.q} className="border-l-2 border-primary/25 pl-4">
                  <dt className="font-semibold text-foreground mb-1">{f.q}</dt>
                  <dd className="text-sm text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="atuacao-belem" className="mb-12">
            <AreasDeAtuacao
              headingId="atuacao-belem"
              titulo="O que é atendido em Belém"
              descricao="Consultas, exames e procedimentos. A indicação e o local de cada um são definidos na consulta."
            />
          </section>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-foreground mb-2">
              Agende sua consulta em Belém
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              O agendamento é online e leva poucos minutos. A confirmação chega
              por WhatsApp.
            </p>
            <Link to="/agendamento">
              <Button variant="hero" size="lg" className="gap-2">
                <CalendarCheck className="h-4 w-4" />
                Agendar consulta
              </Button>
            </Link>
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </>
  );
}
