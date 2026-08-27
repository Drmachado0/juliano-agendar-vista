import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * REVISAO MEDICA PENDENTE.
 *
 * Primeira das seis paginas de exame que a home anunciava sem destino. O texto
 * foi redigido a partir de conhecimento geral de oftalmologia e da descricao que
 * o proprio site ja usa no card ("Avaliacao completa da retina para detectar
 * problemas antes que afetem sua visao"). NAO foi escrito pelo medico.
 *
 * Revisar sobretudo: o tempo de dilatacao e de efeito do colirio, a orientacao
 * de nao dirigir, e a periodicidade sugerida para diabeticos. Sao as tres
 * afirmacoes que um paciente segue sem perguntar.
 *
 * Aprovado, atualizar REVISAO_CLINICA em src/lib/constants.ts.
 */
const data: ProcedurePageData = {
  slug: "mapeamento-de-retina",
  procedureName: "Mapeamento de Retina",
  pageTitle: "Mapeamento de Retina em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Mapeamento de retina em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253. Exame de fundo de olho para diabetes, miopia alta e sintomas de alerta.",
  h1: "Mapeamento de Retina em Paragominas e Belém",
  intro:
    "O mapeamento de retina examina o fundo do olho, incluindo a periferia — a região que nenhum outro exame de rotina alcança. É onde aparecem, ainda sem sintoma, a retinopatia diabética, as roturas que antecedem um descolamento e boa parte das degenerações periféricas.",
  medicalProcedureType: "https://schema.org/DiagnosticProcedure",
  bodyLocation: "Retina",
  sidebarCta: {
    title: "Foi pedido um mapeamento?",
    text: "Se você é diabético, tem miopia alta ou notou flashes e moscas volantes, o exame não deve esperar. Agende a avaliação.",
  },
  finalCta: {
    title: "A periferia da retina não dá sinal",
    text: "É por isso que o mapeamento existe: encontrar a alteração enquanto ela ainda é tratável. Agende online.",
  },
  sections: [
    {
      title: "O que é o mapeamento de retina",
      paragraphs: [
        "É o exame que permite ao oftalmologista ver o fundo do olho — retina, nervo óptico, vasos e mácula — com a pupila dilatada. A dilatação é o que abre o campo de visão do exame: sem ela, a periferia da retina fica inacessível, e é justamente ali que muitas alterações começam.",
        "O nome comum é mapeamento porque o médico percorre a retina em setores, região por região, em vez de olhar apenas o centro. É um exame de observação: não corta, não injeta e não usa radiação.",
      ],
    },
    {
      title: "Por que ele é pedido",
      paragraphs: [
        "A retina não dói. Uma lesão periférica pode crescer por meses sem produzir nenhum sintoma, porque não afeta a visão central — a que você usa para ler e reconhecer rostos. Quando o sintoma aparece, o quadro costuma já estar mais avançado.",
        "O mapeamento existe para inverter essa ordem: encontrar a alteração enquanto ela ainda é pequena e tratável, muitas vezes com laser em consultório, em vez de cirurgia.",
      ],
      bullets: [
        "Diabetes: rastreio de retinopatia diabética, mesmo com a visão boa.",
        "Miopia alta: risco maior de rotura e descolamento de retina.",
        "Flashes de luz ou aumento súbito de moscas volantes.",
        "Histórico familiar de descolamento ou doenças da retina.",
        "Após trauma ocular ou cirurgia intraocular.",
        "Antes de cirurgias eletivas, como a de catarata.",
      ],
    },
    {
      title: "Como o exame é feito",
      paragraphs: [
        "Primeiro vem o colírio que dilata a pupila. O efeito leva cerca de 20 a 30 minutos para se estabelecer, e esse é o tempo de espera antes do exame propriamente dito. O colírio arde levemente nos primeiros segundos — é a parte mais desconfortável de todo o procedimento.",
        "Com a pupila dilatada, o médico examina o fundo do olho usando uma lente e uma luz. A luz é forte e incomoda, mas o exame em si não dói. Costuma levar poucos minutos por olho, e pode ser pedido que você olhe para diferentes direções, para que a periferia seja percorrida por inteiro.",
      ],
      bullets: [
        "Colírio dilatador, com espera de 20 a 30 minutos.",
        "Exame do fundo de olho com lente e luz, de poucos minutos por olho.",
        "Sem cortes, sem injeção e sem radiação.",
        "Resultado conversado na própria consulta.",
      ],
    },
    {
      title: "Depois do exame",
      paragraphs: [
        "A pupila permanece dilatada por algumas horas depois que o exame termina. Nesse período a visão fica embaçada, principalmente para perto, e a luz incomoda bastante — inclusive a luz do sol na saída.",
        "Por isso a orientação é vir acompanhado e não dirigir na volta. Óculos escuros ajudam bastante. O efeito passa sozinho, sem necessidade de nenhum colírio para revertê-lo.",
      ],
      bullets: [
        "Venha acompanhado; não dirija após o exame.",
        "Traga óculos escuros para a saída.",
        "Visão embaçada para perto por algumas horas.",
        "Nenhum cuidado especial além disso.",
      ],
    },
  ],
  faqs: [
    {
      question: "O mapeamento de retina dói?",
      answer:
        "Não. O único desconforto real é o ardor leve do colírio dilatador nos primeiros segundos, e a luz forte durante o exame, que incomoda mas não machuca. Não há corte, injeção nem contato com o olho.",
    },
    {
      question: "Quanto tempo demora no total?",
      answer:
        "Conte cerca de 40 a 50 minutos entre a chegada e a saída. A maior parte é a espera do colírio fazer efeito, de 20 a 30 minutos; o exame em si leva poucos minutos por olho.",
    },
    {
      question: "Posso dirigir depois?",
      answer:
        "Não é recomendado. A pupila fica dilatada por algumas horas, a visão fica embaçada e a luz incomoda de forma significativa. Venha acompanhado e traga óculos escuros.",
    },
    {
      question: "Qual a diferença entre mapeamento de retina e retinografia?",
      answer:
        "O mapeamento é o exame em que o médico observa a retina ao vivo, incluindo a periferia, com uma lente. A retinografia é a fotografia do fundo do olho, que documenta o que foi visto e permite comparar ao longo do tempo. Os dois se complementam, e é comum que sejam pedidos juntos.",
    },
    {
      question: "Com que frequência devo repetir sendo diabético?",
      answer:
        "A orientação usual para quem tem diabetes é fazer o rastreio pelo menos uma vez por ano, mesmo com a visão boa. Havendo retinopatia já diagnosticada ou controle glicêmico instável, o intervalo é encurtado — quem define é a avaliação.",
    },
    {
      question: "Preciso de pedido médico ou autorização do convênio?",
      answer:
        "Exames de imagem costumam exigir autorização prévia da operadora, e algumas pedem também o encaminhamento. Confirme com o seu plano antes de agendar; o atendimento particular também está disponível.",
    },
  ],
};

const MapeamentoDeRetina = () => <ProcedurePageLayout data={data} />;

export default MapeamentoDeRetina;
