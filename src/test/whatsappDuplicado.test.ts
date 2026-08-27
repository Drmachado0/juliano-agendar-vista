import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Guarda contra dois botoes de WhatsApp na mesma tela.
 *
 * POR QUE ESTE TESTE EXISTE: MobileStickyCTA traz um botao de WhatsApp na barra
 * fixa do mobile, e WhatsAppButton e um botao flutuante. Nas paginas que montam
 * os dois, eles apareciam empilhados — dois quadrados verdes identicos, um em
 * cima do outro, para a mesma acao.
 *
 * E foi a SEGUNDA vez que esse componente colidiu com outro CTA. A primeira foi
 * com o botao do hero, e gerou o `passouDoHero` que esta la ate hoje. Um padrao
 * que se repete merece teste, nao um terceiro comentario.
 *
 * A regra: quem monta MobileStickyCTA precisa passar `apenasDesktop` no
 * WhatsAppButton. A barra e lg:hidden e o flutuante vira hidden lg:flex, entao
 * existe exatamente um canal de WhatsApp em cada largura de tela.
 *
 * LIMITE DESTE TESTE: ele le o JSX como texto. Nao pega montagem indireta, do
 * tipo um componente intermediario que renderize um dos dois por dentro. Para o
 * uso atual, em que ambos sao montados diretamente nas paginas, e suficiente.
 */
describe("WhatsApp — um canal por largura de tela", () => {
  const raiz = process.cwd();

  function arquivosTsx(dir: string): string[] {
    const saida: string[] = [];
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) saida.push(...arquivosTsx(caminho));
      else if (nome.endsWith(".tsx") && !nome.endsWith(".test.tsx")) saida.push(caminho);
    }
    return saida;
  }

  const alvos = [
    ...arquivosTsx(resolve(raiz, "src/pages")),
    ...arquivosTsx(resolve(raiz, "src/components")),
  ];

  const comBarraFixa = alvos.filter((f) => {
    const s = readFileSync(f, "utf-8");
    // O proprio componente nao conta.
    return /<MobileStickyCTA[\s/>]/.test(s) && !f.endsWith("MobileStickyCTA.tsx");
  });

  it("existe ao menos uma pagina montando a barra fixa (senao o teste nao guarda nada)", () => {
    expect(comBarraFixa.length).toBeGreaterThan(0);
  });

  it("toda pagina com barra fixa passa apenasDesktop no botao flutuante", () => {
    const faltando: string[] = [];

    for (const f of comBarraFixa) {
      const s = readFileSync(f, "utf-8");
      const usos = [...s.matchAll(/<WhatsAppButton([^/>]*)\/?>/g)].map((m) => m[1]);
      if (!usos.length) continue; // so a barra, sem flutuante: nao ha colisao
      const semProp = usos.filter((atributos) => !/\bapenasDesktop\b/.test(atributos));
      if (semProp.length) faltando.push(f.replace(raiz, "").replace(/^[\\/]/, ""));
    }

    expect(
      faltando,
      `montam MobileStickyCTA e WhatsAppButton sem apenasDesktop: ${faltando.join(", ")}`,
    ).toEqual([]);
  });

  it("o botao flutuante aceita a prop que a regra exige", () => {
    const s = readFileSync(resolve(raiz, "src/components/WhatsAppButton.tsx"), "utf-8");
    expect(s).toMatch(/apenasDesktop/);
    // Sem isto a prop existiria sem efeito, e o teste acima passaria mentindo.
    expect(s).toMatch(/hidden lg:flex/);
  });
});

/**
 * Guarda a barra fixa contra voltar a ficar inerte sob o banner de cookies.
 *
 * POR QUE: o banner LGPD ocupa o mesmo rodape e fica por cima da barra. Medido
 * em producao com elementFromPoint, os DOIS botoes da barra tinham um BUTTON do
 * banner no ponto central — nao respondiam ao toque. So acontecia com quem
 * ainda nao decidiu os cookies, ou seja, o visitante de primeira viagem.
 *
 * Um CTA visivel e inerte nao aparece em teste de render nem em auditoria de
 * HTML: os elementos existem, tem tamanho e passam em qualquer contagem. Por
 * isso o guard e sobre a LIGACAO com a fonte de consentimento, que e o que
 * impede a barra de entrar cedo demais.
 */
describe("Barra fixa — espera a decisao de cookies antes de entrar", () => {
  const fonte = readFileSync(
    resolve(process.cwd(), "src/components/MobileStickyCTA.tsx"),
    "utf-8",
  );

  it("consulta a mesma fonte de consentimento que o banner", () => {
    expect(fonte).toMatch(/from\s+"@\/lib\/consent"/);
    expect(fonte).toMatch(/hasDecided/);
  });

  it("reage a decisao sem exigir recarregar a pagina", () => {
    expect(fonte).toMatch(/subscribeConsent/);
  });

  it("condiciona a entrada da barra a decisao, nao so ao scroll", () => {
    // Sem isto os imports existiriam sem efeito e os testes acima passariam
    // mentindo — foi assim que o defeito original sobreviveu a um comentario
    // que dizia evitar a sobreposicao.
    expect(fonte).toMatch(/show\s*&&\s*decidido/);
  });
});
