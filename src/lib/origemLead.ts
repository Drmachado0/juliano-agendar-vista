export type OrigemGrupo = "site" | "n8n" | "whatsapp" | "meta" | "outro";

export const getOrigemGrupo = (origem?: string | null): OrigemGrupo => {
  const o = (origem || "").toLowerCase().trim();
  if (!o) return "outro";
  if (o === "site") return "site";
  if (o === "mcp" || o.startsWith("n8n")) return "n8n";
  if (o.startsWith("whatsapp")) return "whatsapp";
  if (o === "fb" || o === "ig" || o === "facebook" || o === "instagram" || o.startsWith("meta")) return "meta";
  return "outro";
};

export const ORIGEM_LABELS: Record<OrigemGrupo, string> = {
  site: "Site",
  n8n: "n8n / Bot",
  whatsapp: "WhatsApp",
  meta: "Meta Ads",
  outro: "Outro",
};

// Variante "soft" (fundo translúcido + texto colorido) — para uso em legendas/listagens
export const ORIGEM_BADGE_SOFT_CLASSES: Record<OrigemGrupo, string> = {
  site: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  n8n: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  whatsapp: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  meta: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  outro: "bg-muted text-muted-foreground border-border",
};

// Variante "solid" (fundo cheio + texto branco) — para o chip flutuante no canto do card
export const ORIGEM_BADGE_CLASSES: Record<OrigemGrupo, string> = {
  site: "bg-sky-500 text-white",
  n8n: "bg-violet-500 text-white",
  whatsapp: "bg-emerald-500 text-white",
  meta: "bg-pink-500 text-white",
  outro: "bg-muted-foreground text-background",
};

export const ORIGEM_FILTER_OPTIONS: { value: OrigemGrupo; label: string }[] = [
  { value: "site", label: "Site" },
  { value: "n8n", label: "n8n / Bot" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta", label: "Meta Ads" },
  { value: "outro", label: "Outro" },
];
