/**
 * Conteúdo da página de Capsulotomia YAG Laser.
 *
 * O texto médico das três primeiras seções e das cinco primeiras FAQs foi
 * preservado da versão anterior da página (apenas a cidade mudou de Belém
 * para Paragominas/HGP). O conteúdo adicional — preparo, acompanhante e
 * sinais de alerta — foi revisado e aprovado pelo Dr. Juliano Machado em
 * 26/08/2026. Ver REVISAO_CLINICA em src/lib/constants.ts.
 */

export const HGP_SLUG = "hgp";

/** Fallback exibido enquanto o banco não responde (ou se a clínica sumir). */
export const HGP_FALLBACK = {
  nome: "Hospital Geral de Paragominas",
  endereco: "R. Santa Terezinha, 304 - Centro, Paragominas - PA",
  telefone: "(91) 9100-0303",
} as const;

/** Valor gravado em `local_atendimento` — mesmo formato usado pelo fluxo de
 *  agendamento principal (`clinica.nome`), para não criar um segundo padrão
 *  de texto dentro do CRM. */
export const LOCAL_ATENDIMENTO = "Hospital Geral de Paragominas";

/** Valor gravado em `tipo_atendimento`. */
export const TIPO_ATENDIMENTO = "Capsulotomia YAG Laser";

export const AVISO_CONTATO =
  "Nossa equipe entra em contato pelo WhatsApp para confirmar as datas disponíveis e a cobertura do seu convênio.";

/**
 * Valor do procedimento particular, por olho tratado.
 *
 * Fonte única: qualquer lugar que exiba preço deve importar daqui, para a
 * página nunca divergir de si mesma. Cobrança é POR OLHO — quem trata os dois
 * paga duas vezes, e isso precisa estar explícito onde o valor aparece.
 *
 * Atenção ao editar: informar o valor de forma factual é uma coisa; usar preço
 * como chamariz (promoção, desconto, comparação com outros profissionais) é
 * vedado pelo Manual de Publicidade Médica do CFM. Mantenha o tom informativo.
 */
export const VALOR_YAG = "R$ 850,00";
export const VALOR_YAG_UNIDADE = "por olho";
export const VALOR_YAG_COMPLETO = `${VALOR_YAG} ${VALOR_YAG_UNIDADE}`;

/** Exibido junto ao campo de olho operado. */
export const AVISO_POR_OLHO = `Particular: ${VALOR_YAG_COMPLETO} tratado.`;

/** Reforço quando o paciente marca os dois olhos — evita a surpresa do dobro. */
export const AVISO_AMBOS_OLHOS =
  `Você marcou os dois olhos. O valor particular é ${VALOR_YAG_COMPLETO} tratado, cobrado separadamente para cada um.`;

export const WHATSAPP_MENSAGEM =
  "Olá! Vi a página do YAG Laser e quero agendar no HGP em Paragominas.";

export const WHATSAPP_ORIGEM = "yag_hgp";

export interface YagSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const SECTIONS: YagSection[] = [
  {
    id: "o-que-e",
    title: "O que é a opacificação da cápsula posterior",
    paragraphs: [
      "Após a cirurgia de catarata, a lente intraocular é posicionada dentro de uma fina membrana chamada cápsula. Com o tempo, essa cápsula pode perder a transparência e ficar opaca — o que é chamado de opacificação da cápsula posterior, ou catarata secundária.",
      "Esse embaçamento não significa que a catarata voltou, mas sim que a membrana que sustenta a lente ficou menos transparente. O resultado é uma visão turva ou ofuscada, semelhante ao que o paciente sentia antes da cirurgia. A indicação do tratamento é feita pelo oftalmologista após exame de fundo de olho.",
    ],
  },
  {
    id: "como-funciona",
    title: "Como funciona a capsulotomia YAG",
    paragraphs: [
      "A capsulotomia YAG é um procedimento a laser que cria uma pequena abertura central na cápsula opaca, permitindo que a luz volte a passar livremente em direção à retina. Dessa forma, a nitidez visual é restaurada sem a necessidade de nova cirurgia.",
      "O procedimento é realizado com colírio anestésico e dilatação da pupila. O laser é aplicado de forma precisa e não envolve cortes ou suturas. Em geral, dura poucos minutos e o paciente pode retornar às atividades no mesmo dia ou no dia seguinte, conforme orientação médica.",
    ],
    bullets: [
      "Procedimento rápido, sem internação.",
      "Anestesia em colírio — sem agulhas ou cortes.",
      "Pupila dilatada para acesso preciso à cápsula.",
      "Alta no mesmo dia e retorno às atividades em pouco tempo.",
    ],
  },
  {
    id: "preparo",
    title: "Como se preparar para o dia",
    paragraphs: [
      "A pupila fica dilatada durante o procedimento e assim permanece por algumas horas. Por isso a visão sai embaçada e a luz incomoda mais do que o normal ao final do atendimento — planeje o dia contando com isso.",
    ],
    bullets: [
      "Venha acompanhado. Você não deve dirigir na volta.",
      "Traga documento com foto, cartão do convênio (se tiver) e a lista dos colírios e remédios que usa.",
      "Traga óculos escuros para a saída — a luz vai incomodar.",
      "Continue tomando seus remédios de uso contínuo normalmente, salvo orientação diferente do médico.",
      "Não é necessário jejum.",
    ],
  },
  {
    id: "recuperacao",
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
];

/** Sinais que merecem contato rápido — exibidos em bloco de destaque. */
export const SINAIS_ALERTA: string[] = [
  "Dor no olho que não melhora.",
  "Piora importante da visão em vez de melhora.",
  "Aumento súbito de moscas volantes ou flashes de luz.",
  "Sensação de cortina ou sombra cobrindo parte da visão.",
];

export interface YagFAQ {
  question: string;
  answer: string;
}

export const FAQS: YagFAQ[] = [
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
      "A aplicação do laser em si dura poucos minutos. Considerando a preparação com colírios e a dilatação da pupila, o tempo total de permanência é maior, mas o procedimento é considerado rápido e ambulatorial.",
  },
  {
    question: "Vou precisar repetir o laser?",
    answer:
      "Na grande maioria dos casos, não. A capsulotomia YAG abre uma janela permanente na cápsula e o efeito costuma ser duradouro. Caso haja alguma alteração posterior, o oftalmologista avaliará em consulta.",
  },
  {
    question: "Quanto custa e é coberto por convênio?",
    answer:
      "No particular, o valor é de R$ 850,00 por olho tratado — quem precisa tratar os dois olhos paga o valor de cada um separadamente. Por convênio, a cobertura depende do plano e das regras da operadora: ao preencher o formulário, nossa equipe verifica a sua cobertura antes de confirmar a data.",
  },
  {
    question: "Onde o procedimento é realizado?",
    answer:
      "No Hospital Geral de Paragominas (HGP), na R. Santa Terezinha, 304 - Centro, Paragominas - PA. O agendamento é feito mediante avaliação prévia com o Dr. Juliano Machado.",
  },
  {
    question: "Preciso levar acompanhante?",
    answer:
      "Sim, recomendamos. A pupila fica dilatada e a visão permanece embaçada por algumas horas, então você não deve dirigir na volta. Um acompanhante também ajuda a lembrar das orientações recebidas.",
  },
  {
    question: "Vou precisar ficar internado?",
    answer:
      "Não. É um procedimento ambulatorial: você chega, realiza o laser e recebe alta no mesmo dia, após o período de observação e as orientações da equipe.",
  },
  {
    question: "Quanto tempo depois da cirurgia de catarata isso pode acontecer?",
    answer:
      "Não há prazo fixo. A opacificação da cápsula posterior pode surgir meses ou anos após a cirurgia de catarata, e varia de pessoa para pessoa. O que indica a avaliação não é o tempo decorrido, mas o retorno do embaçamento.",
  },
];

