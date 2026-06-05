import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

const data: ProcedurePageData = {
  slug: "consulta-oftalmologica",
  procedureName: "Consulta Oftalmológica",
  pageTitle: "Consulta Oftalmológica em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Consulta oftalmológica em Paragominas e Belém com o Dr. Juliano Machado. Avaliação completa da visão, exames de rotina e plano de cuidado. Agende online.",
  h1: "Consulta Oftalmológica em Paragominas e Belém",
  intro:
    "A consulta oftalmológica é a porta de entrada para cuidar da saúde dos olhos: avaliação da visão, dos olhos por dentro e por fora e definição do plano de cuidado. O Dr. Juliano Machado realiza consultas em Paragominas e Belém, com agendamento online.",
  medicalProcedureType: "https://schema.org/MedicalProcedure",
  bodyLocation: "Olho",
  sections: [
    {
      title: "O que é a consulta oftalmológica",
      paragraphs: [
        "É uma avaliação clínica completa da visão e da saúde ocular. Inclui história clínica, exame da acuidade visual, avaliação do segmento anterior do olho, medida da pressão intraocular e, quando indicado, exames complementares.",
        "É também o momento para esclarecer dúvidas sobre uso de óculos, lentes de contato, sintomas como visão embaçada, dor de cabeça, olho seco, prevenção de glaucoma, diabetes e acompanhamento de cirurgias.",
      ],
    },
    {
      title: "Como funciona a consulta",
      paragraphs: [
        "Você é recebido pela equipe, faz uma pré-avaliação e passa pela consulta com o Dr. Juliano. Os exames realizados dependem da sua queixa, idade e histórico — alguns são feitos no momento da consulta, outros podem ser agendados em separado.",
        "Ao final, o médico discute o diagnóstico, esclarece dúvidas e orienta o plano de cuidado: prescrição de óculos, uso de colírios, indicação de exames adicionais ou de procedimentos cirúrgicos, quando for o caso.",
      ],
    },
    {
      title: "O que está incluso",
      paragraphs: [
        "A consulta padrão contempla os exames básicos de rotina para a maioria dos pacientes. Casos específicos podem demandar exames adicionais, que são explicados e agendados conforme a necessidade.",
      ],
      bullets: [
        "Anamnese completa (história clínica, queixas e antecedentes).",
        "Medida da acuidade visual com e sem correção.",
        "Avaliação biomicroscópica do segmento anterior do olho.",
        "Medida da pressão intraocular (tonometria).",
        "Avaliação de fundo de olho, quando indicada.",
        "Orientação personalizada e plano de cuidado.",
      ],
    },
  ],
  faqs: [
    {
      question: "Com que frequência devo fazer uma consulta oftalmológica?",
      answer:
        "Para adultos saudáveis, a recomendação geral é uma avaliação anual ou bienal. Pessoas com diabetes, glaucoma, alta miopia ou histórico familiar de doenças oculares costumam precisar de acompanhamento mais frequente, definido caso a caso.",
    },
    {
      question: "Preciso ir com acompanhante?",
      answer:
        "Em algumas consultas é necessário dilatar a pupila para avaliação do fundo do olho — nesse caso a visão fica embaçada por algumas horas e é recomendado não dirigir. Combine com a equipe se o exame de dilatação será feito no dia.",
    },
    {
      question: "Quanto tempo dura a consulta?",
      answer:
        "Em média entre 30 e 60 minutos, dependendo dos exames realizados e da complexidade do caso. Em consultas com dilatação pupilar, o tempo total no consultório tende a ser maior.",
    },
    {
      question: "Atende convênios?",
      answer:
        "Sim. O Dr. Juliano atende particular e diversos convênios. Entre em contato para confirmar se o seu plano cobre a consulta antes de agendar.",
    },
    {
      question: "Como agendar?",
      answer:
        "O agendamento pode ser feito online por este site, em poucos minutos. Após o envio, nossa equipe entra em contato pelo WhatsApp para confirmar o horário escolhido.",
    },
  ],
};

const ConsultaOftalmologica = () => <ProcedurePageLayout data={data} />;

export default ConsultaOftalmologica;
