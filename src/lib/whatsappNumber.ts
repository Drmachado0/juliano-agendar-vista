// Helpers para formatação do número de WhatsApp da clínica.
// O número é dinâmico (lido de site_config), mas mantemos uma constante
// de fallback para uso enquanto o fetch inicial não retornou e para SSR/SEO.

export const DEFAULT_WHATSAPP_RAW = "5591936180476";

const DEFAULT_TEXT =
  "Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.";

/** Retorna apenas dígitos do número (ex: "5591980690617"). */
export function normalizeWhatsApp(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/**
 * Chave canônica de identidade de um telefone BR: DDD (2 dígitos) + 8 dígitos finais.
 * Remove o DDI 55 quando presente e ignora o 9º dígito volátil de celular,
 * de modo que "(91) 98888-7777" e "(91) 8888-7777" geram a MESMA chave,
 * mas DDDs diferentes (91 vs 11) geram chaves distintas.
 * Retorna "" quando não há dígitos suficientes para identificar com segurança.
 */
export function chaveTelefone(raw: string): string {
  let d = normalizeWhatsApp(raw);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2); // remove DDI
  if (d.length < 10) return "";
  const ddd = d.slice(0, 2);
  const last8 = d.slice(-8);
  return ddd + last8;
}

/** True se dois números representam o mesmo contato (compara a chave canônica). */
export function mesmoTelefone(a: string, b: string): boolean {
  const ka = chaveTelefone(a);
  const kb = chaveTelefone(b);
  return ka !== "" && ka === kb;
}

/**
 * Formata para exibição "(91) 98069-0617" assumindo número BR com DDI 55.
 * Aceita também sem DDI. Retorna string original se não bater o padrão.
 */
export function formatWhatsAppDisplay(raw: string): string {
  const digits = normalizeWhatsApp(raw);
  // 55 + DDD(2) + 9XXXX-XXXX => 13 dígitos
  const m13 = digits.match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (m13) return `(${m13[1]}) ${m13[2]}-${m13[3]}`;
  // DDD(2) + 9XXXX-XXXX => 11 dígitos
  const m11 = digits.match(/^(\d{2})(\d{5})(\d{4})$/);
  if (m11) return `(${m11[1]}) ${m11[2]}-${m11[3]}`;
  return raw;
}

/** Monta link wa.me com mensagem opcional já encodada. */
export function buildWaLink(raw: string, message?: string): string {
  const digits = normalizeWhatsApp(raw) || DEFAULT_WHATSAPP_RAW;
  const text = encodeURIComponent(message ?? DEFAULT_TEXT);
  return `https://wa.me/${digits}?text=${text}`;
}

/** Monta link wa.me sem texto. */
export function buildWaLinkBare(raw: string): string {
  const digits = normalizeWhatsApp(raw) || DEFAULT_WHATSAPP_RAW;
  return `https://wa.me/${digits}`;
}

/** tel:+55... */
export function buildTelLink(raw: string): string {
  const digits = normalizeWhatsApp(raw) || DEFAULT_WHATSAPP_RAW;
  return `tel:+${digits}`;
}
