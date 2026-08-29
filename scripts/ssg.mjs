/**
 * Gera HTML estatico completo, head e body, das rotas publicas.
 *
 * O PROBLEMA: o site e uma SPA. Servia a mesma casca vazia de 9,8 KB nas 18
 * rotas. Medido na auditoria de 28/08/2026:
 *   - seis crawlers de IA receberam a mesma casca, com hash MD5 identico
 *   - o Google indexou /agendamento pelo og:description da casca, congelando um
 *     snippet com "+13 anos" que ja tinha virado 15 no codigo
 *   - todo link no WhatsApp mostrava titulo e imagem da home
 *
 * COMO: importa o bundle de SSR (src/entry-server.tsx, construido por
 * `vite build --ssr`) e renderiza cada rota com renderToPipeableStream. Node
 * puro, sem navegador.
 *
 * POR QUE ISTO RODA ONDE O prerender.mjs NAO: aquele abre um Chromium headless,
 * e o container de build da Lovable nao tem as bibliotecas de sistema dele
 * (libglib-2.0.so.0 ausente, ver o cabecalho daquele arquivo). Aqui nao ha
 * navegador nenhum.
 *
 * POR QUE SO AGORA FOI POSSIVEL: o cabecalho do prerender.mjs descartou SSR
 * citando dois bloqueios, o BrowserRouter na raiz e o Supabase junto do
 * consent e do tracking. Os commits de 27/08/2026 removeram os dois sem esse
 * objetivo: 41a8839 passou o Supabase para import dinamico e 811df9d restringiu
 * o AuthProvider as rotas autenticadas. Sobrou separar o roteador, que e o que
 * AppProvedores e AppConteudo fazem em src/App.tsx.
 *
 * SEM HIDRATACAO: o cliente usa createRoot().render(), que SUBSTITUI o conteudo
 * do container. Nao ha risco de erro de hidratacao por divergencia. Ver a nota
 * em src/entry-server.tsx antes de pensar em trocar por hydrateRoot.
 *
 * FALHA SEGURA POR ROTA: rota que nao renderiza e PULADA e segue servindo a
 * casca, que e o comportamento anterior. Nenhuma rota recebe conteudo pela
 * metade. O resumo fica em dist/ssg-status.json.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { ROTAS_EXTRA } from "./rotas-extra.mjs"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIST = join(RAIZ, "dist")
const BUNDLE_SSR = join(RAIZ, "dist-ssr", "entry-server.js")
const BASE = "https://drjulianomachado.com"

if (!existsSync(join(DIST, "index.html"))) {
  console.log("  dist/index.html nao existe. Rode depois do vite build.")
  process.exit(0)
}

if (!existsSync(BUNDLE_SSR)) {
  console.log("  dist-ssr/entry-server.js nao existe. O build de SSR nao rodou.")
  console.log("  As rotas seguem servindo a casca, como antes. Build nao interrompido.")
  process.exit(0)
}

const { renderizarRota } = await import(`file://${BUNDLE_SSR.replace(/\\/g, "/")}`)

const casca = await readFile(join(DIST, "index.html"), "utf8")
const sitemap = await readFile(join(RAIZ, "public/sitemap.xml"), "utf8")
const rotasDoSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(BASE, "") || "/"
)

// A lista vive em scripts/rotas-extra.mjs, importada no topo. O porque de ela
// existir, e o cuidado ao cresce-la, estao documentados la.

const rotas = [...new Set([...rotasDoSitemap, ...ROTAS_EXTRA])]

/**
 * Monta o HTML final juntando a casca construida, as tags do helmet e o corpo.
 *
 * A casca traz os <script> com os hashes do build, que sao o que faz a SPA
 * subir. Trocamos apenas o <title> dela e injetamos o resto antes de </head>.
 */
function montar(html, helmet, rota) {
  const url = rota === "/" ? `${BASE}/` : `${BASE}${rota}`

  const cabecalho = [
    helmet.meta,
    helmet.link,
    // helmet.script traz os blocos application/ld+json que as paginas montam:
    // Physician, MedicalClinic, MedicalWebPage, FAQPage e BreadcrumbList.
    // Sem esta linha o HTML sai com o texto certo e sem dado estruturado, que
    // e justamente o que o Google usa para entender a entidade.
    helmet.script,
    // Canonical so quando a pagina nao emitiu o dela.
    //
    // Ate 29/08/2026 esta linha era incondicional, e toda rota saia com DUAS
    // tags canonical, a do react-helmet e esta. Nas 18 rotas do sitemap as duas
    // coincidiam, entao o Google tolerava e ninguem via.
    //
    // Quebrou ao acrescentar /agendar e /agendar-consulta, que emitem canonical
    // apontando para /agendamento de proposito. As duas tags passaram a se
    // CONTRADIZER na mesma pagina, uma dizendo /agendar e a outra /agendamento.
    // A documentacao do Google diz que canonicals conflitantes podem ser todos
    // ignorados, o que anularia justamente a correcao.
    //
    // Agora a pagina manda, e esta linha e so a rede de seguranca para quem
    // esquecer de emitir a sua.
    helmet.link?.includes('rel="canonical"')
      ? null
      : `<link rel="canonical" href="${url}" />`,
  ]
    .filter(Boolean)
    .join("\n    ")

  return casca
    .replace(/<title>[\s\S]*?<\/title>/, helmet.title || "<title></title>")
    // A casca traz og:title, og:description e og:url da home. O helmet emite as
    // da rota, entao as da casca sairiam duplicadas e ambiguas para o crawler.
    .replace(/\s*<meta property="og:(?:title|description|url)"[^>]*>/g, "")
    .replace("</head>", `    ${cabecalho}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
}

const escritas = []
const puladas = []

for (const rota of rotas) {
  try {
    const { html, helmet } = await renderizarRota(rota)
    const final = montar(html, helmet, rota)

    if (rota === "/") {
      await writeFile(join(DIST, "index.html"), final, "utf8")
    } else {
      const pasta = join(DIST, rota.slice(1))
      await mkdir(pasta, { recursive: true })
      await writeFile(join(pasta, "index.html"), final, "utf8")
    }
    escritas.push({ rota, bytes: final.length })
  } catch (erro) {
    puladas.push({ rota, motivo: String(erro.message).slice(0, 200) })
  }
}

await writeFile(
  join(DIST, "ssg-status.json"),
  JSON.stringify(
    {
      em: new Date().toISOString(),
      doSitemap: rotasDoSitemap.length,
      extras: ROTAS_EXTRA,
      escritas,
      puladas,
    },
    null,
    2,
  ),
  "utf8"
)

console.log(`  SSG: ${escritas.length} rotas com HTML completo.`)
if (puladas.length > 0) {
  console.log(`  PULADAS, seguem servindo a casca:`)
  for (const p of puladas) console.log(`    ${p.rota}: ${p.motivo}`)
}
