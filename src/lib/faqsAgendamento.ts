// Perguntas frequentes do agendamento.
//
// Vive fora do componente porque a home marca estas MESMAS perguntas como
// FAQPage no JSON-LD (ver lib/schema.ts). Duas listas separadas viram, na
// primeira edicao, dado estruturado declarando pergunta que o paciente nao ve
// na tela — o que e violacao de diretriz, nao so inconsistencia.
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS_AGENDAMENTO: readonly FaqItem[] = [
  {
    question: "Quanto tempo leva para marcar a consulta?",
    answer:
      "Muito rápido. Em menos de 1 minuto você escolhe o horário, preenche seus dados e envia o pedido. Nossa equipe confirma em até 2 horas úteis.",
  },
  {
    question: "Como recebo a confirmação do agendamento?",
    answer:
      "Você recebe a confirmação pelo WhatsApp com a data, o local de atendimento e as orientações para o dia da consulta.",
  },
  {
    question: "Posso cancelar ou remarcar?",
    answer:
      "Sim, sem problema. Basta avisar com antecedência pelo WhatsApp ou pelo telefone da clínica. Nós ajustamos o horário para você.",
  },
];
