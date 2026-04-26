/**
 * Debug helper para validar eventos do dataLayer no navegador.
 *
 * Ativação: adicione `?debug_dl=1` à URL (ex.: /agendamento?debug_dl=1).
 *
 * O helper:
 *  - Intercepta window.dataLayer.push
 *  - Loga TODO push no console com prefixo [DL]
 *  - Quando vê event:'meta_lead', valida o payload contra o esperado
 *    e loga ✅ ou ❌ no console com diff dos campos divergentes.
 */

declare global {
  interface Window {
    dataLayer?: any[];
    __dlDebugInstalled?: boolean;
  }
}

const EXPECTED_META_LEAD = {
  event: 'meta_lead',
  form_name: 'agendamento',
  content_name: 'Formulário Agendamento Iniciado',
  content_category: 'Consulta Oftalmológica',
  value: 300,
  currency: 'BRL',
};

function diffPayload(actual: Record<string, any>, expected: Record<string, any>) {
  const diffs: Array<{ key: string; expected: any; actual: any }> = [];
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      diffs.push({ key, expected: expected[key], actual: actual[key] });
    }
  }
  return diffs;
}

export function installDataLayerDebug() {
  if (typeof window === 'undefined') return;
  if (window.__dlDebugInstalled) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('debug_dl') !== '1') return;

  window.dataLayer = window.dataLayer || [];
  const originalPush = window.dataLayer.push.bind(window.dataLayer);

  window.dataLayer.push = ((...args: any[]) => {
    for (const entry of args) {
      // eslint-disable-next-line no-console
      console.log('[DL] push:', entry);

      if (entry && typeof entry === 'object' && entry.event === 'meta_lead') {
        const diffs = diffPayload(entry, EXPECTED_META_LEAD);
        if (diffs.length === 0) {
          // eslint-disable-next-line no-console
          console.log(
            '%c[DL] ✅ meta_lead OK — payload bate com o esperado',
            'color: #16a34a; font-weight: bold;',
            entry
          );
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            '%c[DL] ❌ meta_lead DIVERGENTE',
            'color: #dc2626; font-weight: bold;',
            { recebido: entry, esperado: EXPECTED_META_LEAD, diffs }
          );
        }
      }
    }
    return originalPush(...args);
  }) as typeof window.dataLayer.push;

  window.__dlDebugInstalled = true;
  // eslint-disable-next-line no-console
  console.log(
    '%c[DL] Debug do dataLayer ATIVO — aguardando eventos…',
    'color: #2563eb; font-weight: bold;'
  );
}
