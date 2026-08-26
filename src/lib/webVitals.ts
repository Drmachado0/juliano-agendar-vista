import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { safeDataLayerPush } from "@/lib/trackingGuard";

/**
 * Coleta de Core Web Vitals reais (RUM) e envio ao GA4 via dataLayer.
 *
 * Por que existe: o CrUX nao tem dados para este dominio — o volume de trafego
 * fica abaixo do limiar de elegibilidade do relatorio publico. Sem isso, a
 * unica medida disponivel e a simulacao de laboratorio do PageSpeed, que NAO
 * mede INP: o Lighthouse nao tem interacao real para medir.
 *
 * Este modulo fecha essa lacuna medindo no navegador de pacientes de verdade,
 * inclusive INP. Passa por safeDataLayerPush, entao respeita o consentimento
 * LGPD como o resto do tracking do site.
 *
 * Para ler no GA4: criar dimensoes personalizadas para metric_name e
 * metric_rating, e uma metrica personalizada para metric_value.
 */

/** CLS e adimensional e pequeno; as demais sao milissegundos. */
function normalizar(metric: Metric): number {
  return metric.name === "CLS"
    ? Math.round(metric.value * 10000) / 10000
    : Math.round(metric.value);
}

function reportar(metric: Metric) {
  safeDataLayerPush({
    event: "web_vitals",
    metric_name: metric.name,
    metric_value: normalizar(metric),
    // "good" | "needs-improvement" | "poor", conforme os limiares oficiais.
    metric_rating: metric.rating,
    // Identifica a medicao; permite deduplicar quando a metrica e reenviada.
    metric_id: metric.id,
    metric_navigation_type: metric.navigationType,
  });
}

/**
 * Registra os observadores. Chamar uma vez, no bootstrap.
 *
 * Cada callback dispara quando a metrica se torna final — LCP e INP so fecham
 * quando a pagina perde visibilidade, entao nao espere eventos imediatos.
 */
export function installWebVitals(): void {
  if (typeof window === "undefined") return;
  onCLS(reportar);
  onINP(reportar);
  onLCP(reportar);
  onFCP(reportar);
  onTTFB(reportar);
}
