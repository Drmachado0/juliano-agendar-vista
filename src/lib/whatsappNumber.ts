// Helpers para formatação do número de WhatsApp da clínica.
// O número é dinâmico (lido de site_config), mas mantemos uma constante
// de fallback para uso enquanto o fetch inicial não retornou e para SSR/SEO.

export const DEFAULT_WHATSAPP_RAW = "5591980690617";

const DEFAULT_TEXT =
  "Olá! Gostaria de agendar uma consulta oftalmológica com o Dr. Juliano Machado.";

/** Retorna apenas dígitos do número (ex: "5591980690617"). */
export function normalizeWhatsApp(raw: string): string {
  return (raw || "").replace(/\D/g, "");
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
