/**
 * Escreve o <head> correto de cada rota em dist/<rota>/index.html.
 *
 * O PROBLEMA: o site e uma SPA e serve a mesma casca de HTML nas 18 rotas. O
 * title, a description e as tags og so aparecem depois que o react-helmet roda
 * no cliente. Quem nao executa JS ve sempre o cabecalho da home.
 *
 * Medido na auditoria de 28/08/2026:
 *   - o Google indexou /agendamento usando o og:description da casca, com o
 *     texto "+13 anos de experiencia" que ja tinha sido corrigido para 15 no
 *     codigo, ou seja, um snippet errado congelado no indice
 *   - todo link compartilhado no WhatsApp mostra titulo e imagem da home
 *   - seis crawlers de IA receberam a mesma casca com hash MD5 identico
 *
 * POR QUE ISTO FUNCIONA ONDE O PRERENDER NAO: scripts/prerender.mjs precisa de
 * Chromium para montar o DOM, e o container da Lovable nao tem as bibliotecas de
 * sistema dele (ver o cabecalho daquele arquivo). Este script nao renderiza
 * nada: copia a casca ja construida e troca as tags do <head> por string. Nao
 * depende de navegador, entao roda em qualquer lugar que rode `vite build`.
 *
 * O QUE ELE NAO RESOLVE: o <body> continua vazio ate o JS montar. Isto conserta
 * cabecalho, nao conteudo. Para crawler de IA ainda falta o corpo.
 *
 * FONTE DE VERDADE: os proprios arquivos de pagina. Nao ha arquivo de dados
 * paralelo de proposito, porque seria uma segunda fonte para alguem esquecer de
 * atualizar. A extracao por regex segue o mesmo padrao de
 * scripts/atualizar-lastmod.mjs, que ja le rotas do App.tsx assim.
 *
 * FALHA SEGURA: se uma rota nao resolver, ela e PULADA e segue servindo a casca,
 * que e o comportamento de hoje. Nenhuma rota recebe tag errada. O resumo do que
 * saiu e do que foi pulado fica em dist/og-por-rota-status.json.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASE = "https://drjulianomachado.com"

/** Rotas que nao sao paginas de procedimento, com o arquivo que as define. */
const ROTAS_SIMPLES = {
  "/": "src/pages/Index.tsx",
  "/sobre": "src/pages/Sobre.tsx",
  "/belem": "src/pages/Belem.tsx",
  "/paragominas": "src/pages/Paragominas.tsx",
  "/agendamento": "src/pages/Agendamento.tsx",
  "/procedimentos": "src/pages/procedimentos/Index.tsx",
  "/politica-de-privacidade": "src/pages/PoliticaPrivacidade.tsx",
}

/**
 * Le as constantes de DOCTOR para resolver interpolacao nos titulos.
 *
 * Varias paginas escrevem `<title>Oftalmologista em Belem | {DOCTOR.name}</title>`.
 * Sem resolver isso, a tag sairia com a chave literal no lugar do nome.
 */
async function lerConstantesDoMedico() {
  const s = await readFile(join(RAIZ, "src/lib/constants.ts"), "utf8")
  const consts = {}
  for (const m of s.matchAll(/^\s{2}(\w+):\s*"([^"]*)",/gm)) {
    consts[m[1]] = m[2]
  }
  return consts
}

/** Troca ${DOCTOR.x} e {DOCTOR.x} pelo valor real. Erra se a chave nao existir. */
function resolver(texto, consts) {
  return texto.replace(/\$?\{DOCTOR\.(\w+)\}/g, (todo, chave) => {
    if (!(chave in consts)) throw new Error(`DOCTOR.${chave} nao encontrado`)
    return consts[chave]
  })
}

/** Extrai title e description de uma pagina com Helmet inline. */
function extrairDeHelmet(fonte, consts) {
  const t = fonte.match(/<title>([\s\S]*?)<\/title>/)
  const d = fonte.match(
    /name="description"\s*\n?\s*content=\{?[`"]([\s\S]*?)[`"]\}?\s*\/?>/
  )
  if (!t || !d) return null
  return {
    title: resolver(t[1].trim(), consts),
    description: resolver(d[1].trim(), consts),
  }
}

/** Extrai de uma pagina de procedimento, que declara um objeto ProcedurePageData. */
function extrairDeProcedimento(fonte) {
  const slug = fonte.match(/slug:\s*"([^"]+)"/)
  const t = fonte.match(/pageTitle:\s*"([^"]+)"/)
  const d = fonte.match(/metaDescription:\s*\n?\s*"([^"]+)"/)
  if (!slug || !t || !d) return null
  return {
    rota: `/procedimentos/${slug[1]}`,
    title: t[1],
    description: d[1],
  }
}

