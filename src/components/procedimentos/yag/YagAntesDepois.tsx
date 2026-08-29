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

import { OlhoRetroiluminado } from "@/components/OlhoRetroiluminado";

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
