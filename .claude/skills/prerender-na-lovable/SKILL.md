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
  isso antes de tentar consertar de novo. Use mesmo que o pedido nao cite "prerender" — vale para qualquer
  passo de build que falha em silencio num host fechado.
license: MIT
metadata:
  author: Juliano Machado
  version: "1.1"
---

# Diagnosticar passo de build que falha calado na Lovable

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
- **Planejar migracao para `vite-ssg` / SSR.** Desnecessario. Eram tres flags.
  So considere se o erro apontar dependencia de sistema faltando no container.
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
