import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata data + hora de agendamento de forma segura.
 * Evita exibir "01/01/1970" quando o backend retorna timestamps zero/null/inválidos.
 *
 * - data: string "YYYY-MM-DD" (ou null/undefined)
 * - hora: string "HH:MM" ou "HH:MM:SS" (ou null/undefined)
 * - fallback: texto exibido quando não há data válida
 */
export function formatAppointmentDate(
  data?: string | null,
  hora?: string | null,
  fallback: string = "Sem data definida"
): string {
  if (!data) return fallback;

  const horaSafe = hora && /^\d{2}:\d{2}/.test(hora) ? hora.slice(0, 5) : null;
  const isoCandidate = `${data}T${horaSafe || "00:00"}:00`;
  const dt = new Date(isoCandidate);

  if (Number.isNaN(dt.getTime()) || dt.getFullYear() <= 1971) {
    return fallback;
  }

  const datePart = format(dt, "dd/MM/yyyy", { locale: ptBR });
  return horaSafe ? `${datePart} às ${horaSafe}` : datePart;
}

/** True quando estamos numa rota /admin/* — usado para guardar tracking de marketing. */
export function isAdminRoute(pathname: string = window.location.pathname): boolean {
  return pathname.startsWith("/admin");
}
