import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarCheck, GraduationCap, BadgeCheck, MapPin } from "lucide-react";
import { DOCTOR, FORMACAO, INSTITUICOES_FORMACAO } from "@/lib/constants";
import { BASE_URL, PHYSICIAN_ID, citiesServed } from "@/lib/locations";

const URL_SOBRE = `${BASE_URL}/sobre`;

/**
 * Pagina de autor.
 *
 * Conteudo medico e YMYL: o Google avalia quem assina antes de avaliar o que
 * esta escrito. Ate aqui o site nao tinha nenhuma URL que servisse de prova de
 * quem e o profissional — a biografia existia so embutida na home, e o link
 * "Sobre" do rodape quebrava em silencio fora dela.
 *
 * Os dados de formacao vem de constants.ts (fonte: Curriculo Lattes/CNPq) e
 * alimentam ao mesmo tempo o texto visivel e o alumniOf do JSON-LD.
 */
export default function Sobre() {
  // Mesmo @id do no Physician da home: e a mesma entidade descrita em outra
  // pagina, nao uma segunda pessoa.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": PHYSICIAN_ID,
    name: DOCTOR.name,
    url: URL_SOBRE,
    image: `${BASE_URL}/og-image.jpg`,
    medicalSpecialty: "Ophthalmology",
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CRM",
      value: DOCTOR.crm,
    },
    alumniOf: INSTITUICOES_FORMACAO.map((nome) => ({
      "@type": "CollegeOrUniversity",
      name: nome,
    })),
    memberOf: DOCTOR.memberships.map((m) => ({
      "@type": "Organization",
      name: m,
    })),
    knowsAbout: [
      "Glaucoma",
      "Cirurgia de catarata",
      "Pterígio",
      "Capsulotomia YAG laser",
      "Campo visual",
      "Tomografia de coerência óptica (OCT)",
    ],
    areaServed: citiesServed().map((c) => ({ "@type": "City", name: c })),
  };

  return (
    <>
      <Helmet>
        <title>Sobre o {DOCTOR.name} — formação e trajetória</title>
        <meta
          name="description"
          content={`${DOCTOR.name}, ${DOCTOR.crm}. Residência em Oftalmologia no Hospital Federal de Bonsucesso e fellowship em Glaucoma. Atendimento em ${DOCTOR.cities}.`}
        />
        <link rel="canonical" href={URL_SOBRE} />
        <meta property="og:title" content={`Sobre o ${DOCTOR.name}`} />
        <meta
          property="og:description"
          content={`Formação, residência médica e áreas de atuação do ${DOCTOR.name}, ${DOCTOR.crm}.`}
        />
        <meta property="og:url" content={URL_SOBRE} />
        <meta property="og:type" content="profile" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar à página inicial
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Sobre o {DOCTOR.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-8">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-primary" />
              {DOCTOR.crm}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              {DOCTOR.cities}
            </span>
          </div>

          <p className="text-base leading-relaxed text-muted-foreground mb-4">
            {DOCTOR.name} é médico oftalmologista, {DOCTOR.crm}. Formou-se em
            Medicina pelo Centro Universitário do Estado do Pará (CESUPA) e fez
            residência médica em Oftalmologia no Hospital Federal de Bonsucesso,
            no Rio de Janeiro.
          </p>
          <p className="text-base leading-relaxed text-muted-foreground mb-4">
            Aprofundou-se em glaucoma: concluiu o curso de Glaucoma Clínico e
            Cirúrgico na Universidade Federal de São Paulo (UNIFESP) e um
            fellowship de 1.980 horas em Glaucoma na Unidade Paulista de
            Oftalmologia (UPO).
          </p>
          <p className="text-base leading-relaxed text-muted-foreground mb-10">
            Atende em {DOCTOR.cities}, com consultas, exames e cirurgias —
            catarata, pterígio e capsulotomia YAG laser, além de acompanhamento
            de glaucoma e doenças da retina.
          </p>

          <section aria-labelledby="formacao" className="mb-12">
            <h2
              id="formacao"
              className="text-xl md:text-2xl font-bold text-foreground mb-6 inline-flex items-center gap-2"
            >
              <GraduationCap className="w-5 h-5 text-primary" />
              Formação
            </h2>
            <ol className="space-y-5">
              {FORMACAO.map((item) => (
                <li
                  key={`${item.periodo}-${item.titulo}`}
                  className="border-l-2 border-primary/25 pl-4"
                >
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    {item.periodo}
                  </p>
                  <h3 className="font-semibold text-foreground">{item.titulo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.instituicao}
                    {item.detalhe ? ` · ${item.detalhe}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="afiliacoes" className="mb-12">
            <h2 id="afiliacoes" className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Afiliações
            </h2>
            <ul className="space-y-2">
              {DOCTOR.memberships.map((m) => (
                <li key={m} className="text-sm text-muted-foreground flex items-start gap-2">
                  <BadgeCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {m}
                </li>
              ))}
            </ul>
          </section>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-foreground mb-2">
              Precisa de uma avaliação?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              O agendamento é online e a confirmação chega por WhatsApp.
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
