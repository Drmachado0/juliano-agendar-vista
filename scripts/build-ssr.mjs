/**
 * Roda o build de SSR sem poder derrubar o deploy.
 *
 * POR QUE ESTE ARQUIVO EXISTE: no package.json os passos de build sao
 * encadeados com `&&`. Se `vite build --ssr` falhar, a cadeia para e o deploy
 * inteiro nao sai. Numa SPA que ja funciona sem SSG, isso e trocar um site no ar
 * sem HTML estatico por site nenhum.
 *
 * A lição vem do scripts/prerender.mjs, que sai com codigo 0 quando o Chromium
 * nao existe: ganho nao pode virar dependencia. O mesmo vale aqui.
 *
 * O QUE ACONTECE SE FALHAR: nao existe dist-ssr/entry-server.js, entao
 * scripts/ssg.mjs detecta a ausencia e sai limpo tambem. As rotas seguem
 * servindo a casca, que e o comportamento anterior ao SSG. O motivo fica
 * gravado em dist/ssr-build-status.json e impresso no log do build, para a
 * falha nao ser silenciosa como foi a do prerender por um mes.
 */

import { spawnSync } from "node:child_process"
import { writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..")
const DIST = join(RAIZ, "dist")

const resultado = spawnSync(
  "npx",
  ["vite", "build", "--ssr", "src/entry-server.tsx", "--outDir", "dist-ssr"],
  { cwd: RAIZ, encoding: "utf8", shell: true }
)

const saiuBem =
  resultado.status === 0 && existsSync(join(RAIZ, "dist-ssr", "entry-server.js"))

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true })

if (saiuBem) {
  console.log("  build de SSR: ok")
  writeFileSync(
    join(DIST, "ssr-build-status.json"),
    JSON.stringify({ motivo: "ok", em: new Date().toISOString() }, null, 2),
    "utf8"
  )
  process.exit(0)
}

// A partir daqui e falha. Barulhenta no log, mas sem interromper o build.
const detalhe = [resultado.stderr, resultado.stdout, resultado.error?.message]
  .filter(Boolean)
  .join("\n")
  .slice(-3000)

console.log("")
console.log("  BUILD DE SSR FALHOU. O deploy segue, as rotas servem a casca.")
console.log(`  status=${resultado.status}`)
console.log(detalhe)
console.log("")

writeFileSync(
  join(DIST, "ssr-build-status.json"),
  JSON.stringify(
    {
      motivo: "falhou",
      status: resultado.status,
      detalhe,
      em: new Date().toISOString(),
    },
    null,
    2
  ),
  "utf8"
)

process.exit(0)
