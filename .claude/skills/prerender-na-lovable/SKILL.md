---
name: prerender-na-lovable
description: >
  Diagnosticar por que um passo pos-build (prerender, geracao de sitemap,
  qualquer coisa encadeada em `npm run build`) roda no build local mas nao
  produz efeito no site publicado pela Lovable. Use quando producao servir a
  casca da SPA em todas as rotas apesar do build local gerar HTML completo,
  quando um deploy "der certo" sem mudar nada visivel, ou quando for preciso
  saber se o host executa mesmo o script `build` do package.json. Carrega
  tambem o veredito ja apurado para a Lovable: o container de build nao tem as
  bibliotecas de sistema do Chromium, e nenhum ajuste de flag resolve - leia
  isso antes de tentar consertar de novo. RESOLVIDO em 28/08/2026 por SSG com
  renderToPipeableStream, sem navegador nenhum: nao reabra o prerender, leia a
  secao "Resolvido" logo no inicio. Use mesmo que o pedido nao cite "prerender" — vale para qualquer
  passo de build que falha em silencio num host fechado.
license: MIT
metadata:
  author: Juliano Machado
  version: "1.2"
---

# Diagnosticar passo de build que falha calado na Lovable

## Resolvido em 28/08/2026: o caminho que funcionou

**Nao tente mais fazer o Chromium rodar no container da Lovable.** O veredito
abaixo continua valido: falta biblioteca de sistema, e nenhuma flag resolve.

O problema real, producao servir casca vazia, foi resolvido por outro caminho,
que a propria secao "Veredito" ja indicava como saida: SSG sem navegador.

- `src/entry-server.tsx` renderiza cada rota com `renderToPipeableStream`
- `scripts/build-ssr.mjs` roda `vite build --ssr` sem poder derrubar o deploy
- `scripts/ssg.mjs` grava `dist/<rota>/index.html` com head e body prontos

Resultado medido em producao: as 18 rotas passaram de 9,8 KB sem texto para
45 a 143 KB com 1.883 a 6.726 caracteres de conteudo real e JSON-LD. O
`prerender-status.json` publicado continua dizendo `sem-chromium`, e agora isso
nao importa: o prerender virou um bonus para ambiente local, e o SSG cobre o
mesmo terreno em Node puro.

**Por que so foi possivel em 28/08 e nao antes.** O cabecalho de
`scripts/prerender.mjs` descartou SSR citando dois bloqueios reais: o
`BrowserRouter` na raiz e o Supabase junto do consent e do tracking. Os commits
de performance de 27/08 removeram os dois sem esse objetivo, `41a8839` passou o
Supabase para import dinamico e `811df9d` restringiu o `AuthProvider` as rotas
autenticadas. Sobrou separar o roteador em `AppProvedores` e `AppConteudo`.

**A licao generalizavel:** um veredito de "nao da" tem prazo de validade. Este
estava correto quando foi escrito e ficou obsoleto por trabalho feito com outro
proposito, sem ninguem revisitar a conclusao. Ao encontrar um "nao reabra
isto", confira se as premissas dele ainda valem antes de obedecer.

**Detalhes que custaram tempo, se for refazer em outro projeto:**

- `renderToPipeableStream`, nunca `renderToString`, quando as rotas usam
  `React.lazy`. O `renderToString` entrega o fallback de carregamento como se
  fosse o conteudo da pagina, que e pior do que nao gerar nada.
- Importe `StaticRouter` do mesmo pacote que o app usa. Se o app importa de
  `react-router-dom` e o entry de `react-router`, sob vitest viram instancias de
  modulo separadas e o render morre com "useLocation() may be used only in the
  context of a Router component".
- `ssr.noExternal: true` no vite.config resolve o interop de dependencia
  CommonJS, `react-helmet-async` falha com "Named export not found" sem isso.
- `manualChunks` e `modulePreload` valem so para o build de cliente. No build de
  SSR o Rollup rejeita com "react cannot be included in manualChunks".
- Colete `helmet.script`, nao so `meta` e `link`. E onde vive o JSON-LD. Esquecer
  gera HTML com o texto certo e zero dado estruturado, e passa despercebido.
- Sem hidratacao, de proposito. `createRoot().render()` substitui o conteudo do
  container, entao nao ha risco de erro de hidratacao. `hydrateRoot` exigiria
  paridade exata que um app com banner de consentimento e dados remotos nao tem.

