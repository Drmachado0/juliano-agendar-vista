/**
 * Instala os hooks versionados de scripts/hooks/ em .git/hooks/.
 *
 * POR QUE NAO HUSKY: o husky se instala sozinho pelo script `prepare`, que roda
 * dentro do `npm install`. O container de build da Lovable executa esse install,
 * e este repo ja tem historico de passo de build morrendo em silencio la (ver
 * scripts/prerender.mjs). Nao vale colocar mais nada nesse caminho por
 * conveniencia. O custo e um comando manual por clone, uma vez so.
 *
 * Uso: npm run hooks:instalar
 */

import { readdir, readFile, writeFile, chmod, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, "..", "..")
const DESTINO = join(RAIZ, ".git", "hooks")

if (!existsSync(join(RAIZ, ".git"))) {
  console.error("  Nao encontrei .git na raiz. Rode isto dentro do repositorio.")
  process.exit(1)
}

await mkdir(DESTINO, { recursive: true })

const arquivos = (await readdir(AQUI)).filter((n) => !n.endsWith(".mjs"))

if (arquivos.length === 0) {
  console.log("  Nenhum hook para instalar.")
  process.exit(0)
}

for (const nome of arquivos) {
  const conteudo = await readFile(join(AQUI, nome), "utf8")
  const alvo = join(DESTINO, nome)
  // Normaliza para LF. O Git Bash no Windows nao executa script com CRLF.
  await writeFile(alvo, conteudo.replace(/\r\n/g, "\n"), "utf8")
  await chmod(alvo, 0o755)
  console.log(`  Instalado: .git/hooks/${nome}`)
}

console.log("")
console.log("  Pronto. O gate roda tsc e vitest antes de cada push.")
console.log("  Para pular num caso legitimo: git push --no-verify")
