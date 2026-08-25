import { useId, useState } from "react";

/**
 * Demonstração de como a opacificação da cápsula posterior afeta a visão.
 *
 * IMPORTANTE — enquadramento: este bloco ilustra o SINTOMA, não resultado de
 * procedimento. O slider vai de "cápsula transparente" a "cápsula opacificada",
 * nunca de "antes do tratamento" a "depois do tratamento", e o texto de apoio
 * deixa explícito que não representa resultado. Não use imagens reais de
 * pacientes aqui nem rotule como antes/depois.
 */
const YagVisionSlider = () => {
  const [opacidade, setOpacidade] = useState(65);
  const sliderId = useId();

  const blurPx = (opacidade / 100) * 7;
  const brilho = 1 + (opacidade / 100) * 0.25;
  const contraste = 1 - (opacidade / 100) * 0.45;
  const halo = (opacidade / 100) * 0.55;

  return (
    <section
      aria-labelledby="visao-titulo"
      className="card-glass rounded-2xl p-6 md:p-8"
    >
      <h2
        id="visao-titulo"
        className="text-2xl md:text-3xl font-bold text-foreground mb-3"
      >
        Como a opacificação afeta a visão
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-6">
        Arraste a barra para ver o que a cápsula opaca faz com a luz: a imagem
        perde contraste e a luz forte passa a espalhar. É por isso que muita
        gente reclama primeiro do farol à noite.
      </p>

      <div className="relative rounded-xl overflow-hidden border border-border/50 bg-navy-700">
        <div
          className="transition-[filter] duration-150"
          style={{
            filter: `blur(${blurPx}px) brightness(${brilho}) contrast(${contraste})`,
            transform: "scale(1.04)",
          }}
        >
          <svg
            viewBox="0 0 400 220"
            className="w-full h-auto block"
            role="img"
            aria-label="Cena ilustrativa de uma rua com placa e poste de luz, usada para demonstrar perda de nitidez e ofuscamento."
          >
            <defs>
              <linearGradient id="yag-ceu" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(222 55% 18%)" />
                <stop offset="100%" stopColor="hsl(222 40% 30%)" />
              </linearGradient>
            </defs>

            <rect width="400" height="220" fill="url(#yag-ceu)" />

            {/* Chão */}
            <rect y="160" width="400" height="60" fill="hsl(222 30% 14%)" />
            <path
              d="M 0 200 L 400 200"
              stroke="hsl(40 20% 80% / 0.35)"
              strokeWidth="3"
              strokeDasharray="26 20"
            />

            {/* Poste com luz forte — fonte do ofuscamento */}
            <rect x="316" y="60" width="6" height="100" fill="hsl(222 20% 40%)" />
            <circle cx="319" cy="56" r="15" fill="hsl(48 95% 78%)" />

            {/* Placa legível — a perda de nitidez fica evidente */}
            <rect
              x="48"
              y="66"
              width="184"
              height="58"
              rx="8"
              fill="hsl(175 45% 30%)"
              stroke="hsl(40 20% 92%)"
              strokeWidth="3"
            />
            {/* textLength trava a largura independentemente da fonte do
                sistema — sem isso o texto transborda a placa. */}
            <text
              x="140"
              y="103"
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fill="hsl(40 25% 96%)"
              fontFamily="system-ui, sans-serif"
              textLength="156"
              lengthAdjust="spacingAndGlyphs"
            >
              PARAGOMINAS
            </text>
            <rect x="136" y="124" width="8" height="42" fill="hsl(222 20% 40%)" />

            {/* Árvore */}
            <rect x="266" y="128" width="8" height="34" fill="hsl(30 30% 26%)" />
            <circle cx="270" cy="122" r="24" fill="hsl(150 30% 26%)" />
          </svg>
        </div>

        {/* Halo de ofuscamento em volta da fonte de luz */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 26%, hsl(48 95% 85%) 0%, transparent 42%)",
            opacity: halo,
          }}
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor={sliderId}
          className="block text-lg font-semibold text-foreground mb-3"
        >
          Grau de opacificação da cápsula
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacidade}
          onChange={(e) => setOpacidade(Number(e.target.value))}
          aria-valuetext={`${opacidade}% de opacificação`}
          className="w-full h-3 cursor-pointer appearance-none rounded-full bg-secondary accent-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
        />
        <div className="flex justify-between text-base text-muted-foreground mt-2">
          <span>Cápsula transparente</span>
          <span>Cápsula opacificada</span>
        </div>
      </div>

      <p className="mt-5 text-base text-muted-foreground/90 leading-relaxed border-l-4 border-border pl-4">
        Ilustração esquemática, para explicar o sintoma. A intensidade varia de
        pessoa para pessoa e esta simulação não representa resultado de
        procedimento.
      </p>
    </section>
  );
};

export default YagVisionSlider;
