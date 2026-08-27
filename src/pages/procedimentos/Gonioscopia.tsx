import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * Conteudo clinico revisado e aprovado pelo Dr. Juliano Machado em 26/08/2026.
 *
 * A revisao confirmou a conduta de evitar dilatacao em olhos com angulo
 * estreito e a necessidade de repetir o exame periodicamente.
 *
 * Data e revisor saem de REVISAO_CLINICA (src/lib/constants.ts) e aparecem no
 * JSON-LD como MedicalWebPage.lastReviewed / reviewedBy, alem da linha visivel
 * ao pe da pagina. Mudou o texto clinico, atualize a data la.
 */
const data: ProcedurePageData = {
  slug: "gonioscopia",
  procedureName: "Gonioscopia",
  pageTitle: "Gonioscopia em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Gonioscopia em Paragominas e Belém com o Dr. Juliano Machado, com fellowship em Glaucoma. Define se o ângulo de drenagem é aberto ou fechado.",
  h1: "Gonioscopia em Paragominas e Belém",
  intro:
    "A gonioscopia examina o ângulo de drenagem do olho, por onde o líquido interno escoa. É ela que define se um glaucoma é de ângulo aberto ou fechado — e essa distinção muda todo o tratamento.",
  medicalProcedureType: "https://schema.org/DiagnosticProcedure",
  bodyLocation: "Ângulo iridocorneano",
  sidebarCta: {
    title: "O ângulo do seu olho é estreito?",
    text: "Só a gonioscopia responde. É a diferença entre apenas acompanhar e prevenir uma crise aguda.",
  },
  finalCta: {
    title: "A pergunta que muda a conduta",
    text: "Ângulo aberto e ângulo fechado são doenças diferentes, com tratamentos diferentes. Agende sua avaliação.",
  },
  sections: [
    {
      title: "O que a gonioscopia examina",
      paragraphs: [
        "O ângulo iridocorneano é a região onde a íris encontra a córnea, e é por ali que o líquido do olho é drenado. Essa estrutura não é visível de frente: a curvatura da própria córnea a esconde.",
        "A gonioscopia usa uma lente com espelhos que contorna esse obstáculo óptico e permite ver o ângulo diretamente. É o único exame de rotina que responde se ele está aberto, estreito ou fechado.",
      ],
      bullets: [
        "Visualiza a estrutura de drenagem do olho.",
        "Classifica o ângulo em aberto, estreito ou fechado.",
        "Nenhum outro exame de rotina dá essa resposta.",
      ],
    },
    {
      title: "Por que a resposta muda o tratamento",
      paragraphs: [
        "No glaucoma de ângulo aberto a drenagem existe, mas funciona mal. O tratamento costuma começar por colírio que reduz a pressão, e a doença é crônica e silenciosa.",
        "No ângulo estreito ou fechado o risco é outro: a drenagem pode se fechar de forma súbita, e a pressão dispara em horas. Nesse cenário existe uma conduta preventiva específica, a iridotomia a laser, que não faria sentido no ângulo aberto.",
        "Tratar sem saber qual dos dois é o caso significa escolher no escuro.",
      ],
      bullets: [
        "Ângulo aberto: conduta crônica, geralmente com colírio.",
        "Ângulo estreito: risco de crise aguda e indicação preventiva própria.",
        "A classificação orienta toda a sequência do tratamento.",
      ],
    },
    {
      title: "Como é feita",
      paragraphs: [
        "Um colírio anestésico é pingado antes, e a lente é apoiada delicadamente sobre a superfície do olho. A anestesia faz com que não haja dor — o que se sente é a presença da lente e um leve desconforto.",
        "O exame dura poucos minutos. Como o olho fica anestesiado por um curto período, a orientação é não coçar nem esfregar até a sensibilidade voltar.",
      ],
      bullets: [
        "Colírio anestésico antes do exame.",
        "Lente apoiada sobre o olho, sem dor.",
        "Poucos minutos de duração.",
        "Não esfregue o olho enquanto durar a anestesia.",
      ],
    },
  ],
  faqs: [
    {
      question: "A gonioscopia dói?",
      answer:
        "Não. O colírio anestésico é aplicado antes e elimina a dor. O que se percebe é a presença da lente sobre o olho e um leve desconforto.",
    },
    {
      question: "Por que não basta medir a pressão do olho?",
      answer:
        "Porque a pressão indica que há um problema, não qual é. Dois olhos com a mesma pressão podem ter ângulos completamente diferentes, e a conduta para cada um é outra.",
    },
    {
      question: "O exame precisa de dilatação da pupila?",
      answer:
        "Em geral não. E em olhos com ângulo estreito a dilatação é justamente o que se evita, por poder precipitar o fechamento. O que fazer em cada caso é definido na avaliação.",
    },
    {
      question: "Posso dirigir depois?",
      answer:
        "Sim, desde que não tenha havido dilatação. O colírio anestésico não embaça a visão; ele apenas reduz a sensibilidade do olho por alguns minutos.",
    },
    {
      question: "Preciso repetir a gonioscopia com o tempo?",
      answer:
        "Sim, periodicamente. O ângulo pode estreitar com o envelhecimento do cristalino, então uma classificação feita anos atrás não descreve necessariamente o olho de hoje.",
    },
    {
      question: "O convênio cobre?",
      answer:
        "A cobertura varia conforme a operadora e costuma exigir autorização prévia. Confirme antes de agendar; o atendimento particular também está disponível.",
    },
  ],
};

const Gonioscopia = () => <ProcedurePageLayout data={data} />;

export default Gonioscopia;
