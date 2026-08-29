# Cobertura do SSG e ponto cego do monitor

**Data:** 28/08/2026. Apurado diretamente por mim, fora dos agentes especialistas.

O SSG entrou no ar hoje e resolveu o maior problema do site. Este arquivo trata dos dois efeitos colaterais que ele trouxe junto, e que ninguem mediu ainda porque a mudanca tem horas de vida.

## Como o SSG escolhe o que renderizar

`scripts/ssg.mjs`, linhas 60 a 63:

```js
const sitemap = await readFile(join(RAIZ, "public/sitemap.xml"), "utf8")
const rotas = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1].replace(BASE, "") || "/"
)
```

**O sitemap e a lista de rotas do SSG.** Rota que nao esta no `public/sitemap.xml` nao ganha HTML pre renderizado. E a rota `/` e escrita em `dist/index.html`, linhas 104 a 106:

```js
if (rota === "/") {
  await writeFile(join(DIST, "index.html"), final, "utf8")
}
```

`dist/index.html` e tambem o arquivo de fallback que a hospedagem serve para qualquer URL que o roteador estatico nao reconhece. Os dois fatos juntos produzem o achado abaixo.

---

## [High] Quatro rotas reais do app servem a home inteira, com `index, follow`

Estas rotas existem em `src/App.tsx` mas nao estao no sitemap, entao o SSG nao as renderizou, e o fallback entrega a home:

| Rota | Linha em App.tsx | O que deveria ser | O que o servidor devolve |
|---|---|---|---|
| `/paragominas/agendamento` | 137 | pagina real, `ParagominasAgendamento` | HTML da home, 147.248 bytes |
| `/agendar` | 132 | redirect para `/agendamento` | HTML da home, HTTP **200** |
| `/agendar-consulta` | 133 | redirect para `/agendamento` | HTML da home, HTTP **200** |
| `/obrigado` | 150 | pagina de obrigado, bloqueada no robots.txt | HTML da home |

Verificacao:

```
/paragominas/agendamento   200 147248b  index, follow  canonical=https://drjulianomachado.com/
/agendar                   200 147248b  index, follow  canonical=https://drjulianomachado.com/
/agendar-consulta          200 147248b  index, follow  canonical=https://drjulianomachado.com/
/obrigado                  200 147248b  index, follow  canonical=https://drjulianomachado.com/
```

Os 147.248 bytes sao **byte a byte identicos** a `/`.

Tres consequencias distintas:

1. **`/paragominas/agendamento` e uma pagina de conversao invisivel.** Ela existe, e especifica da cidade principal, e so aparece depois que o JS hidrata. Nenhum crawler sem execucao de JS a ve, e ela nao esta no sitemap, entao nem o Google tem por onde descobri-la.
2. **`/agendar` e `/agendar-consulta` nao redirecionam de verdade.** O `RedirectToAgendamento` e um componente React, roda no cliente. Para o servidor e para o crawler sao duas URLs respondendo 200 com o conteudo da home. Um redirect que existe so depois da hidratacao nao e um redirect, e uma pagina duplicada.
3. **O padrao vale para qualquer URL inventada.** `/rota-que-nao-existe-xyz`, `/procedimentos/inexistente`, `/qualquer-coisa`, todas devolvem a home completa com 200.

### O que mudou hoje, e a parte contraintuitiva

Antes do SSG, uma URL desconhecida devolvia a casca neutra de 9,8 KB, sem h1 e sem texto. Era um soft 404 pobre, mas inofensivo, porque nao havia conteudo para duplicar.

Depois do SSG, a mesma URL devolve **uma copia completa e indexavel da home**. O SSG melhorou as 18 rotas e, pelo mesmo mecanismo, transformou o fallback em conteudo duplicado de verdade.

O `rel=canonical` apontando para `/` segura o pior caso, e por isso este achado e High e nao Critical. O Google deve consolidar em `/`. O custo residual e real: rastreamento gasto em URLs que nao existem, e relatorio de Cobertura do Search Console se enchendo de "Duplicada, o Google escolheu um canonical diferente" ou de soft 404.

*Correcao, em ordem de valor:*
1. Colocar `/paragominas/agendamento` no `public/sitemap.xml`. Isso sozinho faz o SSG renderiza-la, porque o sitemap e a lista de rotas. Uma linha resolve uma pagina de conversao invisivel.
2. Trocar `/agendar` e `/agendar-consulta` por redirect 301 de servidor, na configuracao da hospedagem, em vez de componente React.
3. Fazer o fallback de URL desconhecida servir uma pagina de 404 com `<meta name="robots" content="noindex">`, em vez da home. Se a hospedagem permitir status 404 de verdade, melhor ainda.

*Como saber se falhou:* `curl -s -o /dev/null -w "%{http_code}" https://drjulianomachado.com/rota-inexistente` deve parar de devolver a home. E `/paragominas/agendamento` precisa passar a ter h1 proprio no HTML cru, sem JS.

*Indicador para acompanhar sem refazer auditoria:* o relatorio de Cobertura no Search Console, contagem de "Duplicada" e de "Soft 404". Se subir nas proximas semanas, e este achado se materializando.

---

## [Medium] O monitor le o arquivo do pipeline morto

`scripts/monitorar-seo.mjs`, linha 80:

```js
const r = await fetch(`${BASE}/prerender-status.json`).catch(() => null);
```

Mas o pipeline vivo escreve outro arquivo. Os dois estao no ar agora:

| Arquivo | Escrito por | Estado atual |
|---|---|---|
| `/prerender-status.json` | `scripts/prerender.mjs`, Playwright, **morto** | `"motivo": "sem-chromium"`, carimbo 2026-08-28T22:24:56Z |
| `/ssg-status.json` | `scripts/ssg.mjs`, Node puro, **vivo** | 18 rotas escritas, carimbo 2026-08-28T22:24:32Z |

O `prerender-status.json` continua sendo gerado a cada build e continua, corretamente, reportando que o Chromium nao existe no container da Lovable. So que isso deixou de importar: o SSG nao usa navegador nenhum.

Resultado pratico: `npm run monitorar:seo` esta vigiando um pipeline aposentado. Ele vai reportar falha para sempre, o que treina quem le a ignorar o alarme, e ao mesmo tempo **nao detecta regressao do SSG de verdade**. Se amanha uma rota entrar na lista de `puladas` do `ssg-status.json`, o monitor nao ve.

*Correcao:* apontar o monitor para `/ssg-status.json` e fazer a checagem falhar quando `puladas` nao estiver vazio ou quando `escritas.length` for menor que o numero de `<loc>` do sitemap. Depois, remover o `scripts/prerender.mjs` e o `prerender-status.json` do build, ou o proximo leitor vai tropecar neles de novo.

*Como saber se falhou:* rodar `npm run monitorar:seo` e conferir que ele reporta 18 rotas escritas, nao "sem-chromium".

---

## [Info] O sitemap acumulou uma segunda funcao

O `public/sitemap.xml` era um arquivo de descoberta para buscadores. Desde hoje ele e tambem a lista de rotas do SSG e, por `scripts/indexnow.mjs`, a fonte do IndexNow.

Isso e economia de configuracao e tem logica: uma lista so, tres consumidores. Vale registrar porque muda o custo de errar. Esquecer uma rota no sitemap agora nao significa mais so "o Google demora a achar", significa "a pagina nao existe para quem nao executa JS". O comentario em `scripts/atualizar-lastmod.mjs` ja avisa que aquele script nao decide quais URLs entram no sitemap. Ninguem decide. E manual.

*Sugestao:* um teste que compare as rotas publicas do `src/App.tsx` com os `<loc>` do sitemap e falhe na divergencia. O repo ja tem o precedente, `src/test/procedimentosIndex.test.ts` guarda o indice de procedimentos contra o sitemap.

---

## [High] O SSG renderiza 57 respostas de FAQ como divs vazias

Levantado pelo agente de GEO, quantificado por mim.

O acordeao de FAQ usa Radix. No servidor, um `AccordionContent` fechado renderiza a regiao com `hidden=""` e **sem conteudo dentro**. A resposta nao entra no HTML estatico.

Amostra de `/procedimentos/cirurgia-de-catarata`, note o `></div>` colado:

```html
<div data-state="closed" id="radix-:R9ktaj:" hidden="" role="region"
     aria-labelledby="radix-:R1ktaj:" class="overflow-hidden text-sm ..."></div>
```

Contagem, regioes de acordeao vazias no HTML pre renderizado:

| Rota | Vazias |
|---|---|
| `/procedimentos/biometria-ultrassonica` | 6 de 6 |
| `/procedimentos/gonioscopia` | 6 de 6 |
| `/procedimentos/iridotomia-a-laser` | 6 de 6 |
| `/procedimentos/mapeamento-de-retina` | 6 de 6 |
| `/procedimentos/retinografia` | 6 de 6 |
| `/procedimentos/tonometria` | 6 de 6 |
| `/procedimentos/cirurgia-de-catarata` | 5 de 5 |
| `/procedimentos/cirurgia-de-pterigio` | 5 de 5 |
| `/procedimentos/consulta-oftalmologica` | 5 de 5 |
| `/paragominas` | 4 de 4 |
| `/procedimentos/capsulotomia-yag-laser` | 1 de 1 |
| `/procedimentos/glaucoma` | 1 de 1 |
| `/` | 0 |
| `/belem` | 0 |

**57 respostas** que existem no site e nao existem no HTML servido.

O que isso custa, em ordem de peso:

1. **Extracao por IA.** A resposta para "quanto tempo dura a cirurgia de catarata" so existe dentro do JSON-LD do FAQPage. Extrator que le corpo de pagina nao ve nada. Isso anula, nessas 12 rotas, boa parte do ganho que o SSG acabou de entregar.
2. **Peso de conteudo.** As paginas de procedimento tem entre 609 e 860 palavras de corpo. As respostas de FAQ eram parte do que sustentava a profundidade delas, e no HTML servido nao contam.
3. **O Google nao perde.** Ele executa JS e hidrata, entao ve as respostas. Este achado e sobre tudo que nao executa.

A prova de que e bug e nao decisao esta na propria tabela: `/` e `/belem` trazem as respostas visiveis no HTML. Duas rotas fazem certo, doze fazem errado.

*Correcao:* passar `forceMount` no `AccordionContent` e esconder por CSS em vez de nao renderizar, que e o padrao recomendado do Radix para SSR. Alternativa mais robusta: emitir a FAQ como `<details>` nativo, que ja nasce no HTML, com o acordeao como melhoria progressiva.

*Como saber se falhou:* `curl -s <url> | grep -c 'hidden=""[^>]*></div>'` tem que devolver 0 nas 12 rotas. E o texto de uma resposta conhecida precisa aparecer no corpo, nao so no JSON-LD.

*Dependencia:* independente das outras correcoes. Nao espera nada.
