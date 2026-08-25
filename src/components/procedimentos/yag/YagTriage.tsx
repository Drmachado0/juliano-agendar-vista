import { useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRIAGEM, TRIAGEM_RESSALVA } from "./yagContent";

interface YagTriageProps {
  /** Rola até o formulário de agendamento. */
  onIrParaFormulario: () => void;
}

type Respostas = Record<string, string>;

/**
 * Triagem de sintomas — orientação, não diagnóstico.
 *
 * As respostas ficam apenas no navegador: nada é enviado ao banco nem ao
 * CRM. O resultado sempre termina remetendo à avaliação presencial.
 */
const YagTriage = ({ onIrParaFormulario }: YagTriageProps) => {
  const [respostas, setRespostas] = useState<Respostas>({});

  const completo = TRIAGEM.every((q) => respostas[q.id]);

  const operou = respostas.operou;
  const sintomas = TRIAGEM.filter((q) => q.id !== "operou").filter(
    (q) => respostas[q.id] === q.positiva,
  ).length;

  let resultado:
    | { tom: "compativel" | "indefinido" | "outro"; texto: string }
    | null = null;

  if (completo) {
    if (operou === "sim" && sintomas > 0) {
      resultado = {
        tom: "compativel",
        texto:
          "Seus sintomas são compatíveis com a opacificação da cápsula posterior, que é justamente o que a capsulotomia YAG trata. O próximo passo é uma avaliação com o Dr. Juliano para confirmar e, se for o caso, agendar o procedimento.",
      };
    } else if (operou === "nao_sei") {
      resultado = {
        tom: "indefinido",
        texto:
          "Sem saber se houve cirurgia de catarata, não dá para orientar por aqui. A avaliação presencial esclarece isso rapidamente, olhando o seu olho.",
      };
    } else if (operou === "nao") {
      resultado = {
        tom: "outro",
        texto:
          "A capsulotomia YAG só é indicada para quem já operou de catarata. Um embaçamento sem cirurgia prévia tem outras causas possíveis, e merece uma consulta oftalmológica para investigar.",
      };
    } else {
      resultado = {
        tom: "indefinido",
        texto:
          "Você operou de catarata, mas não relatou os sintomas típicos da opacificação da cápsula. Isso não descarta nada — outras condições podem estar envolvidas, e a consulta define.",
      };
    }
  }

  const corResultado =
    resultado?.tom === "compativel"
      ? "border-primary/70 bg-primary/10"
      : "border-border/70 bg-secondary/30";

  return (
    <section
      aria-labelledby="triagem-titulo"
      className="card-glass rounded-2xl p-6 md:p-8"
    >
      <h2
        id="triagem-titulo"
        className="text-2xl md:text-3xl font-bold text-foreground mb-3"
      >
        Meus sintomas têm a ver com isso?
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed mb-7">
        Quatro perguntas rápidas para você se orientar. Suas respostas ficam
        apenas neste aparelho — nada é enviado para ninguém.
      </p>

      <div className="space-y-7">
        {TRIAGEM.map((q, i) => (
          <fieldset key={q.id}>
            <legend className="text-xl font-semibold text-foreground mb-3">
              <span className="text-primary mr-2">{i + 1}.</span>
              {q.pergunta}
            </legend>
            <div className="flex flex-wrap gap-3">
              {q.opcoes.map((op) => {
                const selecionado = respostas[q.id] === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    aria-pressed={selecionado}
                    onClick={() =>
                      setRespostas((prev) => ({ ...prev, [q.id]: op.valor }))
                    }
                    className={`min-h-14 min-w-28 px-6 py-3 rounded-xl border-2 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/60 ${
                      selecionado
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/40 text-foreground border-border/70 hover:border-primary/60"
                    }`}
                  >
                    {op.rotulo}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div aria-live="polite">
        {resultado && (
          <div className={`mt-8 rounded-xl border-2 p-5 md:p-6 ${corResultado}`}>
            <p className="text-lg md:text-xl text-foreground leading-relaxed">
              {resultado.texto}
            </p>

            <p className="flex items-start gap-2.5 mt-4 text-base text-muted-foreground leading-relaxed">
              <Info
                className="w-5 h-5 shrink-0 mt-0.5 text-primary"
                aria-hidden="true"
              />
              {TRIAGEM_RESSALVA}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                type="button"
                variant="hero"
                size="lg"
                onClick={onIrParaFormulario}
                className="min-h-14 text-base"
              >
                Solicitar agendamento
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setRespostas({})}
                className="min-h-14 text-base gap-2"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Refazer
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default YagTriage;