export interface TimelineStep {
  titulo: string;
  duracao: string;
  descricao: string;
  sensacao: string;
}

export const TIMELINE: TimelineStep[] = [
  {
    titulo: "Chegada e acolhimento",
    duracao: "No horário combinado",
    descricao:
      "Você chega ao HGP com documento, cartão do convênio (se houver) e acompanhante. A equipe confere seus dados e prepara o atendimento.",
    sensacao: "Nada além da espera normal de uma consulta.",
  },
  {
    titulo: "Colírio anestésico e dilatação",
    duracao: "Cerca de 30 minutos",
    descricao:
      "São pingados colírios para anestesiar a superfície do olho e dilatar a pupila, abrindo o caminho até a cápsula.",
    sensacao: "Leve ardência de poucos segundos ao pingar o colírio.",
  },
  {
    titulo: "Aplicação do laser",
    duracao: "Poucos minutos",
    descricao:
      "Sentado diante do aparelho, com o queixo apoiado, o laser abre uma pequena janela no centro da cápsula opaca. Não há cortes nem agulhas.",
    sensacao: "Pequenos cliques e flashes de luz. Não dói.",
  },
  {
    titulo: "Observação e alta",
    duracao: "No mesmo dia",
    descricao:
      "Após um breve período de observação você recebe as orientações, a prescrição dos colírios e vai para casa.",
    sensacao: "Visão embaçada e sensibilidade à luz por algumas horas.",
  },
  {
    titulo: "Retorno de acompanhamento",
    duracao: "Conforme orientação",
    descricao:
      "O Dr. Juliano reavalia o olho para confirmar a evolução e ajustar o que for necessário.",
    sensacao: "Consulta comum, sem preparo especial.",
  },
];

export interface TriageQuestion {
  id: string;
  pergunta: string;
  opcoes: { valor: string; rotulo: string }[];
  /** Resposta que aponta na direção de catarata secundária. */
  positiva: string;
}

export const TRIAGEM: TriageQuestion[] = [
  {
    id: "operou",
    pergunta: "Você já operou de catarata, em um ou nos dois olhos?",
    opcoes: [
      { valor: "sim", rotulo: "Sim" },
      { valor: "nao", rotulo: "Não" },
      { valor: "nao_sei", rotulo: "Não sei" },
    ],
    positiva: "sim",
  },
  {
    id: "voltou",
    pergunta: "Depois da cirurgia, sua visão melhorou e voltou a embaçar?",
    opcoes: [
      { valor: "sim", rotulo: "Sim" },
      { valor: "nao", rotulo: "Não" },
    ],
    positiva: "sim",
  },
  {
    id: "ofuscamento",
    pergunta: "Você sente ofuscamento com luz forte, sol ou farol à noite?",
    opcoes: [
      { valor: "sim", rotulo: "Sim" },
      { valor: "nao", rotulo: "Não" },
    ],
    positiva: "sim",
  },
  {
    id: "atrapalha",
    pergunta: "Isso atrapalha ler, dirigir ou reconhecer rostos?",
    opcoes: [
      { valor: "sim", rotulo: "Sim" },
      { valor: "nao", rotulo: "Não" },
    ],
    positiva: "sim",
  },
];

export const TRIAGEM_RESSALVA =
  "Esta triagem não é um diagnóstico. Somente o exame presencial com o oftalmologista pode confirmar a causa do embaçamento.";
