import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guarda /procedimentos contra deixar paginas filhas orfas.
 *
 * POR QUE ESTE TESTE EXISTE: a pagina existe para ser o hub dos procedimentos e
 * chegou a listar 6 de 11. Os cinco exames criados depois — retinografia,
 * tonometria, gonioscopia, biometria e iridotomia — foram registrados na rota,
 * no sitemap e no llms.txt, mas ninguem lembrou do indice. Ficaram alcancaveis
 * pela home e pelo sitemap, e inalcancaveis exatamente pela pagina cuja unica
 * funcao e leva-las.
 *
 * A falha e silenciosa por natureza: a pagina renderiza, os testes passam, o
 * build passa, e o unico sintoma e um link que ninguem escreveu. So aparece
 * numa auditoria que conte links, e ate la a pagina filha depende de sorte para
 * receber autoridade interna.
 *
 * O sitemap e a fonte da verdade porque e o que declara a superficie publica.
 * Rota de procedimento entrando la sem entrar aqui e, por definicao, orfa no
 * indice.
 *
 * LIMITE DESTE TESTE: ele confere que o link EXISTE, nao que o cartao descreve
 * a pagina corretamente nem que esta no grupo certo. Isso continua sendo
 * revisao humana.
 */
describe("/procedimentos — nenhuma pagina filha fica orfa no indice", () => {
  const indice = readFileSync(
    resolve(process.cwd(), "src/pages/procedimentos/Index.tsx"),
    "utf-8",
  );
  const sitemap = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf-8");
  const base = "https://drjulianomachado.com";

  const noSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(base, ""))
    .filter((r) => r.startsWith("/procedimentos/"))
    .sort();

  const noIndice = [...indice.matchAll(/link:\s*"(\/procedimentos\/[a-z-]+)"/g)]
    .map((m) => m[1])
    .sort();

  it("lista no indice exatamente as rotas de procedimento do sitemap", () => {
    const faltando = noSitemap.filter((r) => !noIndice.includes(r));
    const sobrando = noIndice.filter((r) => !noSitemap.includes(r));

    expect(faltando, `orfas no indice: ${faltando.join(", ")}`).toEqual([]);
    expect(sobrando, `apontam para rota fora do sitemap: ${sobrando.join(", ")}`).toEqual([]);
  });

  it("nao repete a mesma pagina em dois grupos", () => {
    const duplicadas = noIndice.filter((r, i) => noIndice.indexOf(r) !== i);
    expect(duplicadas, `duplicadas: ${duplicadas.join(", ")}`).toEqual([]);
  });

  it("cobre a quantidade que o sitemap declara", () => {
    // Redundante com o primeiro teste, mas faz a mensagem de falha dizer o
    // tamanho do buraco em vez de so listar rotas.
    expect(noIndice.length).toBe(noSitemap.length);
  });
});
