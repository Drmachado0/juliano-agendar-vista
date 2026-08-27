import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * Conteudo clinico revisado e aprovado pelo Dr. Juliano Machado em 26/08/2026.
 *
 * A revisao confirmou a necessidade de suspender lente de contato antes do
 * exame e que a escolha do tipo de lente e decidida em consulta.
 *
 * Data e revisor saem de REVISAO_CLINICA (src/lib/constants.ts) e aparecem no
 * JSON-LD como MedicalWebPage.lastReviewed / reviewedBy, alem da linha visivel
 * ao pe da pagina. Mudou o texto clinico, atualize a data la.
 */
const data: ProcedurePageData = {
  slug: "biometria-ultrassonica",
  procedureName: "Biometria Ultrassônica",
  pageTitle: "Biometria Ultrassônica em Paragominas | Dr. Juliano Machado",
  metaDescription:
    "Biometria ultrassônica em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253. Exame que calcula o grau da lente intraocular da cirurgia de catarata.",
  h1: "Biometria Ultrassônica em Paragominas e Belém",
  intro:
    "A biometria mede o olho por dentro para calcular o grau da lente que será implantada na cirurgia de catarata. É o exame que determina como você vai enxergar depois de operar — e por isso ele é feito antes, nunca depois.",
  medicalProcedureType: "https://schema.org/DiagnosticProcedure",
  bodyLocation: "Olho",
  sidebarCta: {
    title: "Vai operar catarata?",
    text: "A biometria é o exame que define o grau da lente. Ele precisa acontecer antes de qualquer agendamento cirúrgico.",
  },
  finalCta: {
    title: "O grau da lente se decide aqui",
    text: "Medida errada significa resultado visual errado — e a lente já estará dentro do olho. Agende sua avaliação.",
  },
  sections: [
    {
      title: "O que a biometria mede",
      paragraphs: [
        "Ela mede as dimensões internas do olho: o comprimento entre a córnea e a retina, a curvatura da córnea e a profundidade da câmara anterior. São esses números que alimentam o cálculo da lente intraocular.",
        "Na cirurgia de catarata o cristalino opaco é removido e substituído por uma lente artificial. Essa lente tem grau, como um óculos — e o grau certo depende inteiramente das medidas do seu olho, que são individuais.",
      ],
      bullets: [
        "Comprimento axial do olho.",
        "Curvatura da córnea.",
        "Profundidade da câmara anterior.",
        "Dados que entram no cálculo da lente.",
      ],
    },
    {
      title: "Por que a precisão importa tanto",
      paragraphs: [
        "Óculos podem ser trocados; a lente intraocular, não. Ela é implantada para permanecer. Um erro de cálculo se traduz em grau residual depois da cirurgia — o paciente enxerga, mas não como poderia.",
        "É por isso que a biometria é conferida ou repetida quando algum valor destoa, e por que ela nunca é feita às pressas.",
      ],
      bullets: [
        "A lente implantada é permanente.",
        "Erro de medida vira grau residual.",
        "Valores que destoam são conferidos antes da cirurgia.",
      ],
    },
    {
      title: "Como é feita",
      paragraphs: [
        "Na técnica ultrassônica, um colírio anestésico é aplicado e uma sonda encosta suavemente na superfície do olho para emitir o ultrassom. Não dói, graças à anestesia, e dura poucos minutos por olho.",
        "Como o olho fica anestesiado por um curto período, a orientação é não coçar nem esfregar até a sensibilidade voltar. Não havendo dilatação, não há restrição para dirigir.",
      ],
      bullets: [
        "Colírio anestésico antes do exame.",
        "Sonda encostada suavemente no olho.",
        "Poucos minutos por olho.",
        "Não esfregue o olho enquanto durar a anestesia.",
      ],
    },
  ],
  faqs: [
    {
      question: "A biometria dói?",
      answer:
        "Não. O colírio anestésico é aplicado antes, e o contato da sonda com a superfície do olho não é doloroso.",
    },
    {
      question: "Por que preciso desse exame antes da cirurgia?",
      answer:
        "Porque é ele que define o grau da lente que será implantada. Sem as medidas do seu olho não há como calcular, e a lente é permanente.",
    },
    {
      question: "O exame também decide o tipo de lente?",
      answer:
        "Ele fornece as medidas. A escolha entre monofocal, tórica ou multifocal envolve também o seu astigmatismo, a saúde da retina e a sua rotina — é uma decisão conversada na consulta.",
    },
    {
      question: "Preciso suspender a lente de contato antes?",
      answer:
        "Sim, costuma ser necessário. A lente de contato altera temporariamente a curvatura da córnea e distorce a medida. A equipe informa por quantos dias no seu caso.",
    },
    {
      question: "Posso dirigir depois?",
      answer:
        "Se não houve dilatação da pupila, sim. O colírio anestésico não embaça a visão.",
    },
    {
      question: "O convênio cobre?",
      answer:
        "Sendo exame pré-operatório, costuma entrar junto com a autorização da cirurgia, e a operadora analisa o conjunto. Confirme antes de agendar.",
    },
  ],
};

const BiometriaUltrassonica = () => <ProcedurePageLayout data={data} />;

export default BiometriaUltrassonica;
