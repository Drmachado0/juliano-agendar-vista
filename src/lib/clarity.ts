/**
 * Microsoft Clarity — carregamento condicionado ao consentimento LGPD.
 *
 * Deixe `CLARITY_PROJECT_ID` vazio para desativar por completo. Quando
 * preenchido, o script padrão do Clarity é injetado apenas se o usuário
 * consentiu com cookies de analytics no banner atual.
 *
 * O ID definitivo será fornecido depois — não injete nada enquanto vazio.
 */
export const CLARITY_PROJECT_ID = "xoueyofk7d";

let loaded = false;

export function loadClarity(): void {
  if (typeof window === "undefined") return;
  if (!CLARITY_PROJECT_ID) return;
  if (loaded) return;
  loaded = true;

  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function (...args: any[]) {
      (c[a].q = c[a].q || []).push(args);
    };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y?.parentNode?.insertBefore(t, y);
  })(window as any, document, "clarity", "script", CLARITY_PROJECT_ID);
}
