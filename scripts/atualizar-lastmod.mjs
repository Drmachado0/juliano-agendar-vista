/**
 * Preenche <lastmod> no sitemap com a data real de cada pagina.
 *
 * POR QUE ESTE SCRIPT EXISTE: em 27/08/2026 o Search Console mostrou que 10 das
 * 18 rotas estavam "URL is unknown to Google" — nunca rastreadas. A causa saiu
 * de uma correspondencia exata: o Google tinha 8 URLs em cache do sitemap, e as
 * 8 eram precisamente as indexadas. As 10 de fora eram precisamente as
 * desconhecidas.
 *
 * O sitemap crescera de 8 para 18 e o Google nunca o releu. E nao tinha motivo
 * para reler: o arquivo trazia apenas changefreq e priority, que a documentacao
 * do Google diz ignorar, e nenhum <lastmod>, que e justamente o campo que ele
 * usa. Sitemap sem lastmod nao anuncia mudanca nenhuma.
 *
 * Agrava porque o site e uma SPA sem prerender no host: o HTML cru nao tem link
 * nenhum, entao descoberta por link depende da fila de renderizacao, que e
 * lenta e limitada. Na pratica o sitemap e o unico canal de descoberta — e ele
 * estava mudo.
 *
 * DATA REAL, NAO CARIMBO: cada rota recebe a data do ultimo commit que tocou o
 * arquivo da pagina. O Google ignora sitemap cuja lastmod e sempre "hoje", e
 * com razao: data uniforme nao e informacao. Como `git log -1` so muda quando o
 * arquivo muda, rodar isto a cada build e seguro e continua verdadeiro.
 *
 * ESCOPO DELIBERADAMENTE ESTREITO: nao decide QUAIS URLs entram no sitemap, so
 * atualiza as datas das que ja estao. A completude e guardada por
 * src/test/procedimentosIndex.test.ts e src/test/llmsTxt.test.ts. Juntar as
 * duas responsabilidades aqui criaria o risco de sumir com rota sem ninguem ver.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SITEMAP = "public/sitemap.xml";
const APP = "src/App.tsx";
const BASE = "https://drjulianomachado.com";

/** Monta rota -> arquivo lendo as rotas e os imports do App.tsx. */
function mapaDeRotas() {
  const app = readFileSync(APP, "utf-8");

  // const Nome = lazy(() => import("./pages/Alguma"))
  const porLazy = new Map(
    [...app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\("([^"]+)"\)/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  // import Nome from "./pages/Alguma"
  const porEstatico = new Map(
    [...app.matchAll(/^import\s+(\w+)\s+from\s+"(\.\/pages\/[^"]+)"/gm)].map((m) => [m[1], m[2]]),
  );

  const mapa = new Map();
  for (const m of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)\s*\/>\}/g)) {
    const [, rota, comp] = m;
    const rel = porLazy.get(comp) ?? porEstatico.get(comp);
    if (!rel) continue;
    const arquivo = rel.replace(/^\.\//, "src/") + ".tsx";
    if (existsSync(arquivo)) mapa.set(rota, arquivo);
  }
  return mapa;
}

/** Data ISO do ultimo commit que tocou o arquivo. */
function dataDoArquivo(arquivo) {
  try {
    const saida = execFileSync("git", ["log", "-1", "--format=%cs", "--", arquivo], {
      encoding: "utf-8",
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(saida) ? saida : null;
  } catch {
    return null;
  }
}

function main() {
  if (!existsSync(SITEMAP)) {
    console.warn(`[lastmod] ${SITEMAP} nao existe. Pulando.`);
    return;
  }

  const mapa = mapaDeRotas();
  let xml = readFileSync(SITEMAP, "utf-8");
  let atualizadas = 0;
  const semData = [];

  // Um bloco <url> por vez, para nao depender da ordem dos campos internos.
  xml = xml.replace(/<url>([\s\S]*?)<\/url>/g, (bloco, corpo) => {
    const loc = corpo.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) return bloco;

    const rota = loc.replace(BASE, "") || "/";
    const arquivo = mapa.get(rota);
    const data = arquivo ? dataDoArquivo(arquivo) : null;

    if (!data) {
      semData.push(rota);
      return bloco;
    }

    atualizadas++;
    const tag = `<lastmod>${data}</lastmod>`;
    const jaTem = /<lastmod>[^<]*<\/lastmod>/.test(corpo);
    const novoCorpo = jaTem
      ? corpo.replace(/<lastmod>[^<]*<\/lastmod>/, tag)
      : corpo.replace(/(<loc>[^<]+<\/loc>)/, `$1\n    ${tag}`);
    return `<url>${novoCorpo}</url>`;
  });

  writeFileSync(SITEMAP, xml, "utf-8");
  console.log(`[lastmod] ${atualizadas} rota(s) datadas pelo historico do git.`);
  if (semData.length) {
    // Nao derruba o build: sitemap sem lastmod continua valido, so menos util.
    // Mas precisa aparecer, porque rota sem arquivo mapeado costuma significar
    // que o App.tsx e o sitemap divergiram.
    console.warn(`[lastmod] sem data (rota nao mapeada no App.tsx): ${semData.join(", ")}`);
  }
}

main();
