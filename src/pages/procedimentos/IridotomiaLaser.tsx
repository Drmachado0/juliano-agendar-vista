import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * Conteudo clinico revisado e aprovado pelo Dr. Juliano Machado em 26/08/2026.
 *
 * A revisao cobriu especialmente a secao de crise aguda, que e orientacao de
 * urgencia, e a indicacao frequente nos dois olhos.
 *
 * Data e revisor saem de REVISAO_CLINICA (src/lib/constants.ts) e aparecem no
 * JSON-LD como MedicalWebPage.lastReviewed / reviewedBy, alem da linha visivel
 * ao pe da pagina. Mudou o texto clinico, atualize a data la.
 */
const data: ProcedurePageData = {
  slug: "iridotomia-a-laser",
  procedureName: "Iridotomia a Laser",
  pageTitle: "Iridotomia a Laser em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Iridotomia a laser em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253, com fellowship em Glaucoma. Procedimento preventivo para ângulo estreito.",
  h1: "Iridotomia a Laser em Paragominas e Belém",
  intro:
    "A iridotomia a laser cria uma pequena abertura na íris que restabelece o fluxo do líquido dentro do olho. É um procedimento preventivo: existe para que a crise de glaucoma agudo não aconteça, e não para tratá-la depois que aconteceu.",
  medicalProcedureType: "https://schema.org/TherapeuticProcedure",
  bodyLocation: "Íris",
  sidebarCta: {
    title: "Seu ângulo foi classificado como estreito?",
    text: "A iridotomia é feita no consultório, em minutos, e reduz o risco de uma crise que pode custar visão permanente.",
  },
  finalCta: {
    title: "Prevenir custa minutos; a crise custa visão",
    text: "Em olhos de risco identificados a tempo, a iridotomia muda o desfecho. Agende sua avaliação.",
  },
  sections: [
    {
      title: "O problema que ela resolve",
      paragraphs: [
        "Em alguns olhos, a distância entre a íris e a córnea é anatomicamente pequena. O líquido produzido atrás da íris tem dificuldade para passar à frente, a íris é empurrada e o ângulo de drenagem se estreita ainda mais.",
        "Quando esse ângulo se fecha de forma súbita, a pressão intraocular sobe rapidamente e surge o quadro agudo: dor intensa, vermelhidão, visão embaçada, halos ao redor de luzes e náusea. É emergência oftalmológica e exige atendimento imediato.",
        "A iridotomia interrompe esse mecanismo antes que ele se complete.",
      ],
      bullets: [
        "Indicada em ângulo estreito ou fechado, identificado na gonioscopia.",
        "Preventiva: atua antes da crise.",
        "Reduz o risco de fechamento agudo do ângulo.",
      ],
    },
    {
      title: "Como funciona",
      paragraphs: [
        "O laser cria uma abertura muito pequena na periferia da íris. Por ela o líquido passa diretamente de trás para a frente, sem forçar a passagem estreita — a íris relaxa e o ângulo se abre.",
        "A abertura fica na periferia, coberta pela pálpebra superior. Não é percebida no espelho e não interfere na visão.",
      ],
      bullets: [
        "Abertura periférica, feita a laser.",
        "Restabelece o fluxo do líquido intraocular.",
        "Não é visível e não altera a aparência do olho.",
      ],
    },
    {
      title: "Como é o procedimento",
      paragraphs: [
        "É feito no consultório, sem internação. Colírios são usados antes: um para contrair a pupila e um anestésico. Você fica sentado diante do aparelho, com uma lente apoiada no olho, e o laser é aplicado em alguns disparos.",
        "Dura poucos minutos por olho. A sensação relatada é de um clique ou leve pontada a cada disparo, tolerável e breve.",
        "Depois, a visão pode ficar embaçada por algumas horas e é comum sentir o olho irritado. Colírios anti-inflamatórios costumam ser prescritos, e um retorno é agendado para conferir a abertura e medir a pressão.",
      ],
      bullets: [
        "No consultório, sem internação.",
        "Poucos minutos por olho.",
        "Visão embaçada por algumas horas — venha acompanhado.",
        "Retorno programado para conferir a abertura e a pressão.",
      ],
    },
  ],
  faqs: [
    {
      question: "A iridotomia dói?",
      answer:
        "Não de forma significativa. Um colírio anestésico é usado antes, e a sensação relatada a cada disparo é de um clique ou leve pontada, que passa imediatamente.",
    },
    {
      question: "Preciso ficar internado?",
      answer:
        "Não. O procedimento é feito no consultório e você vai para casa em seguida.",
    },
    {
      question: "Posso dirigir depois?",
      answer:
        "Não é recomendado. A visão pode ficar embaçada por algumas horas e os colírios usados afetam a pupila. Venha acompanhado.",
    },
    {
      question: "A abertura fica visível no olho?",
      answer:
        "Não. Ela é muito pequena e feita na periferia da íris, região coberta pela pálpebra superior.",
    },
    {
      question: "A iridotomia cura o glaucoma?",
      answer:
        "Não. Ela previne o fechamento agudo do ângulo. Havendo glaucoma já instalado, o acompanhamento e o tratamento da pressão continuam normalmente.",
    },
    {
      question: "Preciso fazer nos dois olhos?",
      answer:
        "Com frequência sim. O ângulo estreito costuma ser característica dos dois olhos, e o olho ainda não tratado permanece em risco. A indicação é definida na avaliação.",
    },
  ],
};

const IridotomiaLaser = () => <ProcedurePageLayout data={data} />;

export default IridotomiaLaser;
