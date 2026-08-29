/**
 * Ilustracao esquematica do que o laser faz na capsula posterior.
 *
 * ORIGINAL. Desenhada a partir de referencias de retroiluminacao apenas para
 * acertar a anatomia. Nenhuma imagem de terceiro foi copiada e NENHUMA FOTO DE
 * PACIENTE e usada aqui.
 *
 * Mostra o que acontece na CAPSULA, a estrutura tratada. Nao e promessa de
 * resultado individual, e quem a usa deve dizer na legenda que e ilustracao.
 *
 * POR QUE VIVE SOZINHA NESTE ARQUIVO, desde 29/08/2026: ela nasceu dentro de
 * components/procedimentos/yag/YagAntesDepois.tsx, usada so na pagina da
 * capsulotomia. Quando as fotos de antes e depois sairam da home, por decisao
 * do medico e pela Resolucao CFM 1.974/2011, a home passou a usar esta mesma
 * ilustracao. Importar de dentro de uma pasta de pagina de procedimento seria
 * dependencia de baixo para cima. Aqui os dois consumidores ficam no mesmo
 * nivel.
 */

interface OlhoProps {
  /** true = depois do laser (janela central aberta). */
  aberto: boolean;
  id: string;
}

/**
 * Exportada desde 29/08/2026 para a home usar a mesma ilustracao.
 *
 * A secao de YAG na home mostrava DUAS FOTOS de um caso real, retroiluminacao
 * do mesmo olho antes e depois do laser, sob o titulo "Antes e depois". Isso
 * esbarra na Resolucao CFM 1.974/2011 e no Codigo de Etica Medica, e foi
 * removido por decisao do medico. Em vez de inventar uma segunda ilustracao,
 * a home passou a usar esta, que ja existia e ja nasceu conforme.
 */
export const OlhoRetroiluminado = ({ aberto, id }: OlhoProps) => (
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

