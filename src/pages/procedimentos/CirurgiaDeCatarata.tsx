import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

const data: ProcedurePageData = {
  slug: "cirurgia-de-catarata",
  procedureName: "Cirurgia de Catarata",
  pageTitle: "Cirurgia de Catarata em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Cirurgia de catarata em Paragominas e Belém com o Dr. Juliano Machado. Avaliação, planejamento e procedimento com lente intraocular. Agende sua consulta.",
  h1: "Cirurgia de Catarata em Paragominas e Belém",
  intro:
    "A cirurgia de catarata é o tratamento que substitui o cristalino opaco do olho por uma lente intraocular transparente. O Dr. Juliano Machado realiza a avaliação, o planejamento e o procedimento em Paragominas e em Belém, com acompanhamento pré e pós-operatório.",
  medicalProcedureType: "https://schema.org/SurgicalProcedure",
  bodyLocation: "Cristalino",
  sections: [
    {
      title: "O que é a catarata",
      paragraphs: [
        "A catarata é a opacificação do cristalino, a lente natural que fica dentro do olho. Com o tempo essa lente fica menos transparente, o que reduz a nitidez, altera a percepção de cores e aumenta o ofuscamento por luzes.",
        "É uma condição muito associada ao envelhecimento, mas também pode aparecer por uso prolongado de medicamentos, trauma, doenças como diabetes ou de forma congênita. O diagnóstico é feito em consulta oftalmológica com exames de rotina.",
      ],
    },
    {
      title: "Como funciona a cirurgia",
      paragraphs: [
        "O procedimento mais utilizado hoje é a facoemulsificação: através de uma microincisão, o cristalino opaco é fragmentado por ultrassom e substituído por uma lente intraocular calculada especificamente para o seu olho.",
        "A cirurgia é realizada em ambiente hospitalar, em geral com anestesia local em forma de colírio e sedação leve, e costuma durar poucos minutos por olho. O tipo de lente intraocular (monofocal, tórica ou de foco estendido) é definido em conjunto com o paciente, conforme exames e expectativas.",
      ],
      bullets: [
        "Avaliação clínica e exames pré-operatórios (biometria, mapeamento de retina e outros).",
        "Escolha da lente intraocular com base nos exames e no estilo de vida.",
        "Procedimento ambulatorial com alta no mesmo dia.",
        "Retornos programados para acompanhamento do pós-operatório.",
      ],
    },
    {
      title: "Recuperação e pós-operatório",
      paragraphs: [
        "Na maioria dos casos o paciente retorna para casa no mesmo dia, com orientações de uso de colírios e cuidados básicos como evitar esforço físico, coçar o olho ou expor a água e poeira nos primeiros dias.",
        "Os retornos com o oftalmologista são fundamentais para acompanhar a cicatrização, ajustar a prescrição visual quando necessário e identificar precocemente qualquer alteração. O tempo de recuperação varia entre as pessoas e será detalhado em consulta.",
      ],
      bullets: [
        "Uso de colírios conforme prescrição médica.",
        "Evitar esforço, coçar os olhos e ambientes empoeirados nos primeiros dias.",
        "Retornos programados para avaliação da cicatrização.",
        "Óculos para leitura ou distância podem ser indicados após a estabilização.",
      ],
    },
  ],
  faqs: [
    {
      question: "Quem precisa fazer a cirurgia de catarata?",
      answer:
        "A indicação é feita pelo oftalmologista após avaliação clínica e exames. Em geral, considera-se a cirurgia quando a catarata começa a comprometer a visão e a qualidade de vida — leitura, direção, trabalho ou atividades do dia a dia.",
    },
    {
      question: "A cirurgia é feita nos dois olhos no mesmo dia?",
      answer:
        "Não. Quando ambos os olhos têm catarata, a cirurgia costuma ser feita em dias diferentes, respeitando um intervalo definido pelo médico para acompanhar a recuperação do primeiro olho antes de operar o segundo.",
    },
    {
      question: "Vou precisar usar óculos depois da cirurgia?",
      answer:
        "Depende do tipo de lente intraocular escolhida e das características do seu olho. Algumas lentes reduzem bastante a dependência de óculos, outras corrigem só uma distância. Essa escolha é discutida em consulta com base nos exames.",
    },
    {
      question: "Quanto tempo dura a cirurgia?",
      answer:
        "A parte cirúrgica em si costuma durar poucos minutos por olho. Considerando preparo, anestesia e recuperação imediata, o tempo total no centro cirúrgico é maior. Você receberá todas as orientações antes do procedimento.",
    },
    {
      question: "A cirurgia de catarata é coberta por convênios?",
      answer:
        "A cobertura depende do plano de saúde. O Dr. Juliano atende particular e diversos convênios. Entre em contato para confirmar se o seu convênio cobre a consulta e o procedimento.",
    },
  ],
};

const CirurgiaDeCatarata = () => <ProcedurePageLayout data={data} />;

export default CirurgiaDeCatarata;
