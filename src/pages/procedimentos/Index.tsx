import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileStickyCTA from "@/components/MobileStickyCTA";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Aperture,
  Camera,
  ClipboardList,
  Eye,
  Gauge,
  Ruler,
  Stethoscope,
  Zap,
} from "lucide-react";
import { DOCTOR } from "@/lib/constants";
import { BASE_URL } from "@/lib/locations";
import { physicianNode, websiteNode, medicalWebPageNode } from "@/lib/schema";

const CANONICAL = `${BASE_URL}/procedimentos`;

/**
 * Indice agrupado, nao lista plana.
 *
 * POR QUE: esta pagina existe para ser o hub dos procedimentos, e estava
 * listando 6 de 11. Os cinco exames criados depois (retinografia, tonometria,
 * gonioscopia, biometria e iridotomia) entraram no sitemap e no llms.txt mas
 * nao aqui, entao quem chegava pelo indice nao tinha como alcanca-los.
 *
 * Com 11 itens, uma grade plana vira parede de cartoes sem hierarquia. O
 * agrupamento responde a pergunta que o visitante realmente traz — "preciso
 * descobrir o que eu tenho" ou "ja sei e preciso tratar" — e o paragrafo de
 * cada grupo carrega o conteudo que faltava: a pagina tinha 170 palavras, o
 * menor volume do site.
 *
 * Os cartoes viram h3 sob o h2 do grupo, que e a hierarquia correta agora que
 * existe um nivel intermediario.
 */
