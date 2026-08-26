import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * Lista das paginas de procedimento, para uso como bloco de links internos.
 *
 * Existe porque /sobre, /belem e /paragominas eram becos: a primeira linkava
 * so para home e agendamento, a segunda para agendamento e /sobre, e a terceira
 * apenas para a home. Paginas de cidade e de autor sao justamente as que devem
 * distribuir autoridade para as paginas de servico.
 *
 * As descricoes repetem o que ja esta publicado nas paginas de destino — nao ha
 * afirmacao clinica nova aqui, entao o bloco nao reabre revisao medica.
 */

export interface AreaAtuacao {
  to: string;
  titulo: string;
  descricao: string;
}

export const AREAS_ATUACAO: readonly AreaAtuacao[] = [
  {
    to: "/procedimentos/glaucoma",
    titulo: "Glaucoma",
    descricao:
      "Diagnóstico e acompanhamento, com tonometria, gonioscopia, campo visual e OCT.",
  },
  {
    to: "/procedimentos/cirurgia-de-catarata",
    titulo: "Cirurgia de catarata",
    descricao: "Substituição do cristalino opaco por lente intraocular.",
  },
  {
    to: "/procedimentos/cirurgia-de-pterigio",
    titulo: "Cirurgia de pterígio",
    descricao: "Remoção do tecido que avança sobre a córnea.",
  },
  {
    to: "/procedimentos/capsulotomia-yag-laser",
    titulo: "Capsulotomia YAG laser",
    descricao:
      "Tratamento da opacificação da cápsula após a cirurgia de catarata.",
  },
  {
    to: "/procedimentos/consulta-oftalmologica",
    titulo: "Consulta oftalmológica",
    descricao: "Avaliação completa da saúde ocular e acompanhamento.",
  },
] as const;

interface Props {
  /** Titulo da secao. Passe null para renderizar so a lista. */
  titulo?: string | null;
  descricao?: string;
  /** id do heading, para aria-labelledby de quem envolve. */
  headingId?: string;
}

const AreasDeAtuacao = ({
  titulo = "Principais áreas de atuação",
  descricao,
  headingId = "areas-de-atuacao",
}: Props) => (
  <>
    {titulo ? (
      <h2
        id={headingId}
        className="text-xl md:text-2xl font-bold text-foreground mb-3"
      >
        {titulo}
      </h2>
    ) : null}
    {descricao ? (
      <p className="text-sm text-muted-foreground mb-6">{descricao}</p>
    ) : null}
    <ul className="space-y-3">
      {AREAS_ATUACAO.map((a) => (
        <li key={a.to}>
          <Link
            to={a.to}
            className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
            <span>
              <span className="font-semibold text-foreground block">{a.titulo}</span>
              <span className="text-sm text-muted-foreground">{a.descricao}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </>
);

export default AreasDeAtuacao;
