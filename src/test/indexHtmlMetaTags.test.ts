import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda o `index.html` contra a volta de tags que o react-helmet-async ja
 * injeta por rota.
 *
 * O helmet ANEXA suas tags em vez de substituir as que ja existem no HTML
 * estatico. Com uma canonical fixa apontando para a home, toda pagina passava a
 * servir DUAS canonicals em conflito — e o Google descarta o sinal inteiro
 * quando ha mais de uma. O mesmo valia para a description: a generica da home
 * vinha primeiro e vencia, descartando as especificas de cada pagina.
 *
 * og:description e twitter:description continuam estaticas de proposito: os
 * crawlers de WhatsApp, Facebook e Instagram nao executam JS, entao sao as
 * unicas que eles enxergam. Remove-las mata a previa de link.
 *
 * O empate entre "precisa ser estatica" e "nao pode duplicar" se resolve com
 * data-rh="true": o helmet REMOVE e repoe as tags que ja tem esse atributo, em
 * vez de anexar ao lado. Verificado no build real (18 rotas prerenderizadas,
 * 1 og:description cada, com o texto da rota e nao o generico da home).
 * So pode levar data-rh a tag que TODA rota redeclara — se o helmet apagar uma
 * que ninguem repoe, ela some da pagina. Por isso og:image e twitter:* ficam
 * de fora: nem toda rota os declara.
 *
 * LIMITE DESTE TESTE: ele so olha o HTML de entrada. Nao verifica se o helmet
 * esta de fato injetando no bundle de producao — isso exige renderizar o build
 * num navegador de verdade, e ja aconteceu de o helmet morrer em producao com a
 * suite de jsdom inteira passando.
 */
describe("index.html — tags que pertencem ao react-helmet-async", () => {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");
  // Comentarios sao removidos: eles explicam a regra e citam os nomes das tags.
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, "");

  it("não declara <link rel=canonical> estático", () => {
    const canonicals = semComentarios.match(/<link[^>]+rel=["']canonical["'][^>]*>/gi) ?? [];
    expect(canonicals).toEqual([]);
  });

  it("não declara <meta name=description> estático", () => {
    const descriptions = semComentarios.match(/<meta[^>]+name=["']description["'][^>]*>/gi) ?? [];
    expect(descriptions).toEqual([]);
  });

  it("mantém og:description e twitter:description, que os crawlers sociais leem sem JS", () => {
    expect(semComentarios).toMatch(/<meta[^>]+property=["']og:description["']/i);
    expect(semComentarios).toMatch(/<meta[^>]+name=["']twitter:description["']/i);
  });

  it("marca com data-rh as og que toda rota redeclara, para o helmet substituir", () => {
    // Sem o atributo o helmet anexa ao lado e o scraper le a primeira — a
    // estatica generica —, matando a versao especifica de cada rota.
    for (const prop of ["og:type", "og:title", "og:description", "og:url"]) {
      const tag = semComentarios.match(
        new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*>`, "i"),
      )?.[0];
      expect(tag, `${prop} ausente do index.html`).toBeTruthy();
      expect(tag, `${prop} sem data-rh: voltaria a duplicar`).toMatch(/data-rh=["']true["']/i);
    }
  });

  it("não marca com data-rh as tags que nem toda rota declara", () => {
    // og:image e twitter:* so existem em algumas rotas. Com data-rh, o helmet
    // apagaria no mount e ninguem reporia — a previa ficaria sem imagem/texto.
    const opcionais: Array<[string, string]> = [
      ["property", "og:image"],
      ["name", "twitter:image"],
      ["name", "twitter:description"],
    ];
    for (const [attr, valor] of opcionais) {
      const tag = semComentarios.match(
        new RegExp(`<meta[^>]+${attr}=["']${valor}["'][^>]*>`, "i"),
      )?.[0];
      expect(tag, `${valor} ausente do index.html`).toBeTruthy();
      expect(tag, `${valor} com data-rh: o helmet apagaria sem repor`).not.toMatch(/data-rh/i);
    }
  });

  it("não anuncia tempo de experiência desatualizado", () => {
    // A comunicacao migrou para "mais de 15 anos" (DOCTOR.yearsExperience).
    // As tags estaticas ficaram para tras com "+13 anos" e eram justamente as
    // que apareciam no snippet de busca e na previa de link do WhatsApp.
    expect(semComentarios).not.toMatch(/\+?13\s*\+?\s*anos/i);
  });
});
