import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Aperture,
  ArrowRight,
  CircleDotDashed,
  Clock,
  Eye,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Retroiluminações de um caso real, recortadas da arte "Capsulotomia YAG Laser
 * — Antes e Depois".
 *
 * Da peça original vieram SÓ as duas fotos. A moldura, as tarjas ANTES/DEPOIS,
 * as legendas e o rodapé são remontados aqui em HTML para nascerem no tema da
 * landing (obsidiana + teal + cobre, Archivo nos títulos e Inter no corpo), no
 * lugar do azul-marinho sobre branco e da tipografia da arte de origem. Assim o
 * bloco acompanha qualquer troca de token e continua legível no mobile.
 *
 * Para trocar as fotos, basta substituir os dois arquivos: o layout não muda.
 */
import yagAntes from "@/assets/yag-antes.webp";
import yagDepois from "@/assets/yag-depois.webp";

/** Os dois lados da comparação. `destaque` marca o lado pós-laser (teal). */
const COMPARACAO = [
  {
    id: "antes",
    rotulo: "Antes",
    foto: yagAntes,
    alt: "Retroiluminação do olho antes do laser: a cápsula posterior aparece opaca e barra o reflexo do fundo do olho.",
    icone: CircleDotDashed,
    titulo: "Opacidade da cápsula posterior",
    legenda: "Visão embaçada",
    destaque: false,
  },
  {
    id: "depois",
    rotulo: "Depois",
    foto: yagDepois,
    alt: "Retroiluminação do mesmo olho após o laser: uma janela central aberta na cápsula deixa o reflexo alaranjado do fundo do olho passar.",
    icone: Aperture,
    titulo: "Abertura central após o YAG laser",
    legenda: "Visão mais nítida",
    destaque: true,
  },
];

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

          {/* Comparação antes/depois */}
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
              {/* pt maior que o p geral: o canto de 5rem invade o topo à
                  esquerda e cortaria o título se ele subisse mais. */}
              <figure className="relative m-0 card-glass rounded-3xl rounded-tl-[5rem] shadow-2xl p-5 sm:p-6 pt-8 sm:pt-10">
                <div className="text-center mb-5">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    Antes e depois
                  </h3>
                  {/* Filete pontilhado da arte original, redesenhado em cobre */}
                  <div
                    aria-hidden="true"
                    className="mt-2 flex items-center justify-center gap-2"
                  >
                    <span className="h-px w-10 bg-gradient-to-r from-transparent to-accent/50" />
                    <span className="h-1 w-1 rounded-full bg-accent" />
                    <span className="h-px w-10 bg-gradient-to-l from-transparent to-accent/50" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {COMPARACAO.map(
                    ({
                      id,
                      rotulo,
                      foto,
                      alt,
                      icone: Icone,
                      titulo,
                      legenda,
                      destaque,
                    }) => (
                      <div
                        key={id}
                        className={`overflow-hidden rounded-2xl border ${
                          destaque
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/60 bg-secondary/40"
                        }`}
                      >
                        <p
                          className={`py-2 text-center text-xs sm:text-sm font-bold uppercase tracking-[0.14em] ${
                            destaque
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {rotulo}
                        </p>
                        <img
                          src={foto}
                          alt={alt}
                          width={542}
                          height={542}
                          loading="lazy"
                          decoding="async"
                          className="w-full aspect-square object-cover"
                        />
                        <div className="p-3 sm:p-4">
                          <Icone
                            className={`w-5 h-5 mb-2 ${
                              destaque ? "text-primary" : "text-muted-foreground"
                            }`}
                            aria-hidden="true"
                          />
                          <p
                            className={`text-sm font-semibold leading-snug ${
                              destaque ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {titulo}
                          </p>
                          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                            {legenda}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <figcaption className="mt-4 flex gap-3 rounded-2xl border border-border/60 bg-secondary/30 p-3 sm:p-4">
                  <ShieldCheck
                    className="w-5 h-5 mt-0.5 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    A capsulotomia YAG laser remove a opacidade da cápsula
                    posterior e melhora a qualidade da visão. Imagens de um caso
                    real — o resultado varia de paciente para paciente.
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default YagLaserSection;
