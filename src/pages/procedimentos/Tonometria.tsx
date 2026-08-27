import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * Conteudo clinico revisado e aprovado pelo Dr. Juliano Machado em 26/08/2026.
 *
 * A revisao confirmou a faixa de referencia citada (ate cerca de 21 mmHg,
 * como referencia estatistica, nao limite individual) e a ausencia de
 * restricao para dirigir apos o exame.
 *
 * Data e revisor saem de REVISAO_CLINICA (src/lib/constants.ts) e aparecem no
 * JSON-LD como MedicalWebPage.lastReviewed / reviewedBy, alem da linha visivel
 * ao pe da pagina. Mudou o texto clinico, atualize a data la.
 */
const data: ProcedurePageData = {
  slug: "tonometria",
  procedureName: "Tonometria",
  pageTitle: "Tonometria em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Tonometria em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253. Medida da pressão intraocular, exame básico no rastreio do glaucoma.",
  h1: "Tonometria em Paragominas e Belém",
  intro:
    "A tonometria mede a pressão dentro do olho. É rápida, indolor e faz parte de praticamente toda consulta de rotina — mas o número que ela produz precisa ser lido junto com os outros exames, nunca sozinho.",
  medicalProcedureType: "https://schema.org/DiagnosticProcedure",
  bodyLocation: "Olho",
  sidebarCta: {
    title: "Quando você mediu sua pressão ocular?",
    text: "Pressão alta no olho não dá sintoma. O exame leva segundos e é o primeiro passo do rastreio do glaucoma.",
  },
  finalCta: {
    title: "Um número que só faz sentido em conjunto",
    text: "A tonometria abre a investigação do glaucoma; a gonioscopia, o campo visual e o OCT a completam. Agende sua avaliação.",
  },
  sections: [
    {
      title: "O que a tonometria mede",
      paragraphs: [
        "O olho é preenchido por um líquido que é produzido e drenado continuamente. Quando a drenagem não acompanha a produção, a pressão interna sobe. A tonometria mede essa pressão, em milímetros de mercúrio.",
        "A pressão elevada é o principal fator de risco do glaucoma sobre o qual o tratamento consegue agir — não dá para mudar a idade nem o histórico familiar, mas dá para baixar a pressão. Por isso a medida entra na rotina.",
      ],
      bullets: [
        "Medida da pressão intraocular, feita nos dois olhos.",
        "Dura segundos e não exige preparo.",
        "Repetida a cada consulta de acompanhamento.",
      ],
    },
    {
      title: "Por que o número sozinho não fecha diagnóstico",
      paragraphs: [
        "Existe glaucoma com pressão dentro da faixa considerada normal, e existe pressão acima da média sem nenhum dano ao nervo óptico. Tratar apenas o número levaria a medicar quem não precisa e a liberar quem precisa.",
        "A tonometria abre a investigação; quem a fecha é o conjunto — o aspecto do nervo óptico, a anatomia da drenagem vista na gonioscopia, o campo visual e o OCT.",
      ],
      bullets: [
        "Pressão normal não exclui glaucoma.",
        "Pressão alta isolada não confirma glaucoma.",
        "O diagnóstico se constrói cruzando exames.",
      ],
    },
    {
      title: "Como é feita",
      paragraphs: [
        "Há mais de uma técnica. Em algumas, um colírio anestésico é pingado antes e um pequeno sensor toca levemente a superfície do olho. Em outras, um jato de ar faz a medida sem contato nenhum. Nos dois casos o exame dura segundos e não dói.",
        "Havendo colírio anestésico, a dormência passa em poucos minutos. Não há necessidade de acompanhante nem restrição para dirigir depois — diferente dos exames que exigem dilatação da pupila.",
      ],
      bullets: [
        "Pode usar colírio anestésico, conforme a técnica.",
        "Sem dilatação da pupila.",
        "Sem restrição para dirigir depois.",
        "Nenhum preparo prévio necessário.",
      ],
    },
  ],
  faqs: [
    {
      question: "A tonometria dói?",
      answer:
        "Não. Com o jato de ar não há contato com o olho; com o sensor de contato, um colírio anestésico é usado antes. O que se sente é um toque leve ou um sopro rápido.",
    },
    {
      question: "Preciso de acompanhante ou fico impedido de dirigir?",
      answer:
        "Não. Diferente dos exames que exigem dilatação da pupila, a tonometria não altera a visão. Você pode dirigir normalmente em seguida.",
    },
    {
      question: "Qual é a pressão considerada normal?",
      answer:
        "A faixa de referência mais usada vai até cerca de 21 mmHg, mas ela é uma referência estatística, não um limite individual. O que importa é a pressão que o seu nervo óptico tolera, e isso varia de pessoa para pessoa.",
    },
    {
      question: "Pressão normal significa que não tenho glaucoma?",
      answer:
        "Não. Existe o glaucoma de pressão normal, em que o dano ao nervo ocorre com a pressão dentro da faixa esperada. É uma das razões pelas quais o diagnóstico não se apoia apenas neste exame.",
    },
    {
      question: "Com que frequência devo medir?",
      answer:
        "Na rotina, a cada consulta oftalmológica. Em acompanhamento de glaucoma o intervalo é definido individualmente, conforme o estágio da doença e a estabilidade do quadro.",
    },
    {
      question: "Preciso suspender meu colírio antes do exame?",
      answer:
        "Não por conta própria. Se você usa colírio para glaucoma, mantenha o horário normal e informe a equipe — a medida sob tratamento é justamente o dado que interessa acompanhar.",
    },
  ],
};

const Tonometria = () => <ProcedurePageLayout data={data} />;

export default Tonometria;
