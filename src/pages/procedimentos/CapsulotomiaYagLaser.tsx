import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

const data: ProcedurePageData = {
  slug: "capsulotomia-yag-laser",
  procedureName: "Capsulotomia YAG Laser",
  pageTitle: "Capsulotomia YAG Laser em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Capsulotomia YAG Laser em Paragominas e Belém com o Dr. Juliano Machado. Procedimento rápido e indolor para tratar a opacificação da cápsula posterior após cirurgia de catarata. Agende sua consulta.",
  h1: "Capsulotomia YAG Laser em Paragominas e Belém",
  intro:
    "A capsulotomia YAG é um procedimento a laser realizado no consultório para tratar a opacificação da cápsula posterior — também conhecida como catarata secundária — que pode ocorrer meses ou anos após a cirurgia de catarata. O Dr. Juliano Machado realiza esse tratamento em Paragominas e em Belém.",
  medicalProcedureType: "https://schema.org/TherapeuticProcedure",
  bodyLocation: "Olho",
  sections: [
    {
      title: "O que é a opacificação da cápsula posterior",
      paragraphs: [
        "Após a cirurgia de catarata, a lente intraocular é posicionada dentro de uma fina membrana chamada cápsula. Com o tempo, essa cápsula pode perder a transparência e ficar opaca — o que é chamado de opacificação da cápsula posterior, ou catarata secundária.",
        "Esse embaçamento não significa que a catarata voltou, mas sim que a membrana que sustenta a lente ficou menos transparente. O resultado é uma visão turva ou ofuscada, semelhante ao que o paciente sentia antes da cirurgia. A indicação do tratamento é feita pelo oftalmologista após exame de fundo de olho.",
      ],
    },
    {
      title: "Como funciona a capsulotomia YAG",
      paragraphs: [
        "A capsulotomia YAG é um procedimento a laser que cria uma pequena abertura central na cápsula opaca, permitindo que a luz volte a passar livremente em direção à retina. Dessa forma, a nitidez visual é restaurada sem a necessidade de nova cirurgia.",
        "O procedimento é realizado no consultório, com colírio anestésico e dilatação da pupila. O laser é aplicado de forma precisa e não envolve cortes ou suturas. Em geral, dura poucos minutos e o paciente pode retornar às atividades no mesmo dia ou no dia seguinte, conforme orientação médica.",
      ],
      bullets: [
        "Procedimento rápido, realizado no consultório.",
        "Anestesia em colírio — sem agulhas ou cortes.",
        "Pupila dilatada para acesso preciso à cápsula.",
        "Alta imediata e retorno às atividades em pouco tempo.",
      ],
    },
    {
      title: "Recuperação e cuidados pós-procedimento",
      paragraphs: [
        "Após a capsulotomia, é comum que a visão fique embaçada por algumas horas em razão da dilatação da pupila. O oftalmologista pode prescrever colírios antiinflamatórios ou de outras classes, conforme avaliação individual.",
        "É importante comparecer aos retornos programados para acompanhar a evolução. O paciente deve relatar ao médico a presença de moscas volantes ou flashes de luz persistentes, pois esses sintomas, embora comuns e transitórios, merecem avaliação para descartar outras alterações.",
      ],
      bullets: [
        "Visão pode ficar turva por algumas horas devido à dilatação.",
        "Uso de colírios conforme prescrição médica.",
        "Retornos programados para acompanhamento.",
        "Relatar moscas volantes ou flashes persistentes ao oftalmologista.",
      ],
    },
  ],
  faqs: [
    {
      question: "A catarata pode voltar depois da cirurgia?",
      answer:
        "O cristalino opaco removido na cirurgia não volta. O que pode ocorrer é a opacificação da cápsula posterior — a membrana que sustenta a lente intraocular —, que é tratada com a capsulotomia YAG Laser. Não se trata de uma nova catarata, mas de uma condição posterior ao implante da lente.",
    },
    {
      question: "A capsulotomia YAG dói?",
      answer:
        "Não. O procedimento é indolor. É usado apenas colírio anestésico e, em alguns casos, colírio para dilatação da pupila. O paciente pode sentir pequenos cliques ou flashes de luz durante a aplicação do laser, mas não há dor.",
    },
    {
      question: "Quanto tempo dura o procedimento?",
      answer:
        "A aplicação do laser em si dura poucos minutos. Considerando a preparação com colírios e a dilatação da pupila, o tempo total no consultório é maior, mas o procedimento é considerado rápido e ambulatorial.",
    },
    {
      question: "Vou precisar repetir o laser?",
      answer:
        "Na grande maioria dos casos, não. A capsulotomia YAG abre uma janela permanente na cápsula e o efeito costuma ser duradouro. Caso haja alguma alteração posterior, o oftalmologista avaliará em consulta.",
    },
    {
      question: "É coberto por convênio?",
      answer:
        "A cobertura depende do plano de saúde e das regras da operadora. O Dr. Juliano atende particular e diversos convênios. Recomendamos confirmar a cobertura diretamente com o seu plano ou entrar em contato com a clínica para orientação.",
    },
  ],
};

const CapsulotomiaYagLaser = () => <ProcedurePageLayout data={data} />;

export default CapsulotomiaYagLaser;
