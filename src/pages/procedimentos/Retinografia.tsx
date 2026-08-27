import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * Conteudo clinico revisado e aprovado pelo Dr. Juliano Machado em 26/08/2026.
 *
 * A revisao confirmou a necessidade de dilatacao na maioria dos casos e a
 * orientacao de nao dirigir depois.
 *
 * Data e revisor saem de REVISAO_CLINICA (src/lib/constants.ts) e aparecem no
 * JSON-LD como MedicalWebPage.lastReviewed / reviewedBy, alem da linha visivel
 * ao pe da pagina. Mudou o texto clinico, atualize a data la.
 */
const data: ProcedurePageData = {
  slug: "retinografia",
  procedureName: "Retinografia",
  pageTitle: "Retinografia em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Retinografia em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253. Fotografia do fundo do olho para acompanhar diabetes, glaucoma e doenças da retina.",
  h1: "Retinografia em Paragominas e Belém",
  intro:
    "A retinografia é a fotografia do fundo do olho. Ela não substitui o exame do médico — ela o documenta, criando o registro que permite comparar o seu olho de hoje com o de um ano atrás e enxergar o que mudou.",
  medicalProcedureType: "https://schema.org/DiagnosticProcedure",
  bodyLocation: "Retina",
  sidebarCta: {
    title: "Foi pedida uma retinografia?",
    text: "O valor dela aparece na comparação ao longo do tempo. Quanto antes existir o primeiro registro, mais cedo a mudança fica visível.",
  },
  finalCta: {
    title: "Uma foto de hoje é a referência de amanhã",
    text: "Doenças da retina evoluem devagar. Sem registro, a mudança passa despercebida. Agende sua avaliação.",
  },
  sections: [
    {
      title: "O que é a retinografia",
      paragraphs: [
        "É um exame de imagem que fotografa a retina, o nervo óptico e os vasos do fundo do olho. O equipamento é uma câmera especializada: você apoia o queixo, olha para um ponto de luz e a foto é feita em instantes.",
        "Diferente do mapeamento de retina, em que o médico observa ao vivo e percorre a periferia com uma lente, a retinografia produz um documento. É esse registro que torna possível comparar exames feitos com meses ou anos de diferença.",
      ],
      bullets: [
        "Fotografia colorida do fundo do olho.",
        "Registro permanente e comparável ao longo do tempo.",
        "Sem contato com o olho e sem radiação.",
      ],
    },
    {
      title: "Para que ela serve",
      paragraphs: [
        "A principal utilidade é o acompanhamento. Em doenças que evoluem devagar — retinopatia diabética, glaucoma, degeneração macular — a pergunta clínica raramente é apenas como está hoje, e sim se mudou em relação à última vez. Sem imagem anterior, essa pergunta não tem resposta objetiva.",
        "A foto também serve para mostrar ao paciente o que o médico está vendo. Explicar uma alteração apontando para a imagem costuma comunicar melhor que qualquer descrição.",
      ],
      bullets: [
        "Acompanhamento de retinopatia diabética.",
        "Documentação do nervo óptico no glaucoma.",
        "Comparação de lesões e degenerações ao longo do tempo.",
        "Registro de antes e depois de tratamentos.",
      ],
    },
    {
      title: "Como é feita e o que esperar",
      paragraphs: [
        "Na maioria dos casos é usado colírio para dilatar a pupila, porque a imagem fica mais ampla e nítida. Havendo dilatação, valem os mesmos cuidados de qualquer exame dilatado: visão embaçada por algumas horas e desconforto com a luz.",
        "O flash da câmera é forte e deixa um pós-imagem por alguns segundos, como o flash de uma foto comum. É passageiro e não causa dano.",
      ],
      bullets: [
        "Pode exigir dilatação da pupila.",
        "Flash forte, com pós-imagem de poucos segundos.",
        "Exame rápido, de poucos minutos.",
        "Havendo dilatação: não dirija e traga óculos escuros.",
      ],
    },
  ],
  faqs: [
    {
      question: "A retinografia dói?",
      answer:
        "Não. Não há contato com o olho. O incômodo se resume ao flash, que é forte e deixa um pós-imagem por alguns segundos, e ao colírio dilatador quando ele é usado.",
    },
    {
      question: "Preciso dilatar a pupila?",
      answer:
        "Na maior parte dos casos sim, porque a imagem fica mais ampla e nítida. Havendo dilatação, a visão fica embaçada por algumas horas e você não deve dirigir na volta.",
    },
    {
      question: "Qual a diferença para o mapeamento de retina?",
      answer:
        "O mapeamento é a observação ao vivo, feita pelo médico com uma lente, e alcança a periferia da retina. A retinografia é a fotografia, que documenta e permite comparar ao longo do tempo. Um não substitui o outro, e é comum que sejam pedidos juntos.",
    },
    {
      question: "Com que frequência devo repetir?",
      answer:
        "Depende da condição em acompanhamento e da estabilidade do quadro. Em situações estáveis costuma ser anual, e o intervalo encurta quando há sinal de progressão. Quem define é a avaliação.",
    },
    {
      question: "O resultado sai na hora?",
      answer:
        "Sim. A imagem fica disponível imediatamente e é analisada na própria consulta.",
    },
    {
      question: "O convênio cobre?",
      answer:
        "Exames de imagem costumam exigir autorização prévia da operadora. Confirme antes de agendar; o atendimento particular também está disponível.",
    },
  ],
};

const Retinografia = () => <ProcedurePageLayout data={data} />;

export default Retinografia;