/** Monta o mapa rota -> metadados lendo os arquivos de pagina. */
export async function extrairMetaDasRotas(raiz = RAIZ) {
  const consts = await lerConstantesDoMedico()
  const mapa = new Map()

  for (const [rota, arquivo] of Object.entries(ROTAS_SIMPLES)) {
    const fonte = await readFile(join(raiz, arquivo), "utf8")
    const meta = extrairDeHelmet(fonte, consts)
    if (meta) mapa.set(rota, meta)
  }

  const dirProc = join(raiz, "src/pages/procedimentos")
  for (const nome of await readdir(dirProc)) {
    if (!nome.endsWith(".tsx") || nome.endsWith(".test.tsx") || nome === "Index.tsx") continue
    const meta = extrairDeProcedimento(await readFile(join(dirProc, nome), "utf8"))
    if (meta) mapa.set(meta.rota, { title: meta.title, description: meta.description })
  }

  return mapa
}

/** Escapa para uso seguro dentro de um atributo HTML. */
function escapar(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Troca as tags do <head> da casca pelas da rota.
 *
 * Mexe apenas em title, description, og:title, og:description e og:url, e
 * adiciona o canonical. Todo o resto da casca fica intacto, inclusive os
 * <script> com os hashes do build, que sao o que faz a SPA subir.
 */
function montarHtmlDaRota(casca, rota, meta) {
  const url = rota === "/" ? `${BASE}/` : `${BASE}${rota}`
  const t = escapar(meta.title)
  const d = escapar(meta.description)

  let html = casca
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(
      /<meta\s+property="og:title"[^>]*>/,
      `<meta property="og:title" content="${t}" data-rh="true" />`
    )
    .replace(
      /<meta\s+property="og:description"[^>]*>/,
      `<meta property="og:description" content="${d}" data-rh="true" />`
    )
    .replace(
      /<meta\s+property="og:url"[^>]*>/,
      `<meta property="og:url" content="${url}" data-rh="true" />`
    )

  // A casca nao tem meta description propria, entao inserimos uma.
  if (/<meta\s+name="description"/.test(html)) {
    html = html.replace(
      /<meta\s+name="description"[^>]*>/,
      `<meta name="description" content="${d}" />`
    )
  } else {
    html = html.replace(
      "</head>",
      `    <meta name="description" content="${d}" />\n  </head>`
    )
  }

  return html.replace(
    "</head>",
    `    <link rel="canonical" href="${url}" />\n  </head>`
  )
}

// Execucao direta. Importado por teste, nao roda nada.
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/") ||
    process.argv[1]?.endsWith("og-por-rota.mjs")) {
  const DIST = join(RAIZ, "dist")

  if (!existsSync(join(DIST, "index.html"))) {
    console.log("  dist/index.html nao existe. Rode depois do vite build.")
    process.exit(0)
  }

  const casca = await readFile(join(DIST, "index.html"), "utf8")
  const mapa = await extrairMetaDasRotas()

  const escritas = []
  const puladas = []

  for (const [rota, meta] of mapa) {
    if (rota === "/") {
      // A home ja e o dist/index.html. So reescrevemos o head dela no lugar.
      await writeFile(join(DIST, "index.html"), montarHtmlDaRota(casca, rota, meta), "utf8")
      escritas.push(rota)
      continue
    }
    const pasta = join(DIST, rota.slice(1))
    await mkdir(pasta, { recursive: true })
    await writeFile(join(pasta, "index.html"), montarHtmlDaRota(casca, rota, meta), "utf8")
    escritas.push(rota)
  }

  // Confere contra o sitemap, que e a lista do que deveria existir.
  const sitemap = await readFile(join(RAIZ, "public/sitemap.xml"), "utf8")
  const doSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(BASE, "") || "/")

  for (const rota of doSitemap) {
    if (!mapa.has(rota)) puladas.push(rota)
  }

  await writeFile(
    join(DIST, "og-por-rota-status.json"),
    JSON.stringify({ em: new Date().toISOString(), escritas, puladas }, null, 2),
    "utf8"
  )

  console.log(`  og por rota: ${escritas.length} escritas.`)
  if (puladas.length > 0) {
    console.log(`  PULADAS, seguem servindo a casca: ${puladas.join(", ")}`)
  }
}
