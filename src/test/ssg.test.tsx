// @vitest-environment node

/**
 * POR QUE ESTE TESTE EXISTE: scripts/ssg.mjs gera o HTML servido a crawlers e ao
 * primeiro paint. Ele falha em silencio por design, rota que nao renderiza e
 * pulada e volta a servir a casca vazia. Isso e a escolha certa para nao
 * derrubar deploy, mas cria exatamente o modo de falha que ja custou caro neste
 * repo: o prerender sai com codigo 0 sem produzir nada, e o tsc nao roda no
 * build da Lovable.
 *
 * Aqui a falha vira barulho. Se alguem introduzir acesso a window durante o
 * render, ou quebrar o contrato de AppProvedores e AppConteudo em src/App.tsx, o
 * gate de pre-push barra antes do deploy em vez de o site voltar a servir casca
 * sem ninguem notar.
 *
 * AMBIENTE node, NAO jsdom: renderToPipeableStream escreve num Writable do Node.
 * Sob jsdom o teste passaria por motivo errado, ou falharia por motivo errado.
 */

import { describe, it, expect } from "vitest"
import { renderizarRota } from "../entry-server"

/** Amostra representativa: home, as duas cidades e um procedimento. */
const ROTAS = [
  "/",
  "/belem",
  "/paragominas",
  "/procedimentos/cirurgia-de-catarata",
]

function textoVisivel(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

describe("SSG das rotas publicas", () => {
  it.each(ROTAS)("renderiza %s com conteudo real", async (rota) => {
    const { html, helmet } = await renderizarRota(rota)

    // 1.500 caracteres e bem abaixo da menor rota real, que hoje tem 1.883.
    // O que este limite pega e o caso em que o React entrega so o fallback de
    // carregamento, que tem algumas dezenas de caracteres.
    expect(
      textoVisivel(html).length,
      `${rota} rendeu quase nada, provavelmente o fallback de Suspense`
    ).toBeGreaterThan(1500)

    expect(helmet.title, `${rota} sem title`).toContain("<title")
    expect(helmet.title.length, `${rota} com title vazio`).toBeGreaterThan(20)
  }, 30000)

  it("emite JSON-LD nas paginas de procedimento", async () => {
    const { helmet } = await renderizarRota("/procedimentos/cirurgia-de-catarata")

    // Sem isto, o HTML sai com o texto certo e sem dado estruturado, que e
    // justamente o que o Google usa para entender a entidade do medico.
    expect(helmet.script).toContain("application/ld+json")
  }, 30000)

  it("nao vaza a casca generica no lugar do title da rota", async () => {
    const { helmet } = await renderizarRota("/belem")

    // O bug que motivou tudo isto: as 18 rotas serviam o title da home.
    expect(helmet.title).toContain("Belém")
  }, 30000)
})
