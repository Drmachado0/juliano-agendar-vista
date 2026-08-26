import ProcedurePageLayout, { type ProcedurePageData } from "@/components/procedimentos/ProcedurePageLayout";

/**
 * REVISAO MEDICA PENDENTE.
 *
 * Todo o texto clinico desta pagina foi redigido a partir de conhecimento geral
 * de oftalmologia e dos servicos que o site ja declara oferecer (tonometria,
 * gonioscopia, campo visual, OCT e iridotomia a laser). NAO foi escrito nem
 * revisado pelo Dr. Juliano Machado.
 *
 * Conteudo medico e YMYL: antes de manter esta pagina indexavel, o medico
 * responsavel precisa revisar especialmente a secao de sinais de alerta do
 * glaucoma agudo e as faixas de acompanhamento citadas nas FAQs.
 */
const data: ProcedurePageData = {
  slug: "glaucoma",
  procedureName: "Tratamento de Glaucoma",
  pageTitle: "Glaucoma em Paragominas e Belém | Dr. Juliano Machado",
  metaDescription:
    "Diagnóstico e acompanhamento de glaucoma em Paragominas e Belém com o Dr. Juliano Machado, CRM-PA 15253, com fellowship em Glaucoma. Tonometria, gonioscopia, campo visual e OCT.",
  h1: "Glaucoma em Paragominas e Belém",
  intro:
    "O glaucoma é a principal causa de cegueira irreversível no mundo — e costuma avançar sem dor e sem sintoma até estágios avançados. O Dr. Juliano Machado tem fellowship em Glaucoma pela Unidade Paulista de Oftalmologia e realiza a investigação completa, do exame de pressão ao campo visual, em Paragominas e Belém.",
  sidebarCta: {
    title: "Tem histórico de glaucoma na família?",
    text: "Esse é o fator de risco mais forte da doença — e o glaucoma não dói nem embaça no início. A investigação é o único jeito de saber.",
  },
  finalCta: {
    title: "A visão perdida para o glaucoma não volta",
    text: "O que o tratamento faz é interromper a progressão. Por isso o exame precoce muda o resultado. Agende online.",
  },
  medicalProcedureType: "https://schema.org/TherapeuticProcedure",
  bodyLocation: "Nervo óptico",
  sections: [
    {
      title: "O que é o glaucoma",
      paragraphs: [
        "Glaucoma é um conjunto de doenças que danificam progressivamente o nervo óptico — a estrutura que leva a informação visual do olho até o cérebro. Na maioria dos casos o dano está associado à pressão intraocular elevada, resultado de um desequilíbrio entre a produção e a drenagem do líquido que circula dentro do olho.",
        "O ponto que mais surpreende o paciente é este: a visão perdida para o glaucoma não volta. O tratamento não recupera o campo visual já comprometido — ele existe para interromper a progressão e preservar o que ainda está preservado. Por isso o diagnóstico precoce muda o desfecho de forma decisiva.",
      ],
    },
    {
      title: "Por que o glaucoma passa despercebido",
      paragraphs: [
        "A forma mais comum, o glaucoma de ângulo aberto, não dói e não embaça a visão central no início. A perda começa pela visão periférica, e o cérebro compensa a falha usando as informações do outro olho e o movimento natural dos olhos. O paciente pode ter perdido uma parcela significativa do campo visual sem notar nada.",
        "Quando o sintoma finalmente aparece — esbarrar em objetos, dificuldade em ambientes escuros, sensação de estar olhando por um tubo —, o dano costuma já estar avançado. É exatamente por isso que o exame de rotina tem peso maior no glaucoma do que em quase qualquer outra doença ocular.",
      ],
      bullets: [
        "Idade acima de 40 anos.",
        "Histórico de glaucoma na família — o fator de risco mais forte.",
        "Pressão intraocular elevada em exames anteriores.",
        "Miopia alta ou hipermetropia alta, dependendo do tipo de glaucoma.",
        "Diabetes e uso prolongado de corticoide.",
        "Trauma ocular prévio ou cirurgia ocular anterior.",
      ],
    },
    {
      title: "Os exames que fecham o diagnóstico",
      paragraphs: [
        "Medir a pressão do olho não basta. Existe glaucoma com pressão dentro da faixa considerada normal, e existe pressão alta sem glaucoma. O diagnóstico se constrói cruzando a pressão com o aspecto do nervo óptico, a anatomia da drenagem e a medida objetiva da função visual.",
        "A investigação completa combina exames que o consultório já realiza, e cada um responde a uma pergunta diferente sobre o mesmo olho.",
      ],
      bullets: [
        "Tonometria: mede a pressão intraocular.",
        "Gonioscopia: examina a drenagem interna e define se o ângulo é aberto ou fechado.",
        "Campo visual: mapeia objetivamente a visão periférica e detecta falhas que o paciente ainda não percebe.",
        "OCT: mede a espessura das fibras nervosas da retina e flagra perda estrutural antes da perda funcional.",
        "Retinografia e mapeamento de retina: documentam o nervo óptico para comparação ao longo do tempo.",
      ],
    },
    {
      title: "Glaucoma de ângulo fechado: quando é urgência",
      paragraphs: [
        "Em alguns olhos, a drenagem é anatomicamente estreita. Quando esse ângulo se fecha de forma súbita, a pressão intraocular sobe rapidamente e surge o quadro agudo — dor ocular intensa, vermelhidão, visão embaçada, halos coloridos ao redor de luzes, dor de cabeça e, com frequência, náusea e vômito.",
        "O glaucoma agudo é emergência oftalmológica: quanto mais tempo a pressão permanece elevada, maior o dano permanente ao nervo óptico. Diante desses sinais, procure atendimento imediatamente — não espere a consulta agendada.",
        "Em olhos identificados como de risco antes da crise, a iridotomia a laser cria uma pequena abertura na íris que restabelece o fluxo do líquido e reduz a chance de o ângulo fechar. É um procedimento preventivo, indolor e realizado no consultório.",
      ],
      bullets: [
        "Dor ocular intensa e súbita.",
        "Vermelhidão acentuada com visão embaçada.",
        "Halos coloridos ao redor de luzes.",
        "Dor de cabeça com náusea ou vômito.",
      ],
    },
    {
      title: "Tratamento e acompanhamento",
      paragraphs: [
        "O objetivo do tratamento é reduzir a pressão intraocular até um patamar em que a progressão pare. O primeiro passo costuma ser o colírio de uso contínuo. Quando o controle não é suficiente, ou quando há intolerância à medicação, entram as opções a laser e cirúrgicas — sempre com indicação individual, definida a partir do tipo de glaucoma, do estágio e da resposta de cada paciente.",
        "Glaucoma é doença crônica: o acompanhamento não termina quando a pressão normaliza. Os exames são repetidos ao longo do tempo justamente para comparar e identificar progressão cedo. A adesão ao colírio e a regularidade dos retornos pesam tanto quanto a escolha do tratamento.",
      ],
      bullets: [
        "Colírios de uso contínuo, no horário prescrito, sem interrupção por conta própria.",
        "Procedimentos a laser quando indicados.",
        "Cirurgia nos casos em que as demais opções não alcançam a meta de pressão.",
        "Retornos e exames repetidos para comparação ao longo do tempo.",
      ],
    },
  ],
  faqs: [
    {
      question: "Glaucoma tem cura?",
      answer:
        "Não. O glaucoma é controlável, não curável. O tratamento reduz a pressão intraocular e interrompe a progressão do dano, mas a visão já perdida não é recuperada. Por isso o diagnóstico precoce é o fator que mais influencia o resultado a longo prazo.",
    },
    {
      question: "A partir de que idade devo investigar glaucoma?",
      answer:
        "Sem fatores de risco, a orientação usual é iniciar a avaliação por volta dos 40 anos. Com histórico de glaucoma na família, a investigação deve começar antes e ser repetida com mais frequência — parentes de primeiro grau de pacientes com glaucoma têm risco significativamente maior.",
    },
    {
      question: "Se minha pressão ocular está normal, posso ter glaucoma?",
      answer:
        "Sim. Existe o glaucoma de pressão normal, em que o nervo óptico é danificado mesmo com a pressão dentro da faixa esperada. É uma das razões pelas quais o diagnóstico não se apoia apenas na tonometria: o campo visual e o OCT avaliam o nervo diretamente.",
    },
    {
      question: "O colírio pode ser interrompido quando a pressão normalizar?",
      answer:
        "Não por conta própria. A pressão está controlada justamente porque o colírio está sendo usado — suspender costuma fazê-la subir novamente, e a progressão volta a acontecer em silêncio. Qualquer mudança no tratamento deve ser decidida em consulta.",
    },
    {
      question: "De quanto em quanto tempo preciso repetir os exames?",
      answer:
        "Depende do estágio da doença e da estabilidade do quadro. Casos estáveis costumam ser reavaliados uma a duas vezes por ano; casos em progressão ou recém-diagnosticados exigem intervalos mais curtos. O intervalo é definido individualmente na consulta.",
    },
    {
      question: "O convênio cobre a investigação de glaucoma?",
      answer:
        "A cobertura varia conforme o plano e o exame solicitado. Entre em contato antes de agendar para confirmar o que o seu convênio cobre; o consultório também atende em regime particular.",
    },
  ],
};

const Glaucoma = () => <ProcedurePageLayout data={data} />;

export default Glaucoma;
