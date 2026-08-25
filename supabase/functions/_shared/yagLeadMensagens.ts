/**
 * Mensagens específicas dos leads de Capsulotomia YAG Laser.
 *
 * Por que existe: o lead de YAG não escolhe data no site — a secretaria entra
 * em contato depois. A mensagem genérica de boas-vindas convida o paciente a
 * "escolher uma das opções disponíveis", o que não faz sentido aqui e confunde.
 *
 * Só o YAG usa estas mensagens. Leads do funil comum continuam recebendo o
 * template `boas_vindas_lead`, que para eles é uma recuperação legítima.
 */

/**
 * Número interno da clínica para avisos de novo lead.
 * Mesmo valor de HANDOFF_NOTIFICATION_PHONE (handoff de exames) — mantido aqui
 * como constante própria para não acoplar este fluxo ao guard de exames.
 */
export const TELEFONE_NOTIFICACAO_INTERNA = "5591991300174";

/** Tipo de template no banco (`templates_whatsapp.tipo`). */
export const TEMPLATE_YAG = "boas_vindas_lead_yag";

/** True quando o lead veio do formulário de YAG Laser. */
export function ehLeadYag(tipoAtendimento?: string | null): boolean {
  return /yag|capsulotomia/i.test(tipoAtendimento ?? "");
}

/**
 * Texto usado quando o template `boas_vindas_lead_yag` ainda não existe no
 * banco. Agradece o preenchimento e avisa que a secretaria entra em contato —
 * sem link de escolha de horário e sem valor.
 */
export const BOAS_VINDAS_YAG_FALLBACK = `Olá, {{nome}}! 👋

Recebemos o seu formulário de *{{tipo_atendimento}}* no *{{local}}*. Obrigado por preencher! ✅

Nossa secretaria vai entrar em contato por aqui para verificar as *datas disponíveis* e informar os *valores*.

Você não precisa fazer mais nada agora. 🙏

_Clínica Dr. Juliano Machado — Oftalmologista_`;

export interface ResumoLeadYag {
  nome?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null; // ISO AAAA-MM-DD
  detalhe?: string | null; // "Capsulotomia YAG Laser — Olho: Direito"
  convenio?: string | null;
  local?: string | null;
  /** Falso quando a mensagem ao paciente não pôde ser entregue. */
  pacienteAvisado?: boolean;
}

/** Extrai só o olho do campo Detalhe; devolve "" se não achar. */
export function extrairOlho(detalhe?: string | null): string {
  const m = (detalhe ?? "").match(/olho\s*:\s*([^\n|—-]+)/i);
  return m ? m[1].trim() : "";
}

/**
 * Formata o telefone para leitura: (91) 99130-0174.
 *
 * O aviso interno mostra o NÚMERO, não um link wa.me — quem lê quer ver e
 * copiar o telefone, não abrir uma conversa. O WhatsApp reconhece o número
 * sozinho e o deixa tocável de qualquer forma.
 *
 * Remove o DDI 55 quando presente. Se não reconhecer o formato, devolve os
 * dígitos como estão, em vez de esconder a informação.
 */
export function formatarTelefoneBr(input?: string | null): string {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  const m11 = d.match(/^(\d{2})(\d{5})(\d{4})$/);
  if (m11) return `(${m11[1]}) ${m11[2]}-${m11[3]}`;
  const m10 = d.match(/^(\d{2})(\d{4})(\d{4})$/);
  if (m10) return `(${m10[1]}) ${m10[2]}-${m10[3]}`;
  return d;
}

/** AAAA-MM-DD → DD/MM/AAAA. Devolve a original se não bater o formato. */
export function formatarNascimento(iso?: string | null): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "").trim();
}

/**
 * Mensagem enviada ao número interno da clínica, com os dados do paciente.
 * Linhas sem valor são omitidas para o aviso não ficar poluído.
 */
export function montarResumoLeadYag(input: ResumoLeadYag): string {
  const telefone = formatarTelefoneBr(input.telefone);
  const nascimento = formatarNascimento(input.dataNascimento);
  const olho = extrairOlho(input.detalhe);

  const linhas: (string | null)[] = [
    `🔔 *NOVO LEAD — YAG LASER*`,
    ``,
    `👤 *Nome:* ${(input.nome ?? "").trim() || "Não informado"}`,
    telefone ? `📱 *WhatsApp:* ${telefone}` : null,
    nascimento ? `🎂 *Nascimento:* ${nascimento}` : null,
    olho ? `👁️ *Olho operado:* ${olho}` : null,
    input.convenio ? `💳 *Convênio:* ${input.convenio}` : null,
    input.local ? `📍 *Local:* ${input.local}` : null,
    ``,
    `A cobrança é por olho tratado. Entrar em contato para combinar data e valores.`,
  ];

  if (input.pacienteAvisado === false) {
    linhas.push(
      ``,
      `⚠️ A mensagem automática NÃO chegou ao paciente. Priorize este contato.`,
    );
  }

  return linhas.filter((l): l is string => l !== null).join("\n");
}
