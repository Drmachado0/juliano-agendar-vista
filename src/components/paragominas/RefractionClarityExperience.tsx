import { useRef, useState } from "react";

interface Props {
  onFirstInteract?: () => void;
}

const LINES = ["E F P", "T O Z", "L P E D"];

/**
 * Seção-assinatura da /paragominas — versão premium.
 * Paleta: petróleo #082E33 / marfim #F3F0E8 / ciano #41D8CE (apenas interação).
 * O slider revela a "nitidez" (blur 7px → 0) sobre uma placa de Snellen simulada.
 */
const RefractionClarityExperience = ({ onFirstInteract }: Props) => {
  const [value, setValue] = useState(35);
  const firedRef = useRef(false);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFirstInteract?.();
  };

  const bump = (delta: number) => {
    setValue((v) => Math.min(100, Math.max(0, v + delta)));
    fire();
  };

  const blurPx = ((100 - value) / 100) * 7;
  const contrast = 0.55 + (value / 100) * 0.55;
  const opacity = 0.55 + (value / 100) * 0.45;

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
        {/* Título editorial acima da grade */}
        <header className="mb-16 md:mb-20 max-w-3xl">
          <div className="flex items-center gap-4 mb-6">
            <span className="pgm-eyebrow" style={{ color: "var(--pgm-champagne)" }}>
              Refração
            </span>
            <div className="pgm-rule-dark flex-1 max-w-[220px]" />
          </div>
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
            <p className="text-base md:text-lg leading-relaxed mb-10" style={{ color: "rgba(243,240,232,0.78)" }}>
              A refração é o ponto de encontro entre a sua percepção e a lente correta.
              Deslize para atravessar o que muitos vivem todos os dias.
            </p>

            <div className="space-y-6">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="clarity-slider"
                  className="pgm-eyebrow"
                  style={{ color: "var(--pgm-champagne)" }}
                >
                  Ajustar nitidez da demonstração
                </label>
                <span
                  className="pgm-mono text-sm tabular-nums"
                  style={{ color: "var(--pgm-ciano)" }}
                  aria-hidden="true"
                >
                  {String(value).padStart(3, "0")}
                </span>
              </div>

              <input
                id="clarity-slider"
                type="range"
                min={0}
                max={100}
                value={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                onChange={(e) => {
                  setValue(Number(e.target.value));
                  fire();
                }}
                className="pgm-range"
              />

              <div className="flex items-center gap-3 pt-2">
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

              <div className="pgm-rule-dark mt-6" />
              <p className="text-xs leading-relaxed" style={{ color: "rgba(243,240,232,0.55)" }}>
                Demonstração visual ilustrativa. Não substitui avaliação oftalmológica.
              </p>
            </div>
          </div>

          {/* Coluna direita — placa Snellen editorial */}
          <div className="order-1 lg:order-2 relative">
            {/* Filetes de referência (moldura editorial) */}
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

            {/* Placa em marfim */}
            <div
              className="relative mx-auto max-w-md px-10 py-14 md:px-14 md:py-20"
              style={{
                background: "var(--pgm-marfim)",
                filter: `blur(${blurPx.toFixed(2)}px) contrast(${contrast.toFixed(2)})`,
                opacity,
                transition: "filter .3s ease, opacity .3s ease",
              }}
            >
              <div className="text-center pgm-mono select-none" aria-hidden="true" style={{ color: "var(--pgm-grafite)" }}>
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
              <p
                className="mt-8 text-center pgm-mono text-[10px] tracking-[0.35em] uppercase"
                style={{ color: "rgba(11,24,26,0.5)" }}
                aria-hidden="true"
              >
                20 / {Math.max(15, Math.round(200 - value * 1.7))}
              </p>
            </div>

            {/* Ponto de foco ciano — só aparece com nitidez próxima do máximo */}
            <div
              aria-hidden="true"
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pgm-mono text-[10px] tracking-[0.3em] uppercase"
              style={{
                color: "var(--pgm-ciano)",
                opacity: value > 75 ? 1 : 0,
                transition: "opacity .35s ease",
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--pgm-ciano)" }} />
              Foco
            </div>

            <p className="sr-only">
              Placa simulada com linhas E F P, T O Z e L P E D. Nível atual de nitidez: {value} de 100.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefractionClarityExperience;
