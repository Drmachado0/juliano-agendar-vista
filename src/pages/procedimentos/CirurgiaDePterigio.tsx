import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

const data: ProcedurePageData = {
  slug: "cirurgia-de-pterigio",
  procedureName: "Cirurgia de Pterígio",
  pageTitle: "Cirurgia de Pterígio em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Cirurgia de pterígio em Paragominas e Belém com o Dr. Juliano Machado. Avaliação, indicação e procedimento com técnica que busca reduzir a recidiva. Agende.",
  h1: "Cirurgia de Pterígio em Paragominas e Belém",
  intro:
    "O pterígio é um crescimento de tecido sobre a córnea que pode causar vermelhidão, irritação e, em alguns casos, alteração da visão. O Dr. Juliano Machado avalia a indicação cirúrgica e realiza o procedimento em Paragominas e Belém.",
  medicalProcedureType: "https://schema.org/SurgicalProcedure",
  bodyLocation: "Córnea e conjuntiva",
  sections: [
    {
      title: "O que é o pterígio",
      paragraphs: [
        "Pterígio é uma proliferação de tecido vascularizado da conjuntiva que avança sobre a córnea. É mais comum em pessoas expostas a sol, vento, poeira e ambientes secos, fatores que estimulam o crescimento da lesão.",
        "Os sintomas mais frequentes são vermelhidão, sensação de areia, ardência, ressecamento e, em casos mais avançados, alteração visual quando o tecido se aproxima do eixo visual ou induz astigmatismo.",
      ],
    },
    {
      title: "Como funciona a cirurgia",
      paragraphs: [
        "A cirurgia consiste em remover o tecido do pterígio e, em seguida, cobrir a área operada com um enxerto de conjuntiva do próprio paciente — uma técnica que tem demonstrado menores índices de recidiva quando comparada à exérese simples.",
        "O procedimento costuma ser feito em ambiente cirúrgico, com anestesia local, em regime ambulatorial. A indicação cirúrgica é individual e considera sintomas, tamanho da lesão e impacto na visão.",
      ],
      bullets: [
        "Avaliação clínica e mensuração da lesão.",
        "Remoção do pterígio com enxerto conjuntival autólogo.",
        "Procedimento ambulatorial, geralmente com anestesia local.",
        "Acompanhamento pós-operatório com retornos programados.",
      ],
    },
    {
      title: "Recuperação e pós-operatório",
      paragraphs: [
        "Nos primeiros dias é normal sentir desconforto, sensação de corpo estranho e lacrimejamento. O uso de colírios prescritos e a proteção contra sol, vento e poeira ajudam na cicatrização e reduzem o risco de retorno da lesão.",
        "Os retornos são essenciais para acompanhar a cicatrização e ajustar a medicação. O retorno às atividades é gradual e definido pelo médico conforme a evolução de cada caso.",
      ],
      bullets: [
        "Uso de colírios conforme orientação.",
        "Proteção solar com óculos UV é parte do tratamento.",
        "Evitar piscina, mar, esforço físico intenso e ambientes empoeirados nos primeiros dias.",
        "Retornos programados para avaliar a cicatrização.",
      ],
    },
  ],
  faqs: [
    {
      question: "Toda pessoa com pterígio precisa operar?",
      answer:
        "Não. Em casos leves o tratamento clínico com lubrificação ocular e proteção solar pode ser suficiente. A cirurgia é indicada quando há sintomas frequentes, crescimento progressivo ou comprometimento da visão.",
    },
    {
      question: "O pterígio pode voltar depois da cirurgia?",
      answer:
        "Sim, existe a possibilidade de recidiva. Por isso o Dr. Juliano utiliza técnicas com enxerto conjuntival, que apresentam menores taxas de retorno. Cuidados pós-operatórios e proteção solar diária também ajudam a reduzir esse risco.",
    },
    {
      question: "A cirurgia dói?",
      answer:
        "O procedimento é feito com anestesia local e, no geral, é bem tolerado. No pós-operatório imediato é comum haver desconforto, ardência e lacrimejamento por alguns dias, controlados com a medicação prescrita.",
    },
    {
      question: "Quanto tempo dura a recuperação?",
      answer:
        "A cicatrização inicial leva alguns dias, mas a estabilização completa do olho operado pode levar algumas semanas. O retorno ao trabalho e às atividades cotidianas é gradual e orientado individualmente.",
    },
    {
      question: "Posso fazer pelo convênio?",
      answer:
        "A cobertura varia conforme o plano. O Dr. Juliano atende particular e diversos convênios — entre em contato para confirmar a cobertura da consulta e do procedimento no seu plano.",
    },
  ],
};

const CirurgiaDePterigio = () => <ProcedurePageLayout data={data} />;

export default CirurgiaDePterigio;
