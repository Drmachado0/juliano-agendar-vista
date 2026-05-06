// Paleta unificada para "Local de atendimento" — usada em Kanban, Legenda e Filtros.
// Cores escolhidas para NÃO competir com bordas de urgência (verde/amarelo/vermelho).

export type LocalGrupo = "clinicor" | "hgp" | "belem" | "outro";

export const LOCAL_VALORES: Record<Exclude<LocalGrupo, "outro">, string> = {
  clinicor: "Clinicor – Paragominas",
  hgp: "Hospital Geral de Paragominas",
  belem: "Belém (IOB / Vitria)",
};

export const getLocalGrupo = (local?: string | null): LocalGrupo => {
  const l = (local || "").toLowerCase();
  if (!l) return "outro";
  if (l.includes("clinicor")) return "clinicor";
  if (l.includes("hospital geral") || l.includes("hgp")) return "hgp";
  if (l.includes("belém") || l.includes("belem") || l.includes("iob") || l.includes("vitria")) return "belem";
  return "outro";
};

export const LOCAL_SHORT_LABELS: Record<LocalGrupo, string> = {
  clinicor: "Clinicor",
  hgp: "HGP",
  belem: "Belém",
  outro: "Outro",
};

// Variante "soft" para badges (fundo translúcido + texto colorido)
export const LOCAL_BADGE_SOFT_CLASSES: Record<LocalGrupo, string> = {
  clinicor: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  hgp: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  belem: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  outro: "bg-muted text-muted-foreground border-border",
};

// Bolinhas indicadoras (para selects, listagens compactas)
export const LOCAL_DOT_CLASSES: Record<LocalGrupo, string> = {
  clinicor: "bg-teal-500",
  hgp: "bg-amber-500",
  belem: "bg-violet-500",
  outro: "bg-muted-foreground",
};

// Helper para obter classes via valor textual cru do banco
export const getLocalBadgeClasses = (local?: string | null) =>
  LOCAL_BADGE_SOFT_CLASSES[getLocalGrupo(local)];

export const getLocalDotClasses = (local?: string | null) =>
  LOCAL_DOT_CLASSES[getLocalGrupo(local)];
