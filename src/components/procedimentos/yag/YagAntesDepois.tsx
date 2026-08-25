/**
 * Comparação didática: cápsula opacificada x cápsula aberta pelo laser.
 *
 * Ilustração ORIGINAL. Foi desenhada a partir de referências de
 * retroiluminação apenas para acertar a anatomia — nenhuma imagem de terceiro
 * foi copiada, e nenhuma foto de paciente é usada aqui.
 *
 * Enquadramento: mostra o que acontece na CÁPSULA, estrutura tratada. Não é
 * promessa de resultado individual e a legenda diz que é ilustração. Se um dia
 * entrarem fotos reais de paciente, elas exigem consentimento e não podem
 * permitir identificação.
 */

interface OlhoProps {
  /** true = depois do laser (janela central aberta). */
  aberto: boolean;
  id: string;
}

const OlhoRetroiluminado = ({ aberto, id }: OlhoProps) => (
  <svg
    viewBox="0 0 200 200"
    className="w-full h-auto block"
    role="img"
    aria-label={
      aberto
        ? "Ilustração do olho após o laser: janela central aberta na cápsula, com o reflexo do fundo do olho passando livremente."
        : "Ilustração do olho com a cápsula posterior opacificada, bloqueando o reflexo do fundo do olho."
    }
  >
    <defs>
      {/* Íris — mesma nos dois lados, para a comparação ser honesta */}
      <radialGradient id={`${id}-iris`} cx="50%" cy="50%" r="50%">
        <stop offset="55%" stopColor="hsl(24 55% 26%)" />
        <stop offset="78%" stopColor="hsl(22 48% 38%)" />
        <stop offset="100%" stopColor="hsl(20 40% 22%)" />
      </radialGradient>

      {/* Reflexo do fundo do olho (vermelho-alaranjado) */}
      <radialGradient id={`${id}-reflexo`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="hsl(8 62% 46%)" />
        <stop offset="70%" stopColor="hsl(6 55% 34%)" />
        <stop offset="100%" stopColor="hsl(6 45% 22%)" />
      </radialGradient>

      {/* Textura fibrótica da cápsula opaca */}
      <filter id={`${id}-fibrose`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.045"
          numOctaves="4"
          seed={aberto ? 7 : 3}
          result="ruido"
        />
        <feColorMatrix
          in="ruido"
          type="matrix"
          values="0 0 0 0 0.85
                  0 0 0 0 0.85
                  0 0 0 0 0.82
                  0 0 0 1.1 -0.25"
        />
      </filter>

      {/* Máscara: opacificação some no centro depois do laser */}
      <mask id={`${id}-mascara`}>
        <circle cx="100" cy="100" r="66" fill="white" />
        {aberto && <circle cx="100" cy="98" r="42" fill="black" />}
      </mask>
    </defs>

    <rect width="200" height="200" fill="hsl(222 40% 8%)" />

    {/* Íris */}
    <circle cx="100" cy="100" r="96" fill={`url(#${id}-iris)`} />

    {/* Pupila com o reflexo do fundo do olho */}
    <circle cx="100" cy="100" r="66" fill={`url(#${id}-reflexo)`} />

    {/* Cápsula opacificada — cobre tudo antes, só a periferia depois */}
    <g mask={`url(#${id}-mascara)`}>
      <circle
        cx="100"
        cy="100"
        r="66"
        filter={`url(#${id}-fibrose)`}
        opacity={aberto ? 0.55 : 0.82}
      />
      {/* Pregas da cápsula */}
      <g
        fill="none"
        stroke="hsl(40 20% 88%)"
        strokeLinecap="round"
        opacity={aberto ? 0.3 : 0.55}
      >
        <path d="M 58 78 Q 96 66 140 84" strokeWidth="2.5" />
        <path d="M 52 108 Q 100 96 148 116" strokeWidth="2" />
        <path d="M 62 132 Q 100 124 142 140" strokeWidth="1.6" />
      </g>
    </g>

    {/* Borda da abertura feita pelo laser */}
    {aberto && (
      <circle
        cx="100"
        cy="98"
        r="42"
        fill="none"
        stroke="hsl(40 25% 92%)"
        strokeWidth="1.6"
        opacity="0.5"
      />
    )}

    {/* Feixe da lâmpada de fenda, como nas retroiluminações */}
    <g opacity="0.55">
      <rect
        x="28"
        y="16"
        width="13"
        height="168"
        fill="hsl(200 30% 92%)"
        opacity="0.35"
      />
      <ellipse
        cx="76"
        cy="72"
        rx="9"
        ry="13"
        fill="hsl(200 25% 96%)"
        opacity="0.7"
      />
    </g>

    {/* Limbo */}
    <circle
      cx="100"
      cy="100"
      r="96"
      fill="none"
      stroke="hsl(222 30% 12%)"
      strokeWidth="7"
    />
  </svg>
);

const COMPARACAO = [
  {
    aberto: false,
    id: "antes",
    titulo: "Antes",
    texto: "Cápsula posterior opacificada, bloqueando a passagem da luz.",
  },
  {
    aberto: true,
    id: "depois",
    titulo: "Depois do laser",
    texto: "Janela central aberta: a luz volta a chegar à retina.",
  },
];

const YagAntesDepois = () => (
  <section
    aria-labelledby="antes-depois-titulo"
    className="card-glass rounded-2xl p-6 md:p-8"
  >
    <h2
      id="antes-depois-titulo"
      className="text-2xl md:text-3xl font-bold text-foreground mb-3"
    >
      O que o laser faz na cápsula
    </h2>
    <p className="text-lg text-muted-foreground leading-relaxed mb-7">
      É assim que o oftalmologista enxerga a cápsula no exame. À esquerda, a
      membrana opaca barrando a luz. À direita, a pequena janela aberta no
      centro — a lente que você recebeu na cirurgia continua no lugar.
    </p>

    <div className="grid sm:grid-cols-2 gap-5">
      {COMPARACAO.map((item) => (
        <figure key={item.id} className="m-0">
          <div
            className={`rounded-xl overflow-hidden border-2 ${
              item.aberto ? "border-primary/50" : "border-border/60"
            }`}
          >
            <OlhoRetroiluminado aberto={item.aberto} id={item.id} />
          </div>
          <figcaption className="mt-3">
            <span
              className={`block text-lg font-bold ${
                item.aberto ? "text-primary" : "text-foreground"
              }`}
            >
              {item.titulo}
            </span>
            <span className="block text-base text-muted-foreground leading-relaxed">
              {item.texto}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>

    <p className="mt-6 text-base text-muted-foreground/90 leading-relaxed border-l-4 border-border pl-4">
      Ilustração esquemática, com fins didáticos. Não é foto de paciente e não
      representa resultado individual — cada caso é avaliado em consulta.
    </p>
  </section>
);

export default YagAntesDepois;
