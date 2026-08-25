import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Eye, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * FOTO PROVISÓRIA — trocar assim que houver imagem do YAG.
 *
 * Esta é a mesma foto do HeroSection, no topo da própria home. Foi usada por
 * falta de alternativa: `dr-juliano-consultorio` é a cena do vídeo do
 * AboutSection e `dr-juliano-machado` é uma foto pessoal, não clínica.
 *
 * O ideal aqui é uma foto do equipamento de YAG no HGP, do ambiente, ou do
 * Dr. Juliano realizando o procedimento. Para trocar, basta alterar este
 * import — o resto do componente não muda.
 */
import yagFoto from "@/assets/dr-juliano-hero.webp";

const DESTAQUES = [
  { icone: Clock, texto: "Poucos minutos, sem internação" },
  { icone: Eye, texto: "Colírio anestésico — sem cortes nem agulhas" },
  { icone: ShieldCheck, texto: "Alta no mesmo dia" },
];

/**
 * Seção de YAG Laser na home.
 *
 * Segue o padrão visual do AboutSection: metade texto, metade imagem, com o
 * mesmo tratamento de moldura e brilho. Comunica o que o card genérico de
 * ProceduresSection não comunica — que o procedimento mudou de cidade.
 *
 * O valor NÃO aparece aqui de propósito: fica na página do procedimento, para
 * a home não exibir preço em destaque.
 */
const YagLaserSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="yag-laser"
      aria-labelledby="yag-home-titulo"
      className="relative py-16 md:py-24 scroll-mt-24 overflow-hidden"
    >
      {/* Círculos decorativos, espelhando o AboutSection */}
      <div
        aria-hidden="true"
        className="absolute -left-32 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/5 hidden lg:block"
      >
        <div className="absolute inset-[20%] rounded-full border border-primary/[0.03]" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Texto */}
          <div
            className={`transition-all duration-700 ease-out-expo ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/8 border border-accent/15 text-accent font-semibold text-sm mb-6">
              <MapPin className="w-4 h-4" aria-hidden="true" />
              Agora no HGP — Paragominas
            </span>

            <h2
              id="yag-home-titulo"
              className="text-3xl md:text-4xl font-bold text-foreground mb-5 leading-tight"
            >
              YAG Laser
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              Sua visão voltou a embaçar depois da cirurgia de catarata?{" "}
              <strong className="text-foreground">
                Não é a catarata voltando
              </strong>{" "}
              — é a cápsula que sustenta a lente que ficou opaca com o tempo.
            </p>

            <p className="text-lg text-muted-foreground leading-relaxed mb-7">
              O YAG Laser abre uma pequena janela nessa membrana e a luz volta a
              passar. Sem cirurgia, sem internação.
            </p>

            <ul className="space-y-3 mb-8">
              {DESTAQUES.map(({ icone: Icone, texto }) => (
                <li
                  key={texto}
                  className="flex items-center gap-3 text-base text-muted-foreground"
                >
                  <Icone
                    className="w-5 h-5 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  {texto}
                </li>
              ))}
            </ul>

            {/* via-gold-500 substitui o via-primary da variante `hero`: sob
                theme-obsidian, --primary é teal e o botão saía num degradê
                ouro→teal→ouro. Aqui o amarelo é fixo, como no resto do site. */}
            <Link to="/procedimentos/capsulotomia-yag-laser">
              <Button
                variant="hero"
                size="lg"
                className="gap-2 min-h-14 via-gold-500 shadow-gold-500/30 hover:shadow-gold-500/40"
              >
                Saiba mais
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          {/* Imagem */}
          <div
            className={`order-first lg:order-last transition-all duration-700 delay-150 ease-out-expo ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="relative max-w-md mx-auto">
              <div
                aria-hidden="true"
                className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl blur-2xl"
              />
              <div className="relative rounded-3xl rounded-tl-[5rem] overflow-hidden border border-border/50 shadow-2xl">
                <img
                  src={yagFoto}
                  alt="Dr. Juliano Machado examinando a visão de um paciente na lâmpada de fenda."
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default YagLaserSection;
