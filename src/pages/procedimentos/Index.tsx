import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import MobileStickyCTA from "@/components/MobileStickyCTA";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, ClipboardList, Zap, Stethoscope } from "lucide-react";
import { DOCTOR } from "@/lib/constants";

const ProcedimentosIndex = () => {
  const procedimentos = [
    {
      title: "Cirurgia de Catarata",
      description: "Substituição do cristalino opaco por uma lente intraocular para restaurar a nitidez visual.",
      link: "/procedimentos/cirurgia-de-catarata",
      icon: Eye,
    },
    {
      title: "Cirurgia de Pterígio",
      description: "Remoção do tecido que cresce sobre a córnea, utilizando técnicas que reduzem o risco de retorno.",
      link: "/procedimentos/cirurgia-de-pterigio",
      icon: ClipboardList,
    },
    {
      title: "Capsulotomia YAG Laser",
      description: "Procedimento rápido e indolor para tratar a opacificação da cápsula após a cirurgia de catarata.",
      link: "/procedimentos/capsulotomia-yag-laser",
      icon: Zap,
    },
    {
      title: "Glaucoma",
      description: "Diagnóstico e acompanhamento do glaucoma, com tonometria, gonioscopia, campo visual e OCT.",
      link: "/procedimentos/glaucoma",
      icon: Eye,
    },
    {
      title: "Mapeamento de Retina",
      description: "Exame do fundo do olho, incluindo a periferia, para diabetes, miopia alta e sintomas de alerta.",
      link: "/procedimentos/mapeamento-de-retina",
      icon: Eye,
    },
    {
      title: "Consulta Oftalmológica",
      description: "Avaliação completa da saúde ocular, prescrição de óculos e acompanhamento de doenças.",
      link: "/procedimentos/consulta-oftalmologica",
      icon: Stethoscope,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Procedimentos Oftalmológicos em Paragominas e Belém</title>
        <meta
          name="description"
          content="Conheça os procedimentos realizados pelo Dr. Juliano Machado: Cirurgia de Catarata, Pterígio, YAG Laser e consultas. Atendimento em Paragominas e Belém."
        />
        <link rel="canonical" href="https://drjulianomachado.com/procedimentos" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Início", item: "https://drjulianomachado.com/" },
              { "@type": "ListItem", position: 2, name: "Procedimentos", item: "https://drjulianomachado.com/procedimentos" },
            ],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Procedimentos oftalmológicos",
            itemListElement: procedimentos.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: p.title,
              description: p.description,
              url: `https://drjulianomachado.com${p.link}`,
            })),
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
                Oferecemos soluções completas para a saúde da sua visão, desde diagnósticos precisos até cirurgias avançadas com acompanhamento humanizado.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {procedimentos.map((proc) => (
                <Link
                  key={proc.link}
                  to={proc.link}
                  className="group relative p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 shadow-sm hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <proc.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {proc.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {proc.description}
                  </p>
                  <div className="flex items-center text-primary font-semibold text-sm group-hover:gap-2 transition-all">
                    Ver detalhes <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-20 p-10 rounded-[2.5rem] bg-gradient-to-br from-card via-card to-primary/5 border border-primary/10 text-center max-w-4xl mx-auto shadow-2xl">
              <h3 className="text-2xl font-bold text-foreground mb-4">Agende sua avaliação</h3>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                O diagnóstico correto é o primeiro passo para a saúde dos seus olhos. Reserve seu horário online ou fale conosco pelo WhatsApp.
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
        <WhatsAppButton />
        <MobileStickyCTA />
      </div>
    </>
  );
};

export default ProcedimentosIndex;
