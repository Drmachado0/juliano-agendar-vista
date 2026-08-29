// @vitest-environment node

/**
 * POR QUE ESTE TESTE EXISTE: desde 28/08/2026 o scripts/ssg.mjs so pre-renderiza
 * rota que esteja no public/sitemap.xml ou em scripts/rotas-extra.mjs. Rota
 * fora das duas listas nao ganha HTML proprio, e a hospedagem devolve o
 * dist/index.html, que hoje e a home inteira, com 200 e index,follow.
 *
 * O ESTRAGO QUE ISSO JA CAUSOU: a /paragominas/agendamento pede noindex de
 * proposito e estava sendo servida como copia indexavel da home. A intencao
 * chegava invertida a quem nao executa JS. E o Search Console ja registrava
 * impressoes para /auth/ e /home/, duas URLs que ninguem quis publicar.
 *
 * O MODO DE FALHA E SILENCIOSO: alguem acrescenta uma rota no App.tsx, o build
 * passa, os testes passam, o deploy sai, e a pagina simplesmente nao existe
 * para quem nao executa JavaScript. Ninguem descobre ate rodar uma auditoria.
 *
 * Aqui isso vira falha de teste no mesmo commit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL } from "@/lib/locations";
import { ROTAS_EXTRA } from "../../scripts/rotas-extra.mjs";

const RAIZ = join(__dirname, "..", "..");

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf-8");
}

/** Toda rota declarada no roteador. */
function rotasDoApp(): string[] {
  const src = ler("src/App.tsx");
  return [...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

/** Rotas que o sitemap publica, ou seja, as que devem ser indexadas. */
function rotasDoSitemap(): string[] {
  const xml = ler("public/sitemap.xml");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(BASE_URL, "") || "/",
  );
}

/**
 * Rotas que de propósito NAO recebem HTML proprio.
 *
 * Antes de acrescentar algo aqui, pergunte se a rota realmente nao precisa
 * existir para um crawler. A lista curta e o que da valor ao teste.
 */
const SEM_HTML_PROPRIO = new Set([
  // Curinga do React Router. Nao e uma URL.
  "*",
  // Redirects que hoje so acontecem no cliente. O lugar certo deles e um 301 de
  // servidor, item 2.7 do plano de acao, que depende do painel do Cloudflare.
  // Enquanto isso, pre-renderizar um <Navigate> nao produziria HTML util.
  "/agendar",
  "/agendar-consulta",
]);

/** Area logada. Bloqueada no robots.txt e sem valor de busca. */
const PRIVADA = /^\/admin(\/|$)/;

// Lidos uma vez. Os arquivos nao mudam durante a rodada, e reparsear a cada
// teste so troca clareza por trabalho repetido.
const ROTAS_APP = rotasDoApp();
const ROTAS_SITEMAP = rotasDoSitemap();

describe("cobertura de HTML das rotas publicas", () => {
  it("toda rota publica do App.tsx esta no sitemap ou em ROTAS_EXTRA", () => {
    const cobertas = new Set([...ROTAS_SITEMAP, ...ROTAS_EXTRA]);

    const descobertas = ROTAS_APP.filter(
      (r) => !PRIVADA.test(r) && !SEM_HTML_PROPRIO.has(r) && !cobertas.has(r),
    );

    expect(
      descobertas,
      "estas rotas nao recebem HTML proprio e serao servidas como copia da home. " +
        "Ponha no public/sitemap.xml se devem ser indexadas, ou em ROTAS_EXTRA no " +
        "scripts/rotas-extra.mjs se nao devem",
    ).toEqual([]);
  });

  it("o sitemap nao publica rota que o App.tsx nao serve", () => {
    const doApp = new Set(ROTAS_APP);
    const orfas = ROTAS_SITEMAP.filter((r) => !doApp.has(r));

    expect(
      orfas,
      "o sitemap declara rota que o roteador nao conhece. Ela vai devolver a home",
    ).toEqual([]);
  });

  it("nenhuma rota de ROTAS_EXTRA esta tambem no sitemap", () => {
    const noSitemap = new Set(ROTAS_SITEMAP);
    const repetidas = ROTAS_EXTRA.filter((r) => noSitemap.has(r));

    // ROTAS_EXTRA existe para o que NAO deve ser indexado. Uma rota nas duas
    // listas e sinal contraditorio: o sitemap pede indexacao e a pagina pede
    // noindex. O Google reclama disso na Cobertura.
    expect(
      repetidas,
      "rota duplicada entre sitemap e ROTAS_EXTRA. Escolha uma das duas listas",
    ).toEqual([]);
  });

  it("toda rota de ROTAS_EXTRA existe no App.tsx", () => {
    const doApp = new Set(ROTAS_APP);
    const obsoletas = ROTAS_EXTRA.filter((r) => !doApp.has(r));

    // Sem esta checagem, entrada obsoleta falha em silencio. O scripts/ssg.mjs
    // so pula rota que LANCA, e uma rota que nao existe mais cai no NotFound e
    // renderiza normalmente. O resultado seria publicar uma pagina de 404 como
    // HTML estatico, com aparencia de rota valida.
    expect(
      obsoletas,
      "ROTAS_EXTRA declara rota que o roteador nao serve. O SSG publicaria a pagina de 404",
    ).toEqual([]);
  });

  it("as rotas privadas continuam fora do sitemap", () => {
    const vazadas = ROTAS_SITEMAP.filter((r) => PRIVADA.test(r));
    expect(vazadas, "rota de admin apareceu no sitemap").toEqual([]);
  });
});
