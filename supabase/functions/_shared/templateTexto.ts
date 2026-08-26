// ============================================================================
// templateTexto.ts
// Parte pura do renderizador de mensagens: os templates padrão, a substituição
// de variáveis e os formatadores de data/hora.
//
// Vive separado de `templateRenderer.ts` porque aquele importa o cliente do
// Supabase por URL https, o que o vitest não consegue carregar. Aqui não há
// dependência de Deno nem de rede, então o texto que o paciente recebe pode
// ser testado sem deployar. Mesmo motivo de `statusTerminais.ts`.
// ============================================================================

export interface DadosTemplate {
  nome?: string;
  data?: string;
  hora?: string;
  local?: string;
  profissional?: string;
  tipo_atendimento?: string;
  convenio?: string;
  link_status?: string;
}

// Templates padrão (fallback caso não exista no banco)
export const templatesPadrao: Record<string, string> = {
  confirmacao_agendamento: `Olá, {{nome}}! 👋

Recebemos seu pedido de agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Importante:* O atendimento será realizado por *ordem de chegada*. Recomendamos chegar com antecedência.

🔗 Acompanhe seu agendamento: {{link_status}}

Caso precise reagendar ou cancelar, entre em contato conosco.

Agradecemos a preferência! 🙏`,

  lembrete_24h: `Olá, {{nome}}! 👋

Este é um lembrete do seu agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

🔗 Detalhes do agendamento: {{link_status}}

Caso não possa comparecer, por favor nos avise.

Até amanhã! 🙏`,

  resposta_confirmacao: `Sua presença foi *confirmada* com sucesso! ✅

Aguardamos você na data e horário agendados.

Qualquer dúvida, estamos à disposição. 🙏`,

  resposta_cancelamento: `Seu agendamento foi *cancelado* conforme solicitado. ❌

Caso deseje reagendar, acesse nosso site ou entre em contato.

Obrigado! 🙏`,

  reagendamento: `Olá, {{nome}}! 👋

Sua consulta foi *reagendada* para:

📅 *Nova Data:* {{data}}
⏰ *Novo Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

🔗 Acompanhe seu agendamento: {{link_status}}

Qualquer dúvida, estamos à disposição! 🙏`,

  boas_vindas_lead: `Olá, {{nome}}! Aqui é da clínica *Dr. Juliano Machado - Oftalmologista*. 👋

Vimos seu interesse em agendar uma {{tipo_atendimento}} no local *{{local}}*.

Qual data e horário seriam melhores para você? 📅

Aguardamos seu retorno! 🙏`,

  lembrete_anual: `Olá, {{nome}}! 👋

Já faz 1 ano desde sua última consulta oftalmológica conosco.

Manter seus exames em dia é fundamental para a saúde dos seus olhos. 👀

Gostaria de agendar seu retorno? Podemos encontrar o melhor horário para você.

📱 Agende pelo WhatsApp ou pelo nosso site:
👉 https://drjulianomachado.com/agendamento

Atenciosamente,
Dr. Juliano Machado
Oftalmologia`,
};

/**
 * Substitui as variáveis do template e limpa o que sobrou.
 *
 * Duas coisas que davam problema no texto entregue ao paciente:
 *
 * 1. A substituição era feita com `String.replace`, cujo texto de reposição
 *    interpreta `$&`, `$'` e `$1`. Nome de paciente com cifrão saía corrompido.
 *    `split`/`join` trata tudo como literal.
 * 2. Ao remover a linha de uma variável não preenchida (tipicamente o link de
 *    status), as duas linhas em branco vizinhas ficavam coladas e o WhatsApp
 *    exibia um vão no meio da mensagem.
 */
export function renderizarTemplate(template: string, dados: DadosTemplate): string {
  let mensagem = template;

  const variaveis: Record<string, string | undefined> = {
    '{{nome}}': dados.nome,
    '{{data}}': dados.data,
    '{{hora}}': dados.hora,
    '{{local}}': dados.local,
    '{{profissional}}': dados.profissional,
    '{{tipo_atendimento}}': dados.tipo_atendimento,
    '{{convenio}}': dados.convenio,
    '{{link_status}}': dados.link_status,
  };

  for (const [variavel, valor] of Object.entries(variaveis)) {
    if (valor) {
      mensagem = mensagem.split(variavel).join(valor);
    }
  }

  // Remove linhas com variáveis não preenchidas e colapsa o vão que elas deixam
  const linhas = mensagem.split('\n').filter((linha) => !linha.includes('{{'));
  const limpas: string[] = [];
  for (const linha of linhas) {
    const vazia = linha.trim() === '';
    const anteriorVazia =
      limpas.length > 0 && limpas[limpas.length - 1].trim() === '';
    if (vazia && anteriorVazia) continue;
    limpas.push(linha);
  }

  return limpas.join('\n').trim();
}

// Formata data de YYYY-MM-DD para DD/MM/YYYY
export function formatarData(dataStr: string): string {
  try {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch {
    return dataStr;
  }
}

// Formata hora para HH:MM
export function formatarHora(horaStr: string): string {
  return horaStr.slice(0, 5);
}
