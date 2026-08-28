/**
 * Entry de servidor para gerar HTML estatico das rotas publicas no build.
 *
 * POR QUE EXISTE: o site e uma SPA e servia a mesma casca vazia nas 18 rotas.
 * scripts/og-por-rota.mjs ja resolveu o <head>, mas o <body> continuava vazio
 * ate o JavaScript montar, entao crawler de IA sem execucao de JS nao tinha o
 * que citar. Isto resolve o corpo.
 *
 * POR QUE NAO O prerender.mjs: aquele abre a pagina num Chromium headless, e o
 * container de build da Lovable nao tem as bibliotecas de sistema do Chromium
 * (ver o cabecalho de scripts/prerender.mjs). Este caminho e Node puro, entao
 * roda em qualquer lugar que rode `vite build`.
 *
 * POR QUE renderToPipeableStream E NAO renderToString: as rotas usam
 * React.lazy. O renderToString nao espera lazy resolver, entao entregaria o
 * fallback de carregamento como se fosse o conteudo da pagina, que e pior do
 * que nao gerar nada. O renderToPipeableStream espera tudo no onAllReady.
 *
 * SEM HIDRATACAO, DE PROPOSITO: o cliente usa createRoot().render(), que
 * SUBSTITUI o conteudo do container em vez de hidratar. Entao nao existe risco
 * de erro de hidratacao por divergencia entre servidor e cliente. O HTML gerado
 * aqui serve ao crawler e ao primeiro paint, e o React assume em seguida.
 * Trocar para hydrateRoot exigiria paridade exata, o que este app nao tem
 * (banner de consentimento, avaliacoes vindas do Supabase, deteccao de
 * viewport). Nao troque sem ler isto.
 */

import { renderToPipeableStream } from "react-dom/server";
// StaticRouter vem de react-router-dom, nao de react-router, embora os dois
// exportem. POR QUE: o app inteiro importa de react-router-dom, e sob o vitest
// os dois pacotes viram instancias de modulo separadas. O contexto criado por
// um nao e visto pelo hook do outro, e o render morre com "useLocation() may be
// used only in the context of a <Router> component". Um pacote so evita isso.
import { StaticRouter } from "react-router-dom";
import { Writable } from "node:stream";
import { AppProvedores, AppConteudo } from "./App";

export interface ResultadoSSG {
  html: string;
  /** Tags coletadas pelo react-helmet-async durante o render. */
  helmet: {
    title: string;
    meta: string;
    link: string;
    script: string;
  };
}

/**
 * Renderiza uma rota para HTML.
 *
 * Rejeita se o React sinalizar erro de shell, para a rota ser PULADA pelo
 * gerador em vez de publicar um corpo pela metade. Falhar alto aqui e
 * proposital: o modo de falha caro neste repo sempre foi o silencioso.
 */
export function renderizarRota(url: string): Promise<ResultadoSSG> {
  return new Promise((resolve, reject) => {
    const helmetContext: Record<string, unknown> = {};
    const pedacos: Buffer[] = [];

    const destino = new Writable({
      write(pedaco, _codificacao, callback) {
        pedacos.push(Buffer.from(pedaco));
        callback();
      },
    });

    destino.on("finish", () => {
      const helmet = (helmetContext as { helmet?: Record<string, { toString(): string }> }).helmet;
      resolve({
        html: Buffer.concat(pedacos).toString("utf8"),
        helmet: {
          title: helmet?.title?.toString() ?? "",
          meta: helmet?.meta?.toString() ?? "",
          link: helmet?.link?.toString() ?? "",
          script: helmet?.script?.toString() ?? "",
        },
      });
    });

    const { pipe, abort } = renderToPipeableStream(
      <AppProvedores helmetContext={helmetContext}>
        <StaticRouter location={url}>
          <AppConteudo />
        </StaticRouter>
      </AppProvedores>,
      {
        onAllReady() {
          pipe(destino);
        },
        onShellError(erro) {
          reject(erro);
        },
        onError(erro) {
          // Erro dentro de um Suspense nao derruba o shell, mas deixaria um
          // buraco no HTML. Preferimos pular a rota a publicar corpo parcial.
          reject(erro);
        },
      }
    );

    // Rede de seguranca: uma rota que nao resolve em 20 s nao pode segurar o
    // build. Ela e pulada e segue servindo o que o og-por-rota gerou.
    setTimeout(() => {
      abort();
      reject(new Error(`Prazo esgotado ao renderizar ${url}`));
    }, 20000).unref?.();
  });
}
