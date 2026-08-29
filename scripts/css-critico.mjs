/**
 * Embute o CSS critico no <head> de cada HTML do dist e tira a folha completa
 * do caminho de renderizacao.
 *
 * O PROBLEMA, medido no PageSpeed de 29/08/2026: o mobile ficava 4,2 SEGUNDOS
 * com a tela branca e depois pintava o site inteiro de uma vez. Os seis
 * primeiros frames do filmstrip do Lighthouse eram byte a byte identicos, com
 * o mesmo md5, e nem texto sem estilo apareciam. Isso e a assinatura de folha
 * de estilo bloqueante: o navegador se recusa a pintar qualquer pixel ate
 * baixar e parsear o CSS externo.
 *
 * Speed Index e a area sob a curva de completude visual. Uma curva em degrau,
 * 0% por 4,2 s e depois 100%, da um SI igual ao instante do degrau. Era por
 * isso que o SI ficava em ~7 s enquanto FCP marcava 2,1 s e LCP 3,4 s: nao
 * havia nada progressivo para melhorar a media.
 *
 * O DESPERDICIO QUE ISSO CRIAVA: o ssg.mjs pre-renderiza 21 rotas justamente
 * para entregar HTML pronto, e o documento chegava completo em ~107 ms com
 * TTFB de 12 ms. Esse ganho inteiro era jogado fora esperando um segundo
 * round trip para o CSS. Duas viagens antes do primeiro pixel, quando uma
 * bastava.
 *
 * COMO: o beasties le o HTML ja renderizado, que aqui tem o DOM real e completo
 * porque o SSG rodou antes, casa as regras do CSS com os elementos presentes,
 * embute o que casou e troca o <link rel="stylesheet"> por um preload que vira
 * folha no onload, com <noscript> de fallback.
 *
 * POR QUE pruneSource FICA FALSO: as 21 rotas compartilham UM arquivo de CSS
 * em dist/assets. Podar a fonte a cada rota mutaria esse arquivo compartilhado
 * e corromperia as rotas seguintes.
 *
 * FALHA SEGURA POR ARQUIVO, mesma politica do ssg.mjs: HTML que o beasties nao
 * conseguir processar fica exatamente como estava, servindo CSS bloqueante,
 * que e o comportamento anterior. Nenhum arquivo sai pela metade.
 */

import { readFile, writeFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

import Beasties from "beasties"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIST = join(RAIZ, "dist")

if (!existsSync(DIST)) {
  console.log("  dist nao existe. Rode depois do vite build.")
  process.exit(0)
}

async function htmlsDoDist(pasta) {
  const achados = []
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name)
    if (entrada.isDirectory()) achados.push(...(await htmlsDoDist(caminho)))
    else if (entrada.name.endsWith(".html")) achados.push(caminho)
  }
  return achados
}

const beasties = new Beasties({
  path: DIST,
  publicPath: "/",
  preload: "swap",
  // A folha e compartilhada pelas 21 rotas, ver o cabecalho.
  pruneSource: false,
  // O index.html ja traz os @font-face inline e os preloads de Archivo e Inter
  // escolhidos a mao. Deixar o beasties mexer nisso desfaria aquele trabalho.
  reduceInlineStyles: false,
  inlineFonts: false,
  preloadFonts: false,
  logLevel: "silent",
})

const arquivos = await htmlsDoDist(DIST)
const processados = []
const pulados = []

/**
 * Confere que sobrou zero <link rel="stylesheet"> bloqueante fora de <noscript>.
 *
 * O ponto inteiro deste passo e tirar a folha do caminho de renderizacao. Se o
 * beasties devolver HTML sem fazer isso, o build seguiria verde entregando
 * exatamente o problema que veio consertar, e so um filmstrip do Lighthouse
 * semanas depois revelaria. Verificar o resultado custa uma regex.
 */
function aindaBloqueia(html) {
  const cabeca = html.slice(0, html.indexOf("</head>"))
  const foraDoNoscript = cabeca.replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
  return (foraDoNoscript.match(/rel="stylesheet"[^>]*href/g) || []).length
}

for (const arquivo of arquivos) {
  const antes = await readFile(arquivo, "utf8")
  const nome = relative(DIST, arquivo)
  try {
    const depois = await beasties.process(antes)
    const bloqueantes = aindaBloqueia(depois)
    if (bloqueantes > 0) {
      // Nao escreve. O arquivo original ja nao bloqueava menos que este.
      pulados.push({ arquivo: nome, motivo: `saiu com ${bloqueantes} stylesheet bloqueante` })
      continue
    }
    const embutido = (depois.match(/<style>[\s\S]*?<\/style>/g) || []).join("").length
    await writeFile(arquivo, depois, "utf8")
    processados.push({ arquivo: nome, antes: antes.length, depois: depois.length, embutido })
  } catch (erro) {
    pulados.push({ arquivo: nome, motivo: String(erro.message).slice(0, 200) })
  }
}

const somaAntes = processados.reduce((t, p) => t + p.antes, 0)
const somaDepois = processados.reduce((t, p) => t + p.depois, 0)
const medioEmbutido = processados.length
  ? Math.round(processados.reduce((t, p) => t + p.embutido, 0) / processados.length / 1024)
  : 0

console.log(
  `  CSS critico: ${processados.length} HTML, ~${medioEmbutido} KB embutidos por rota, ` +
    `${Math.round(somaAntes / 1024)} KB -> ${Math.round(somaDepois / 1024)} KB no total.`,
)
if (pulados.length > 0) {
  console.log(`  PULADOS, seguem com CSS bloqueante:`)
  for (const p of pulados) console.log(`    ${p.arquivo}: ${p.motivo}`)
}