const GRUPOS = [
  {
    grupo: "Exames diagnósticos",
    intro:
      "Antes de qualquer conduta vem a medida. Estes exames respondem perguntas diferentes sobre o mesmo olho — qual é a pressão interna, como está a retina, se o ângulo de drenagem é aberto ou estreito — e é o conjunto deles, nunca um isolado, que fecha um diagnóstico. A maior parte é feita na própria consulta, em minutos.",
    itens: [
      {
        title: "Mapeamento de Retina",
        description:
          "Exame do fundo do olho, incluindo a periferia, para diabetes, miopia alta e sintomas de alerta.",
        link: "/procedimentos/mapeamento-de-retina",
        icon: Eye,
      },
      {
        title: "Retinografia",
        description:
          "Fotografia do fundo do olho. Cria o registro que permite comparar o exame de hoje com o do ano passado.",
        link: "/procedimentos/retinografia",
        icon: Camera,
      },
      {
        title: "Tonometria",
        description:
          "Medida da pressão dentro do olho, exame básico no rastreio do glaucoma. Rápida e indolor.",
        link: "/procedimentos/tonometria",
        icon: Gauge,
      },
      {
        title: "Gonioscopia",
        description:
          "Define se o ângulo de drenagem é aberto ou fechado — distinção que muda todo o tratamento do glaucoma.",
        link: "/procedimentos/gonioscopia",
        icon: Aperture,
      },
      {
        title: "Biometria Ultrassônica",
        description:
          "Mede o olho por dentro para calcular o grau da lente que será implantada na cirurgia de catarata.",
        link: "/procedimentos/biometria-ultrassonica",
        icon: Ruler,
      },
    ],
  },
  {
    grupo: "Cirurgias e procedimentos a laser",
    intro:
      "Quando o exame indica intervenção, o procedimento é escolhido pelo que ele resolve, não pelo que soa mais moderno. Catarata e pterígio são cirurgias. Capsulotomia e iridotomia são aplicações de laser feitas no consultório, sem internação e em poucos minutos por olho.",
    itens: [
      {
        title: "Cirurgia de Catarata",
        description:
          "Substituição do cristalino opaco por uma lente intraocular para restaurar a nitidez visual.",
        link: "/procedimentos/cirurgia-de-catarata",
        icon: Eye,
      },
      {
        title: "Cirurgia de Pterígio",
        description:
          "Remoção do tecido que cresce sobre a córnea, com técnicas que reduzem o risco de retorno.",
        link: "/procedimentos/cirurgia-de-pterigio",
        icon: ClipboardList,
      },
      {
        title: "Capsulotomia YAG Laser",
        description:
          "Trata a opacificação da cápsula que pode surgir meses ou anos depois da cirurgia de catarata.",
        link: "/procedimentos/capsulotomia-yag-laser",
        icon: Zap,
      },
      {
        title: "Iridotomia a Laser",
        description:
          "Laser preventivo em olhos de ângulo estreito. Existe para que a crise de glaucoma agudo não aconteça.",
        link: "/procedimentos/iridotomia-a-laser",
        icon: Zap,
      },
    ],
  },
  {
    grupo: "Consultas e acompanhamento",
    intro:
      "Nem toda condição ocular se resolve num procedimento. O glaucoma é doença crônica: o tratamento é o acompanhamento, e o intervalo entre as visitas faz parte dele. A consulta é onde tudo começa e para onde tudo volta.",
    itens: [
      {
        title: "Consulta Oftalmológica",
        description:
          "Avaliação completa da saúde ocular, prescrição de óculos e acompanhamento de doenças.",
        link: "/procedimentos/consulta-oftalmologica",
        icon: Stethoscope,
      },
      {
        title: "Glaucoma",
        description:
          "Diagnóstico e acompanhamento do glaucoma, com tonometria, gonioscopia, campo visual e OCT.",
        link: "/procedimentos/glaucoma",
        icon: Eye,
      },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.itens);

const ProcedimentosIndex = () => {
  return (
    <>
      <Helmet>
        <title>Procedimentos Oftalmológicos em Paragominas e Belém</title>
        <meta
          name="description"
          content="Exames, cirurgias e consultas realizados pelo Dr. Juliano Machado em Paragominas e Belém: catarata, pterígio, glaucoma, laser e exames diagnósticos."
        />
        <meta property="og:title" content="Procedimentos Oftalmológicos em Paragominas e Belém" />
        <meta
          property="og:description"
          content="Exames, cirurgias e consultas realizados pelo Dr. Juliano Machado em Paragominas e Belém: catarata, pterígio, glaucoma, laser e exames diagnósticos."
        />
        <meta property="og:url" content={CANONICAL} />
        <link rel="canonical" href={CANONICAL} />

        {/*
          Um @graph unico em vez de dois blocos soltos. Breadcrumb e ItemList ja
          existiam, mas a pagina nao declarava QUEM realiza os procedimentos nem
          QUE pagina e esta: sem Physician, sem WebSite e sem MedicalWebPage, um
          mecanismo que le so esta URL ve um indice de procedimentos sem dono e
          sem data de revisao clinica. Os nos vem dos mesmos helpers da home,
          entao e a mesma entidade, nao uma copia.
        */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              physicianNode({ mainEntityOfPage: CANONICAL }),
              websiteNode(),
              medicalWebPageNode({
                name: "Procedimentos Oftalmológicos em Paragominas e Belém",
                description: `Procedimentos realizados por ${DOCTOR.name} (${DOCTOR.crm}): exames diagnósticos, cirurgias de catarata e pterígio, laser e consultas.`,
                url: CANONICAL,
              }),
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: `${BASE_URL}/` },
                  { "@type": "ListItem", position: 2, name: "Procedimentos", item: CANONICAL },
                ],
              },
              {
                "@type": "ItemList",
                name: "Procedimentos oftalmológicos",
                itemListElement: TODOS.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: p.title,
                  description: p.description,
                  url: `${BASE_URL}${p.link}`,
                })),
              },
            ],
          })}
        </script>
      </Helmet>

      <div className="theme-obsidian min-h-screen bg-background">
        <Header />

        <main className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-primary font-semibold text-sm mb-6 uppercase tracking-wider">
                Especialidades
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                Procedimentos <span className="gradient-text">Oftalmológicos</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Do exame que mede ao procedimento que corrige, e do diagnóstico ao acompanhamento
                que mantém o resultado. Atendimento em Paragominas e Belém, com {DOCTOR.crm}.
              </p>
            </div>

            {GRUPOS.map((g) => (
              <section key={g.grupo} className="mb-20 max-w-5xl mx-auto">
                <div className="max-w-3xl mb-10">
                  <h2 className="text-3xl font-bold text-foreground mb-4">{g.grupo}</h2>
                  <p className="text-muted-foreground leading-relaxed">{g.intro}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {g.itens.map((proc) => (
                    <Link
                      key={proc.link}
                      to={proc.link}
                      className="group relative p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 shadow-sm hover:shadow-xl hover:shadow-primary/5"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                        <proc.icon className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                        {proc.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {proc.description}
                      </p>
                      <div className="flex items-center text-primary font-semibold text-sm group-hover:gap-2 transition-all">
                        Ver detalhes <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            <div className="mt-20 p-10 rounded-[2.5rem] bg-gradient-to-br from-card via-card to-primary/5 border border-primary/10 text-center max-w-4xl mx-auto shadow-2xl">
              <h2 className="text-2xl font-bold text-foreground mb-4">Agende sua avaliação</h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                O diagnóstico correto é o primeiro passo para a saúde dos seus olhos. Reserve seu
                horário online ou fale conosco pelo WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/agendamento" className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                    Agendar Consulta
                  </button>
                </Link>
                <a
                  href={`https://wa.me/5591936180476`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 glass-panel text-foreground font-bold rounded-full hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>

            <div className="mt-16 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{DOCTOR.name} — Médico Oftalmologista</p>
              <p>{DOCTOR.crm}</p>
            </div>
          </div>
        </main>

        <Footer />
        <WhatsAppButton apenasDesktop />
        <MobileStickyCTA />
      </div>
    </>
  );
};

export default ProcedimentosIndex;
