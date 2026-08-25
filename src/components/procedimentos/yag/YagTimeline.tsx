import { useEffect, useRef, useState } from "react";
import { Play, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIMELINE } from "./yagContent";

const DURACAO_DESTAQUE_MS = 2600;

/**
 * Linha do tempo do dia do procedimento.
 *
 * Todo o conteúdo fica visível o tempo todo — nada essencial depende de
 * clique. A interação é opcional: o botão percorre as etapas em sequência
 * para dar noção de ritmo. Respeita `prefers-reduced-motion`.
 */
const YagTimeline = () => {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [rodando, setRodando] = useState(false);
  const timerRef = useRef<number | null>(null);

  const prefereMenosMovimento =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!rodando) return;

    setAtivo(0);
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      if (i >= TIMELINE.length) {
        setRodando(false);
        setAtivo(null);
        return;
      }
      setAtivo(i);
    }, DURACAO_DESTAQUE_MS);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [rodando]);

  const alternar = () => {
    if (rodando) {
      setRodando(false);
      setAtivo(null);
      return;
    }
    setRodando(true);
  };

  return (
    <section
      aria-labelledby="timeline-titulo"
      className="card-glass rounded-2xl p-6 md:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h2
            id="timeline-titulo"
            className="text-2xl md:text-3xl font-bold text-foreground mb-3"
          >
            Como é o dia do procedimento
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Da chegada à alta, sem surpresa. Tudo abaixo já está escrito — o
            botão apenas percorre as etapas na ordem, se você quiser ver o
            ritmo.
          </p>
        </div>
        {!prefereMenosMovimento && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={alternar}
            className="gap-2 shrink-0 min-h-14 text-base"
          >
            {rodando ? (
              <>
                <Square className="w-5 h-5" /> Parar
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> Ver a sequência
              </>
            )}
          </Button>
        )}
      </div>

      <ol className="relative space-y-4">
        {/* Trilho vertical */}
        <span
          aria-hidden="true"
          className="absolute left-6 top-3 bottom-3 w-0.5 bg-border/70"
        />

        {TIMELINE.map((step, i) => {
          const destacado = ativo === i;
          return (
            <li
              key={step.titulo}
              className={`relative pl-16 pr-4 py-4 rounded-xl border transition-colors duration-500 ${
                destacado
                  ? "border-primary/70 bg-primary/10"
                  : "border-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-2.5 top-4 flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold border-2 transition-colors duration-500 ${
                  destacado
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-navy-600 text-primary border-primary/50"
                }`}
              >
                {i + 1}
              </span>

              <h3 className="text-xl md:text-2xl font-bold text-foreground">
                {step.titulo}
              </h3>
              <p className="inline-flex items-center gap-1.5 text-base text-primary font-semibold mt-1 mb-2">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {step.duracao}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {step.descricao}
              </p>
              <p className="text-base text-foreground/80 mt-2">
                <span className="font-semibold text-foreground">
                  O que você sente:
                </span>{" "}
                {step.sensacao}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default YagTimeline;
