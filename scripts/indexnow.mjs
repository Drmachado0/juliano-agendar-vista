/**
 * Avisa o IndexNow que as URLs do site mudaram.
 *
 * PARA QUE SERVE: Bing, Yandex, Seznam e DuckDuckGo aceitam esse ping e
 * rastreiam sob demanda em vez de esperar a proxima passada. O Google NAO
 * participa do IndexNow. Para o Google, o caminho continua sendo a Inspecao de
 * URL no Search Console, que e manual, e a Indexing API dele e restrita a
 * JobPosting e BroadcastEvent.
 *
 * POR QUE ISSO IMPORTA AQUI: na auditoria de 28/08/2026, 9 das 18 URLs nunca
 * tinham sido rastreadas pelo Google. Nao da para consertar o Google por API,
 * mas da para nao repetir o mesmo abandono no Bing, que alimenta tambem o
 * Copilot e o DuckDuckGo.
 *
 * COMO USA: rode DEPOIS que o deploy estiver no ar, nao antes. O IndexNow busca
 * o arquivo de chave na raiz do site para provar que quem enviou controla o
 * dominio, e vai buscar as URLs enviadas. Mandar antes do deploy avisa sobre
 * conteudo que ainda nao existe.
 *
 *   npm run indexnow
 *
 * A chave vive em public/<chave>.txt, descoberta automaticamente. O Vite copia
 * public/ para a raiz do dist, entao o arquivo fica servido em
 * https://drjulianomachado.com/<chave>.txt sem configuracao extra.
 */

import { readdir, readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const ENDPOINT = "https://api.indexnow.org/indexnow"

/** Acha o unico arquivo de 32 hex em public/, que e a chave do IndexNow. */
async function acharChave() {
  const nomes = await readdir(join(RAIZ, "public"))
  const chaves = nomes.filter((n) => /^[0-9a-f]{32}\.txt$/.test(n))

  if (chaves.length === 0) {
    throw new Error(
      "Nenhum arquivo de chave em public/. Gere 32 caracteres hex, salve em " +
        "public/<chave>.txt com a propria chave como conteudo, e publique."
    )
  }
  if (chaves.length > 1) {
    throw new Error(`Mais de um arquivo de chave em public/: ${chaves.join(", ")}`)
  }
  return chaves[0].replace(/\.txt$/, "")
}

/**
 * Le as URLs do sitemap versionado, que e a fonte de verdade do que existe.
 *
 * Regex em vez de parser de XML pelo mesmo motivo de scripts/atualizar-lastmod.mjs:
 * este sitemap e gerado pelo proprio repo, o formato e conhecido, e uma
 * dependencia nova entraria no npm install que o container da Lovable executa.
 */
async function lerUrlsDoSitemap() {
  const xml = await readFile(join(RAIZ, "public", "sitemap.xml"), "utf8")
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

const chave = await acharChave()
const urls = await lerUrlsDoSitemap()

// O host sai do proprio sitemap. Deixar a string fixa aqui criaria uma segunda
// fonte de verdade que ninguem lembraria de trocar junto.
const HOST = new URL(urls[0]).host

// A chave precisa estar servida ANTES do envio. Sem isso o IndexNow devolve 403
// e a mensagem nao deixa obvio que o problema e o arquivo, nao a chave.
const urlDaChave = `https://${HOST}/${chave}.txt`
const resposta = await fetch(urlDaChave)
const servido = resposta.ok ? (await resposta.text()).trim() : null

if (servido !== chave) {
  console.error(`  A chave nao esta publicada em ${urlDaChave}`)
  console.error(`  Recebido: ${resposta.status}, conteudo ${JSON.stringify(servido)}`)
  console.error("  Faca o deploy antes de rodar este comando.")
  process.exit(1)
}

console.log(`  Chave confirmada em ${urlDaChave}`)
console.log(`  Enviando ${urls.length} URLs para o IndexNow.`)

const envio = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: chave,
    keyLocation: urlDaChave,
    urlList: urls,
  }),
})

// 200 e 202 sao os dois sucessos. O 202 significa aceito com a chave ainda em
// validacao, que e o normal na primeira vez.
if (envio.status === 200 || envio.status === 202) {
  console.log(`  Aceito, HTTP ${envio.status}.`)
  console.log("  Bing, Yandex, Seznam e DuckDuckGo recebem o aviso.")
  console.log("  O Google nao participa do IndexNow, use a Inspecao de URL no GSC.")
} else {
  console.error(`  Recusado, HTTP ${envio.status}: ${await envio.text()}`)
  process.exit(1)
}
