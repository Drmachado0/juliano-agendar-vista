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

  it("não anuncia tempo de experiência desatualizado", () => {
    // A comunicacao migrou para "mais de 15 anos" (DOCTOR.yearsExperience).
    // As tags estaticas ficaram para tras com "+13 anos" e eram justamente as
    // que apareciam no snippet de busca e na previa de link do WhatsApp.
    expect(semComentarios).not.toMatch(/\+?13\s*\+?\s*anos/i);
  });
});
