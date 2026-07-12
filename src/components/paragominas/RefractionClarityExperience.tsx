import { useRef, useState } from "react";

interface Props {
  onFirstInteract?: () => void;
}

const LINES = ["E F P", "T O Z", "L P E D"];

/**
 * Seção-assinatura da landing /paragominas.
 * - Slider controla nitidez de uma "tabela de Snellen" simulada em HTML.
 * - blur ~7px → 0px, contraste crescente. Anel/lente CSS acompanha.
 * - Sem coleta de dados; tracking opcional dispara UMA vez.
 * - reduced-motion desliga transições.
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
  const contrast = 0.55 + (value / 100) * 0.55; // 0.55 → 1.10
  const opacity = 0.55 + (value / 100) * 0.45;

  return (
    <section
      aria-labelledby="clareza-heading"
      className="relative py-20 md:py-28"
      style={{
        background: "#F3F1EC",
        color: "#12181E",
      }}
    >
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-neutral-500 mb-4">
              Refração
            </p>
            <h2
              id="clareza-heading"
              className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] tracking-tight mb-5"
              style={{ fontFamily: "Fraunces, Georgia, serif" }}
            >
              Da visão embaçada <br />
              <span className="italic">à clareza.</span>
            </h2>
            <p className="text-base md:text-lg text-neutral-700 leading-relaxed max-w-md mb-8">
              A refração ajuda a encontrar a correção que oferece melhor nitidez para cada pessoa.
            </p>

            <div className="space-y-4 max-w-md">
              <label htmlFor="clarity-slider" className="block text-sm font-medium text-neutral-800">
                Ajustar nitidez da demonstração
              </label>
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
                className="w-full accent-[#0F766E] h-2 cursor-pointer"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => bump(-10)}
                  className="min-h-[44px] px-4 rounded-full border border-neutral-300 text-sm font-medium text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
                >
                  Mais embaçado
                </button>
                <button
                  type="button"
                  onClick={() => bump(10)}
                  className="min-h-[44px] px-4 rounded-full bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0B5E58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/50"
                >
                  Mais nítido
                </button>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Demonstração visual ilustrativa. Não substitui avaliação oftalmológica.
              </p>
            </div>
          </div>

          {/* Placa Snellen simulada + anel de lente */}
          <div className="relative order-first lg:order-last">
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div
                className="rounded-full border border-[#0F766E]/25 motion-reduce:transition-none"
                style={{
                  width: `${180 + value * 2.2}px`,
                  height: `${180 + value * 2.2}px`,
                  boxShadow: `0 0 ${40 + value * 0.8}px hsl(180 60% 40% / ${0.05 + value / 400})`,
                  transition: "width .35s ease, height .35s ease, box-shadow .35s ease",
                }}
              />
            </div>

            <div
              className="relative mx-auto max-w-md bg-white rounded-sm px-8 py-10 md:px-12 md:py-14 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] border border-neutral-200 motion-reduce:transition-none"
              style={{
                filter: `blur(${blurPx.toFixed(2)}px) contrast(${contrast.toFixed(2)})`,
                opacity,
                transition: "filter .3s ease, opacity .3s ease",
              }}
            >
              <div className="text-center font-mono select-none" aria-hidden="true">
                <p className="text-[3.25rem] leading-none tracking-[0.3em] mb-4 text-neutral-900">
                  {LINES[0]}
                </p>
                <p className="text-[2.25rem] leading-none tracking-[0.35em] mb-4 text-neutral-900">
                  {LINES[1]}
                </p>
                <p className="text-[1.5rem] leading-none tracking-[0.4em] text-neutral-900">
                  {LINES[2]}
                </p>
              </div>
            </div>
            <p className="sr-only">
              Tabela simulada com as linhas E F P, T O Z e L P E D. Nível atual de nitidez: {value} de 100.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RefractionClarityExperience;
