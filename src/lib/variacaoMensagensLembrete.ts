/**
 * Variação automática de mensagens para Lembretes Anuais.
 *
 * Mesma estratégia usada em /admin/avaliacoes:
 * combina aleatoriamente saudações, blocos de texto, CTAs e emojis
 * para que nenhuma mensagem em massa seja igual à anterior (anti-spam WhatsApp).
 *
 * REGRAS FIXAS (nunca variam):
 * - Link de agendamento (LINK_AGENDAMENTO)
 * - Assinatura ("Atenciosamente, Dr. Juliano Machado / Oftalmologia")
 */

export const LINK_AGENDAMENTO = "https://drjulianomachado.com.br/agendar";

const SAUDACOES_LEMBRETE = [
  "Olá",
  "Oi",
  "Olá 😊",
  "Oi 👋",
  "Olá!",
  "Oi!",
  "Olá, tudo bem?",
  "Oi, tudo bem?",
  "Oi 🙂",
];

const BLOCOS_ABERTURA_LEMBRETE = [
  "Já faz cerca de 1 ano desde sua última consulta oftalmológica conosco.",
  "Notamos que sua última visita ao consultório foi há aproximadamente 1 ano.",
  "Faz quase um ano desde nosso último encontro para sua consulta oftalmológica.",
  "Passou cerca de um ano desde sua última avaliação dos olhos com a gente.",
  "Já está completando 1 ano desde sua última consulta com o Dr. Juliano.",
  "Pelo nosso registro, sua última consulta oftalmológica foi há cerca de 1 ano.",
];

const BLOCOS_IMPORTANCIA_LEMBRETE = [
  "Manter os exames em dia é fundamental para a saúde dos seus olhos.",
  "O acompanhamento anual é essencial para prevenir problemas oculares.",
  "Consultas regulares ajudam a identificar alterações precocemente.",
  "Cuidar da visão de forma preventiva faz toda a diferença a longo prazo.",
  "A revisão anual é importante para acompanhar a saúde da sua visão.",
  "Avaliações periódicas garantem mais segurança para a sua visão.",
];

const CTAS_LEMBRETE = [
  "Gostaria de agendar seu retorno?",
  "Que tal agendarmos uma nova consulta?",
  "Posso te ajudar a marcar seu retorno?",
  "Vamos agendar sua próxima avaliação?",
  "Quer aproveitar para marcar uma nova consulta?",
  "Podemos encontrar o melhor horário para você?",
];

const EMOJIS_OPCIONAIS_LEMBRETE = ["👀", "💙", "✨", "🙏", "👨‍⚕️", "❤️", ""];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Gera uma mensagem variada para lembrete anual.
 * Garante que a mensagem retornada seja diferente de `ultimaMensagem`
 * (até 10 tentativas).
 */
export function gerarMensagemVariadaLembrete(
  nome: string,
  ultimaMensagem?: string,
): string {
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || nome || "";
  let mensagem = "";
  let tentativas = 0;

  do {
    const saudacao = pick(SAUDACOES_LEMBRETE);
    const abertura = pick(BLOCOS_ABERTURA_LEMBRETE);
    const importancia = pick(BLOCOS_IMPORTANCIA_LEMBRETE);
    const cta = pick(CTAS_LEMBRETE);

    // 0-2 emojis distintos (opcional)
    const qtdEmojis = Math.floor(Math.random() * 3);
    const emojisSet = new Set<string>();
    while (emojisSet.size < qtdEmojis) {
      const e = pick(EMOJIS_OPCIONAIS_LEMBRETE);
      if (e) emojisSet.add(e);
    }
    const emojis = Array.from(emojisSet).join(" ");

    mensagem = `${saudacao}, ${primeiroNome}!${emojis ? ` ${emojis}` : ""}

${abertura} ${importancia}

${cta}
📱 Agende pelo WhatsApp ou pelo nosso site:
👉 ${LINK_AGENDAMENTO}

Atenciosamente,
Dr. Juliano Machado
Oftalmologia`;

    tentativas++;
  } while (mensagem === ultimaMensagem && tentativas < 10);

  return mensagem;
}
