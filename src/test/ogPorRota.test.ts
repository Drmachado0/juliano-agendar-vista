/**
 * POR QUE ESTE TESTE EXISTE: scripts/og-por-rota.mjs extrai title e description
 * das paginas por regex, para nao criar um arquivo de dados paralelo que alguem
 * esqueceria de atualizar. O preco dessa escolha e fragilidade: se alguem mudar
 * a formatacao do bloco Helmet de uma pagina, a extracao para de casar e a rota
 * volta a servir a casca, em silencio.
 *
 * Esse silencio e exatamente o modo de falha que ja custou caro neste repo, com
 * o prerender que sai com codigo 0 sem produzir nada e com o tsc que nao roda no
 * build da Lovable. Aqui a rede e este teste: se uma rota do sitemap parar de
 * resolver, o gate de pre-push barra antes do deploy.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { extrairMetaDasRotas } from "../../scripts/og-por-rota.mjs"

const BASE = "https://drjulianomachado.com"

function rotasDoSitemap(): string[] {
  const xml = readFileSync("public/sitemap.xml", "utf8")
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(BASE, "") || "/"
  )
}

describe("og por rota", () => {
  it("resolve todas as rotas do sitemap", async () => {
    const mapa = await extrairMetaDasRotas()
    const faltando = rotasDoSitemap().filter((r) => !mapa.has(r))

    expect(
      faltando,
      `Rotas sem title ou description extraidos, elas voltariam a servir a casca: ${faltando.join(", ")}`
    ).toEqual([])
  })

  it("nao deixa title nem description vazios", async () => {
    const mapa = await extrairMetaDasRotas()
    for (const [rota, meta] of mapa) {
      expect(meta.title.trim().length, `title vazio em ${rota}`).toBeGreaterThan(0)
      expect(
        meta.description.trim().length,
        `description vazia em ${rota}`
      ).toBeGreaterThan(0)
    }
  })

  it("nao deixa interpolacao nao resolvida escapar para a tag", async () => {
    const mapa = await extrairMetaDasRotas()
    for (const [rota, meta] of mapa) {
      const texto = `${meta.title} ${meta.description}`
      // Varias paginas escrevem {DOCTOR.name} no title. Se o resolvedor falhar,
      // a chave literal iria parar no <title> servido ao Google.
      expect(texto, `interpolacao nao resolvida em ${rota}`).not.toMatch(/\{|\}|\$\{/)
    }
  })

  it("mantem os titles dentro do que o Google exibe", async () => {
    const mapa = await extrairMetaDasRotas()
    const longos = [...mapa.entries()]
      .filter(([, meta]) => meta.title.length > 60)
      .map(([rota, meta]) => `${rota} (${meta.title.length})`)

    // Acima de 60 caracteres o Google corta o title no resultado. Nao e erro
    // tecnico, e perda de area clicavel, entao vale saber quando acontece.
    expect(
      longos,
      `Titles acima de 60 caracteres, serao cortados no resultado: ${longos.join(", ")}`
    ).toEqual([])
  })
})
