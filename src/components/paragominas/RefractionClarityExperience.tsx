import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { buildAgendamentoLink } from "@/lib/agendamentoLink";
import { useGoogleTag } from "@/hooks/useGoogleTag";

interface Props {
  onFirstInteract?: () => void;
}

const LINES = ["E F P", "T O Z", "L P E D"];

/**
 * Mapeia o valor do slider (0–100) em uma indicação estilo Snellen (20/XX).
 * Faixas fixas — não é resultado clínico, apenas apoio visual à demonstração.
 */
export const snellenForValue = (v: number): string => {
  if (v >= 100) return "20 / 20";
  if (v >= 80) return "20 / 30";
  if (v >= 60) return "20 / 40";
  if (v >= 40) return "20 / 60";
  if (v >= 20) return "20 / 100";
  return "20 / 200";
};

/**
 * Seção-assinatura da /paragominas — versão premium.
 * O slider revela a "nitidez" (blur 12px → 0) sobre uma placa Snellen simulada.
 */
const RefractionClarityExperience = ({ onFirstInteract }: Props) => {
  const [value, setValue] = useState(0);
  const firedRef = useRef(false);
  const snellen = snellenForValue(value);
  const [announced, setAnnounced] = useState<string>("");
  const lastAnnouncedRef = useRef<string>("");
  const { trackEvent } = useGoogleTag();

  const isMax = value >= 100;

  // Anuncia apenas ao atingir nitidez máxima
  useEffect(() => {
    const msg = isMax ? "Nitidez máxima. Opção de agendamento disponível." : "";
    if (msg !== lastAnnouncedRef.current) {
      lastAnnouncedRef.current = msg;
      setAnnounced(msg);
    }
  }, [isMax]);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFirstInteract?.();
  };

  const bump = (delta: number) => {
    setValue((v) => Math.min(100, Math.max(0, v + delta)));
    fire();
  };

  // Blur: 12px em 0 → 0px em 100
  const blurPx = ((100 - value) / 100) * 12;
  const contrast = 0.5 + (value / 100) * 0.6;
  const opacity = 0.6 + (value / 100) * 0.4;
  const progressPct = value;

  const clarezaLink = buildAgendamentoLink({
    utm_content: "clareza_paragominas",
    basePath: "/paragominas/agendamento",
  });

  const handleCtaClick = () => {
    trackEvent("cta_click", {
      action: "agendar_clareza",
      placement: "landing_paragominas_clarity_demo",
    });
  };

  return (
    <section
      aria-labelledby="clareza-heading"
      className="pgm-section--dark relative overflow-hidden py-24 md:py-32"
      style={{ background: "var(--pgm-petroleo)", color: "var(--pgm-marfim)" }}
    >
      {/* Linhas de referência ópticas */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.06]"
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
      >
        <g stroke="#F3F0E8" strokeWidth="1">
          <line x1="0" y1="200" x2="1200" y2="200" />
          <line x1="0" y1="400" x2="1200" y2="400" />
          <line x1="0" y1="600" x2="1200" y2="600" />
          <line x1="300" y1="0" x2="300" y2="800" />
          <line x1="900" y1="0" x2="900" y2="800" />
        </g>
      </svg>

      <div className="container mx-auto px-4 max-w-6xl relative">
        <header className="mb-16 md:mb-20 max-w-3xl">
          <h2
            id="clareza-heading"
            className="pgm-serif text-[2.2rem] sm:text-[3rem] md:text-[4rem] leading-[0.98] tracking-[-0.02em]"
            style={{ fontFamily: "Fraunces, Georgia, serif" }}
          >
            Da visão embaçada
            <br />
            <span className="italic" style={{ color: "var(--pgm-ciano)" }}>
              à clareza.
            </span>
          </h2>
        </header>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 lg:gap-24 items-center">
          {/* Coluna esquerda — controle */}
          <div className="order-2 lg:order-1 max-w-md">
            <p className="text-base md:text-lg leading-relaxed mb-10" style={{ color: "rgba(243,240,232,0.85)" }}>
              Encontrar a melhor nitidez faz parte de uma avaliação cuidadosa da visão.
              Deslize e veja a diferença.
            </p>

            <div className="space-y-5">
              {/* Convite acima do trilho */}
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col">
                  <span
                    className="uppercase"
                    style={{
                      color: "var(--pgm-ciano)",
                      fontSize: "14px",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                    }}
                    aria-hidden="true"
                  >
                    Deslize aqui
                  </span>
                  <span
                    style={{
                      color: "rgba(243,240,232,0.82)",
                      fontSize: "14px",
                      marginTop: 4,
                    }}
                    aria-hidden="true"
                  >
                    para ajustar a nitidez
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className="hidden md:inline-block pb-1"
                  style={{ color: "var(--pgm-ciano)" }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="4" x2="12" y2="20" />
                    <polyline points="5 13 12 20 19 13" />
                  </svg>
                </span>
              </div>

              {/* Trilho com progresso ciano preenchido */}
              <div
                className="relative"
                style={{
                  ["--pgm-progress" as string]: `${progressPct}%`,
                }}
              >
                <input
                  id="clarity-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  aria-label="Deslize para ajustar a nitidez da demonstração"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value}
                  aria-valuetext={snellen}
                  onChange={(e) => {
                    setValue(Number(e.target.value));
                    fire();
                  }}
                  className="pgm-range pgm-range--enhanced w-full"
                  style={{
                    background: `linear-gradient(to right, var(--pgm-ciano) 0%, var(--pgm-ciano) ${progressPct}%, rgba(243,240,232,0.22) ${progressPct}%, rgba(243,240,232,0.22) 100%)`,
                  }}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => bump(-10)}
                  className="pgm-btn pgm-btn--ghost min-h-[44px] text-sm px-5"
                >
                  Mais embaçado
                </button>
                <button
                  type="button"
                  onClick={() => bump(10)}
                  className="pgm-btn pgm-btn--ivory min-h-[44px] text-sm px-5"
                >
                  Mais nítido
                </button>
              </div>

              {/* Anúncio aria-live: só ao atingir nitidez máxima */}
              <p className="sr-only" aria-live="polite">
                {announced}
              </p>

              <div className="pgm-rule-dark mt-6" />
              <p className="text-xs leading-relaxed" style={{ color: "rgba(243,240,232,0.55)" }}>
                Demonstração visual ilustrativa. Não substitui avaliação oftalmológica.
              </p>
            </div>
          </div>

          {/* Coluna direita — placa Snellen editorial */}
          <div className="order-1 lg:order-2 relative">
            {/* Filetes de referência */}
            <div className="absolute -inset-6 md:-inset-10 pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-px" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute top-0 left-0 w-px h-8" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute top-0 right-0 w-8 h-px" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute top-0 right-0 w-px h-8" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute bottom-0 left-0 w-8 h-px" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute bottom-0 left-0 w-px h-8" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute bottom-0 right-0 w-8 h-px" style={{ background: "var(--pgm-champagne)" }} />
              <div className="absolute bottom-0 right-0 w-px h-8" style={{ background: "var(--pgm-champagne)" }} />
            </div>

            {/* Placa em marfim — o blur NUNCA é aplicado ao quadro, apenas ao grupo das letras */}
            <div
              className="relative mx-auto max-w-md px-10 py-14 md:px-14 md:py-20"
              style={{
                background: "var(--pgm-marfim)",
                minHeight: 340,
              }}
            >
              {/* Grupo das LETRAS — visível de 0 a 99, blur aplicado só aqui */}
              <div
                data-testid="clarity-letters"
                aria-hidden="true"
                className="text-center pgm-mono select-none"
                style={{
                  color: "var(--pgm-grafite)",
                  filter: `blur(${blurPx.toFixed(2)}px) contrast(${contrast.toFixed(2)})`,
                  opacity: isMax ? 0 : opacity,
                  visibility: isMax ? "hidden" : "visible",
                  transition: "opacity .25s ease, filter .3s ease",
                }}
              >
                <p className="text-[3.5rem] md:text-[4rem] leading-none tracking-[0.32em] mb-5">
                  {LINES[0]}
                </p>
                <p className="text-[2.25rem] md:text-[2.75rem] leading-none tracking-[0.36em] mb-5">
                  {LINES[1]}
                </p>
                <p className="text-[1.5rem] md:text-[1.75rem] leading-none tracking-[0.4em]">
                  {LINES[2]}
                </p>
              </div>

              {/* CTA interno — só em 100, totalmente nítido, sem blur */}
              {isMax && (
                <Link
                  to={clarezaLink}
                  onClick={handleCtaClick}
                  aria-label="Agende sua consulta em Paragominas"
                  data-testid="clarity-cta"
                  className="absolute inset-0 m-6 md:m-8 flex flex-col items-center justify-center text-center rounded-sm focus:outline-none focus-visible:ring-2 group"
                  style={{
                    background: "var(--pgm-marfim)",
                    color: "var(--pgm-petroleo)",
                    minHeight: 48,
                    opacity: 0,
                    animation: "pgmClarityFade 260ms ease-out forwards",
                    // foco ciano
                    ["--tw-ring-color" as string]: "var(--pgm-ciano)",
                  }}
                >
                  <span
                    className="uppercase mb-2 md:mb-3"
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      letterSpacing: "0.32em",
                      color: "var(--pgm-petroleo)",
                    }}
                  >
                    Agende
                  </span>
                  <span
                    className="pgm-serif block leading-[0.96] tracking-[-0.01em] px-2"
                    style={{
                      fontFamily: "Fraunces, Georgia, serif",
                      color: "var(--pgm-petroleo)",
                      fontSize: "clamp(1.9rem, 6.5vw, 2.9rem)",
                      fontWeight: 500,
                      wordBreak: "keep-all",
                    }}
                  >
                    sua consulta
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-4 inline-flex items-center gap-1 transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: "var(--pgm-petroleo)" }}
                  >
                    <span
                      className="inline-block h-px"
                      style={{ width: 28, background: "var(--pgm-champagne)" }}
                    />
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
              )}

              <p
                data-testid="snellen-indicator"
                className="mt-8 text-center pgm-mono text-[10px] tracking-[0.35em] uppercase relative z-10"
                style={{ color: "rgba(11,24,26,0.5)" }}
                aria-hidden="true"
              >
                {snellen}
              </p>
            </div>

            <p className="sr-only">
              Placa simulada com linhas E F P, T O Z e L P E D.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefractionClarityExperience;
