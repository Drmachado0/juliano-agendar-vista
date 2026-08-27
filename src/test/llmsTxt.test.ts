import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOCTOR } from "@/lib/constants";

/**
 * Guarda o `public/llms.txt` contra divergir do resto do site.
 *
 * POR QUE ESTE TESTE EXISTE: a comunicacao migrou para "mais de 15 anos"
 * (DOCTOR.yearsExperience) e o llms.txt ficou para tras anunciando 13. Nenhum
 * teste tocava neste arquivo, entao a divergencia sobreviveu a migracao que
 * corrigiu ate as meta tags estaticas do index.html.
 *
 * O estrago e especifico deste arquivo: llms.txt e o resumo que o site oferece
 * aos crawlers de IA como descricao autoritativa de si mesmo. Numero errado ali
 * nao e so texto desatualizado — e o site se contradizendo na fonte que um
 * modelo le primeiro para saber quem e o profissional.
 *
 * llms.txt NAO e alavanca de ranqueamento no Google Search (a documentacao do
 * Google diz explicitamente que nao ajuda nem atrapalha). Ele importa para os
 * demais crawlers e, sobretudo, por coerencia factual. Manter e barato; deixar
 * mentir sai caro.
 *
 * LIMITE DESTE TESTE: ele compara o llms.txt com as constantes e com o
 * sitemap. Nao verifica se a descricao de cada rota descreve a pagina de
 * verdade — isso continua sendo revisao humana.
 */
describe("public/llms.txt — coerencia com o resto do site", () => {
  const llms = readFileSync(resolve(process.cwd(), "public/llms.txt"), "utf-8");

  it("anuncia o tempo de atuacao que DOCTOR.yearsExperience define", () => {
    expect(llms).toContain(`mais de ${DOCTOR.yearsExperience} anos`);
  });

  it("nao carrega tempo de atuacao antigo", () => {
    // Qualquer "N anos" que nao seja o numero atual. Pega tanto o "13 anos" que
    // motivou este teste quanto o proximo valor a ficar para tras.
    const anos = [...llms.matchAll(/(\d{1,2})\s*anos/gi)].map((m) => Number(m[1]));
    const desatualizados = anos.filter((n) => n !== DOCTOR.yearsExperience);
    expect(desatualizados, `llms.txt cita ${desatualizados.join(", ")} anos`).toEqual([]);
  });

  it("cita o CRM exatamente como DOCTOR.crm", () => {
    expect(llms).toContain(DOCTOR.crm);
  });

  it("lista exatamente as rotas do sitemap", () => {
    // As duas listas sao mantidas a mao e descrevem a mesma superficie publica.
    // Rota nova entrando so no sitemap deixa o llms.txt incompleto; entrando so
    // no llms.txt, aponta para pagina que o site nao publica.
    const sitemap = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf-8");
    const base = "https://drjulianomachado.com";

    const rotasSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(base, "") || "/")
      .sort();
    const rotasLlms = [...llms.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)]
      .map((m) => m[1])
      .sort();

    expect(rotasLlms).toEqual(rotasSitemap);
  });
});