Como descobrir, de fora, por que um passo encadeado em `npm run build` nao
surte efeito no site publicado — e como corrigir o caso ja resolvido aqui
(Chromium headless morrendo no container).

**Failure pattern:** falha suave silenciosa. O passo sai com codigo 0 quando o
ambiente nao o suporta, o deploy fica verde, e producao publica a casca de
~9 KB em todas as rotas. O build local passa porque *aqui* o Chromium existe.
Nada, em lugar nenhum, reporta a diferenca.

**Verified by:** `/prerender-status.json` respondeu `{"motivo":"sem-chromium"}`
com timestamp do servidor de build (2 min depois do build local, provando que
nao era o arquivo local viajando junto); o mesmo ramo foi reproduzido
localmente com `PLAYWRIGHT_BROWSERS_PATH` invalido; `tsc --noEmit` limpo e 587
testes passando em cada commit.

## Quando usar

- Producao serve o mesmo numero de bytes em toda rota, mas o `dist/` local tem
  HTML completo por rota.
- Um deploy "subiu" (hash do bundle mudou) e mesmo assim nada mudou no HTML cru.
- Precisa saber se a Lovable executa o script `build` do `package.json` ou o
  proprio `vite build`.
- Qualquer passo pos-build (sitemap, prerender, copia de asset) que some em
  producao sem erro.

## Procedimento

- [ ] 1. **Confirme o sintoma pelo HTML cru, com curl.** Nunca pelo DOM do
      navegador — ele executa JS e mostra o resultado montado, dando falso
      negativo. Compare bytes contra o `dist/` local:

      curl -s https://SEU-SITE/rota | wc -c        # producao
      wc -c < dist/rota/index.html                 # local

- [ ] 2. **Separe "arquivo ausente" de "host ignora o arquivo".** Peca o
      caminho explicito. A SPA devolve 200 ate para rota inexistente, entao
      **200 nao prova nada** — o que prova e o tamanho:

      curl -s https://SEU-SITE/rota/index.html     # 9 bytes "Not found" = nao existe
      curl -s https://SEU-SITE/index.html          # tamanho do shell = existe

      Confirme tambem que o host serve estatico aninhado (`/sitemap.xml`,
      `/fonts/*.woff2` -> 200). Se serve, o problema e o build, nao o host.

- [ ] 3. **Torne o passo mudo observavel.** Grave um JSON de status no diretorio
      de saida do build (`dist/`) em **toda** saida, inclusive nas que pulam.
      Publique. Depois leia de producao. A leitura responde a pergunta que
      nenhuma outra evidencia responde:

      - **arquivo AUSENTE** -> o host nao roda o script `build` do
        `package.json`; encadear ali nunca vai funcionar
      - **presente, com motivo** -> o host roda; o motivo diz o que falhou

- [ ] 4. **Inclua o texto do erro, nao so a categoria.** Um rotulo tipo
      `"sem-chromium"` nao distingue rede bloqueada de sandbox de dependencia
      faltando — e essas pedem condutas opostas. Guarde >= 700 caracteres.

- [ ] 5. **Leia a diferenca entre o primeiro e o segundo erro.** E o sinal mais
      informativo. Se o segundo erro (depois da tentativa de conserto) ja nao
      reclama do mesmo problema, o conserto funcionou e a falha e outra.

- [ ] 6. **Verifique em producao,** nao no build local. O build local mente por
      construcao: e o ambiente que tem o que falta la.

### Exemplo real

```
aoAbrir:  Executable doesn't exist at /opt/ms-playwright/chromium_.../chrome-headless-shell
aoBaixar: Target page, context or browser has been closed
          <launching> /opt/ms-playwright/chromium_.../chrome-headless-shell --disable-...
```

O segundo erro **ja nao** diz "Executable doesn't exist" e mostra `<launching>`
com o binario. Logo: o download funcionou, a rede nao esta bloqueada, a escrita
no cache funcionou, o prazo nao estourou. O Chromium abre e morre.

Isso parece sandbox e **nao e**. Capturando a CAUDA do log, a resposta apareceu:

```
[pid=565][err] chrome-headless-shell: error while loading shared libraries:
               libglib-2.0.so.0: cannot open shared object file
[pid=565] <process did exit: exitCode=127>
```

**Veredito para a Lovable: o container de build nao tem as bibliotecas de
sistema do Chromium.** As flags de container (`--no-sandbox` e companhia) foram
aplicadas e nao adiantaram — `exitCode=127` e falta de `.so`, nao sandbox.
Nenhum ajuste de flag resolve; `playwright install --with-deps` precisaria de
root e apt no container. As saidas reais sao empacotar um Chromium
auto-contido (ex. `@sparticuz/chromium`) ou trocar por SSG sem navegador.

## Gotchas

- **O timestamp no arquivo de status e o que prova de quem foi o build.** Sem
  ele nao da para distinguir seu `dist/` local do run do servidor. Compare com
  a hora do seu ultimo build local.
- **`dist/` e gitignored.** O arquivo de status so chega em producao pelo build
  do host — e por isso que ele funciona como prova.
- **A Lovable EXECUTA `npm run build` do `package.json`.** Confirmado
  empiricamente aqui. Saida em `dist/`, Node 22. Os docs dela nao dizem isso;
  o teste do passo 3 diz.
- **A Lovable serve arquivo estatico aninhado normalmente** (fontes, sitemap,
  llms.txt). Se o HTML por rota nao aparece, e porque o build nao gerou.
- **Fallback de SPA devolve 200 para qualquer caminho.** Um 200 nunca prova que
  a rota existe. Compare bytes.
- **`--no-sandbox` e seguro AQUI e so aqui:** o unico conteudo carregado e o
  proprio build, servido por um servidor local na mesma maquina. Nao ha pagina
  de terceiro, que e o que o sandbox existe para conter. Se o script um dia
  abrir URL externa, a flag sai junto.
- **`playwright` precisa estar em `dependencies`, nao `devDependencies`,** e
  listado em `trustedDependencies` (o bun bloqueia lifecycle script senao).
- **`exitCode=127` + `error while loading shared libraries` = falta dependencia
  de sistema, nao sandbox.** Nesse ponto pare de mexer em flag: nenhuma resolve.
- **Trunque o log pelas DUAS pontas, nunca so pelo comeco.** O erro do Chromium
  abre com centenas de caracteres de argumentos padrao e so depois traz a causa.
  Cortar pelo comeco guarda a parte inutil — foi o que me custou um deploy.
- **Args customizados sao anexados no FIM da lista da Playwright.** "--no-sandbox
  nao aparece no log" nao prova que nao foi passado; prova que o corte veio
  antes. Registre as flags explicitamente em vez de inferir.
- **Nao transforme a falha suave em falha dura.** Prerender e ganho, nao
  dependencia — nunca deve derrubar um deploy. O erro era ser *muda*, nao ser
  suave. Deixe barulhenta, nao fatal.
- **O hash do bundle nao mudar nao significa que o deploy nao subiu.** Mexer so
  em `scripts/` nao muda o bundle do Vite; use o timestamp do status.

## O que nao funcionou

- **Supor que a Lovable ignora o script `build`.** Era a hipotese principal e
  estava errada — o arquivo de status apareceu em producao com timestamp do
  servidor. Sem esse teste eu teria proposto migracao estrutural pra SSG em
  cima de palpite errado.
- **Supor CDN bloqueado / permissao / prazo estourado.** Descartadas de uma vez
  pelo segundo erro mostrar `<launching>` com o binario presente.
- **Planejar migracao para `vite-ssg` / SSR.** Foi descartado cedo demais. A
  frase original aqui dizia "desnecessario, eram tres flags". Estava errada: as
  tres flags nao resolveram nada, e em 28/08/2026 o SSG foi exatamente o que
  resolveu. O erro de julgamento foi tratar SSR como migracao estrutural cara
  sem medir o custo real, que acabou sendo separar o roteador e escrever um
  entry de servidor. Meca antes de descartar.
- **Culpar o prerender por deploys travados.** Reverter o prerender provou que
  o deploy continuava travado. Correlacao, nao causa.
- **As tres flags de container (`--no-sandbox`, `--disable-setuid-sandbox`,
  `--disable-dev-shm-usage`).** Hipotese razoavel — "abre e morre" e assinatura
  classica de sandbox — e errada aqui. Foram aplicadas, confirmado no log, e o
  processo morreu igual com exitCode=127 por falta de `libglib-2.0.so.0`.
- **Aumentar o limite de truncagem de 300 para 700 caracteres.** Nao resolveu
  porque o problema nao era o tamanho, era o lado: eu media a ponta errada.
- **Conferir tags de `<head>` pelo DOM do Chrome.** Da falso negativo: mede o
  resultado ja montado por JS. Use curl no HTML cru, ou Playwright.
