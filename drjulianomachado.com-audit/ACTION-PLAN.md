# Plano de acao, drjulianomachado.com

**Data:** 28/08/2026 · **Health Score:** 66/100

Ordenado por valor sobre esforco, com as dependencias explicitas. Cada item traz como saber se falhou, para nao depender de refazer a auditoria.

---

## O que a rodada de 27/08/2026 ja fechou

Nenhuma fase do plano anterior precisa ser repetida. O plano de 27/08 esta arquivado em `ACTION-PLAN-2026-08-27.md`. Situacao de cada fase dele, conferida hoje contra o site publicado e contra o repositorio:

| Fase antiga | Situacao | Como conferi |
|---|---|---|
| **1. Ganhos rapidos** | Fechada | As 18 paginas com titulo entre 45 e 59 caracteres e description entre 111 e 160. O `alt` de `/paragominas` segue correto como decorativo. |
| **2. Conteudo** | Fechada | `/procedimentos` saiu de 170 palavras para 609, acima das 433 registradas na epoca. O indice linka para as 11 filhas. `procedimentosIndex.test.ts` e `llmsTxt.test.ts` existem e `/llms.txt` responde 200. |
| **2b. Supabase fora do caminho critico** | Fechada, por outro caminho | Os dois itens literais nao foram executados, mas o objetivo foi atingido. Hoje so `react` e `query` estao em `modulepreload`. Os commits 41a8839 e 811df9d, feitos para viabilizar o SSR, tiraram o Supabase da largada. O bundle de 46,7 KB ainda baixa, mas nao disputa mais banda no inicio. |
| **3. Decisao estrutural** | Superada | A decisao era "aceitar a casca". Ela foi revertida em 28/08 pela saida que o proprio documento listava como segunda opcao, SSG sem navegador. O gatilho de reabertura perdeu objeto. |
| **4. Monitoramento** | Fechada, com uma consequencia | `npm run monitorar:seo` existe e usa `queryHistoryRecord`. O item aberto "ligar o Search Console por conta de servico" esta feito, e foi o que permitiu os dados reais desta auditoria. A consequencia e o item 1.5 abaixo: o monitor agora aponta para o arquivo do pipeline aposentado. |

**Uma correcao antiga que foi neutralizada a montante.** A Fase 2 de 27/08 tirou cinco exames orfaos ligando o indice a 11 paginas filhas, e isso funcionou, `/procedimentos` de fato linka para as 11. So que a medicao de hoje mostra que `/procedimentos` recebe **1 unico link interno**. Os 11 links de saida partem de uma pagina que ninguem alcanca. Os itens 1.3 e 2.2 deste plano consertam o lado que faltava.

**Por que o plano de hoje e quase todo novo.** Ele foi construido sobre medicoes que eram impossiveis ate ontem. Enquanto o servidor entregava uma casca de 9,8 KB, nao havia links internos, grafo de schema, texto de FAQ nem conformidade de publicidade para medir. Nenhum item abaixo e repeticao.

---

## Fase 0: FEITA em 29/08/2026, por decisao do medico

Os dois itens eram decisao dele e nao recomendacao tecnica. Ele decidiu ajustar
conforme a norma, e a execucao ficou comigo.

Base: Resolucao CFM 1.974/2011 e Codigo de Etica Medica, que restringem imagem
de antes e depois e depoimento de paciente em publicidade medica.

### Antes e depois na home

- [x] Duas fotos de um caso real, retroiluminacao do mesmo olho antes e depois
      do YAG laser, sob o titulo "Antes e depois", com as legendas "Visao
      embacada" e "Visao mais nitida". O aviso de que o resultado varia nao
      descaracteriza a comparacao.

**A solucao ja existia no proprio repositorio.** A pagina da capsulotomia usa
`components/procedimentos/yag/YagAntesDepois.tsx`, que e ilustracao esquematica
original, nao foto de paciente, e diz isso na legenda. Alguem ja tinha resolvido
o problema la. Exportei o `OlhoRetroiluminado` de dentro dele e a home passou a
usar a mesma ilustracao. Zero design novo.

As legendas tambem mudaram. "Visao embacada" e "Visao mais nitida" eram promessa
de resultado, e viraram descricao da anatomia.

### Depoimentos de paciente, e o alcance era maior

- [x] O medico escolheu tirar **tudo que exibe nome de paciente**, nao so os
      tres itens que a auditoria tinha marcado.

Onde estavam:

| Arquivo | O que exibia |
|---|---|
| `components/TestimonialsSection.tsx` | carrossel com nome, foto, nota e texto, na home e em 12 paginas de procedimento |
| `pages/Agendamento.tsx` | carrossel de tres depoimentos no funil |
| `pages/Agendamento.tsx` | **um quarto**, cravado no JSX da barra lateral |
| `pages/Paragominas.tsx` | uma avaliacao em destaque e duas na coluna lateral |

**O quarto quase escapou.** Tres estavam num array chamado `DEPOIMENTOS`, faceis
de achar. O quarto estava escrito a mao no JSX, e so apareceu ao procurar os
nomes no HTML GERADO depois de remover os outros. Buscar no fonte teria dado
tudo limpo. Se for procurar residuo um dia, procure na saida.

### O que ficou de proposito

A nota agregada, 5,0 com 111 avaliacoes, mais o link para o Google. Agregado nao
reproduz relato de paciente identificado: e dado publico do perfil, e quem
quiser ler o relato le no Google, sob a responsabilidade do Google.

*Verificado no `dist`:* nenhum nome de paciente em nenhuma das 23 rotas, nenhuma
ocorrencia de "Antes e depois", e as fotos `yag-antes.webp` e `yag-depois.webp`
sairam do build. A nota agregada continua nas paginas que a exibiam.

*Se a leitura da norma mudar um dia,* o carrossel, a paginacao, o auto-rotate, o
pool do Supabase e o tipo `Testimonial` estao no commit desta data.

---

## O que a rodada de 27/08/2026 ja fechou

Nenhuma fase do plano anterior precisa ser repetida. O plano de 27/08 esta arquivado em `ACTION-PLAN-2026-08-27.md`. Situacao de cada fase dele, conferida hoje contra o site publicado e contra o repositorio:

| Fase antiga | Situacao | Como conferi |
|---|---|---|
| **1. Ganhos rapidos** | Fechada | As 18 paginas com titulo entre 45 e 59 caracteres e description entre 111 e 160. O `alt` de `/paragominas` segue correto como decorativo. |
| **2. Conteudo** | Fechada | `/procedimentos` saiu de 170 palavras para 609, acima das 433 registradas na epoca. O indice linka para as 11 filhas. `procedimentosIndex.test.ts` e `llmsTxt.test.ts` existem e `/llms.txt` responde 200. |
| **2b. Supabase fora do caminho critico** | Fechada, por outro caminho | Os dois itens literais nao foram executados, mas o objetivo foi atingido. Hoje so `react` e `query` estao em `modulepreload`. Os commits 41a8839 e 811df9d, feitos para viabilizar o SSR, tiraram o Supabase da largada. O bundle de 46,7 KB ainda baixa, mas nao disputa mais banda no inicio. |
| **3. Decisao estrutural** | Superada | A decisao era "aceitar a casca". Ela foi revertida em 28/08 pela saida que o proprio documento listava como segunda opcao, SSG sem navegador. O gatilho de reabertura perdeu objeto. |
| **4. Monitoramento** | Fechada, com uma consequencia | `npm run monitorar:seo` existe e usa `queryHistoryRecord`. O item aberto "ligar o Search Console por conta de servico" esta feito, e foi o que permitiu os dados reais desta auditoria. A consequencia e o item 1.5 abaixo: o monitor agora aponta para o arquivo do pipeline aposentado. |

**Uma correcao antiga que foi neutralizada a montante.** A Fase 2 de 27/08 tirou cinco exames orfaos ligando o indice a 11 paginas filhas, e isso funcionou, `/procedimentos` de fato linka para as 11. So que a medicao de hoje mostra que `/procedimentos` recebe **1 unico link interno**. Os 11 links de saida partem de uma pagina que ninguem alcanca. Os itens 1.3 e 2.2 deste plano consertam o lado que faltava.

**Por que o plano de hoje e quase todo novo.** Ele foi construido sobre medicoes que eram impossiveis ate ontem. Enquanto o servidor entregava uma casca de 9,8 KB, nao havia links internos, grafo de schema, texto de FAQ nem conformidade de publicidade para medir. Nenhum item abaixo e repeticao.

---

## Fase 0: decisao do medico, nao do desenvolvedor

**Prazo: antes de qualquer outra coisa, porque muda o que sera construido**

- [ ] **Secao "Antes e depois" na home.** Fotos do mesmo olho antes e depois do YAG laser. Resolucao CFM 1.974/2011 e art. 112 do Codigo de Etica. Decidir: manter, remover, ou substituir por ilustracao esquematica sem foto de paciente.
- [ ] **Tres depoimentos com nome completo em `/agendamento`.** Fernanda Cruz, Jessica Oliveira da Costa, Gislene Alves da Silva. Vedado mesmo com origem em avaliacao publica do Google. Decidir: remover, anonimizar, ou trocar por nota agregada sem texto de paciente.

Nao ha recomendacao tecnica aqui. Se a decisao for manter, o resto do plano segue igual, e este risco fica registrado. Se for remover, os itens de conteudo abaixo mudam de escopo.

Evidencia em `findings/content-quality.md`.

---

## Fase 1: uma linha cada, alto retorno

**FEITA em 28/08/2026.** Build completo passou, `SSG: 20 rotas com HTML completo`, e as 603 verificacoes da suite passaram sem falha. Nada foi commitado, as mudancas estao na arvore de trabalho em `main`.

> **Um item mudou de forma na execucao.** O 1.2 mandava por `/paragominas/agendamento` no sitemap. Isso estava **errado**: a pagina declara `<meta name="robots" content="noindex,follow">` de proposito, e URL noindex em sitemap e sinal contraditorio. O objetivo do item, fazer a pagina existir em HTML, foi atingido separando as duas listas no `scripts/ssg.mjs`. Detalhe no item.

Resultado medido no `dist/` gerado:

| Rota | Links internos antes | Depois |
|---|---|---|
| `/procedimentos` | 1 | **11** |
| `/paragominas` | 2 | 3 |

O hub saiu de 1 para 11 porque as 11 paginas de procedimento agora apontam para ele pelo breadcrumb. Eu havia previsto 12 no criterio de falha, contando em dobro a `capsulotomia-yag-laser`, que ja linkava. O numero certo e 11. `/paragominas` so chega a 18 com o item 2.2, a navegacao global, que e Fase 2.

- [x] **1.1 FEITO. Corrigir "Instituto de Olhos da Bahia".** `src/pages/PoliticaPrivacidade.tsx:68`. O nome correto, em `src/lib/locations.ts:64`, e "Instituto de Olhos de Belem". Esta na secao "Controlador dos dados" da politica LGPD, que e onde a lei exige identificar onde o dado e tratado. `Vitria` esta correto, e o nome real da unidade.

  *Falhou se:* o texto publicado ainda disser Bahia.

- [x] **1.2 FEITO, por outro caminho. Separar a lista de rotas do SSG da lista do sitemap.**

  *O que o item dizia, e por que estava errado:* mandava por `/paragominas/agendamento` no `public/sitemap.xml`, ja que o sitemap e a lista de rotas do SSG. So que a pagina declara `<meta name="robots" content="noindex,follow">` de proposito, ela e um funil de agendamento e nao pagina de conteudo. Sitemap com URL noindex e sinal contraditorio para o Google. Executar o item como escrito teria trocado um problema por outro.

  *A inversao que estava acontecendo:* sem HTML proprio, a rota caia no fallback da SPA, que desde o SSG e a home inteira, servida com `index, follow`. A pagina pedia noindex e o servidor respondia index. A intencao chegava invertida a quem nao executa JS.

  *O que foi feito:* `scripts/ssg.mjs` passou a ter duas listas. O sitemap responde "o que eu quero que o Google indexe", e uma constante `ROTAS_EXTRA` responde "o que precisa existir em HTML para quem nao executa JS". `/paragominas/agendamento` e `/obrigado` entraram na segunda. `/agendar` e `/agendar-consulta` ficaram de fora de proposito, elas nao sao paginas, sao redirects, e o lugar delas e o 301 de servidor do item 2.7.

  *Verificado:* build gerou `dist/paragominas/agendamento/index.html` com 27.585 bytes e `noindex,follow` no HTML cru, e `dist/obrigado/index.html` com 14.400 bytes. O `ssg-status.json` agora registra `doSitemap: 18` e `extras`, o que da ao monitor um numero para conferir.

- [x] **1.3 FEITO. Corrigir o breadcrumb do hub.** Trocar `/#procedimentos` por `/procedimentos` em `src/components/procedimentos/ProcedurePageLayout.tsx:72` (JSON-LD) e `:167` (HTML), e em `src/pages/procedimentos/CapsulotomiaYagLaser.tsx:89`.

  *Falhou se:* a contagem de links internos para `/procedimentos` nao sair de 1 para 12.

- [x] **1.4 FEITO. Corrigir o h1 de `/paragominas`.** `src/pages/Paragominas.tsx:364`. De "Sua visao,com mais clareza." para "Oftalmologista em Paragominas", simetrico com `/belem`. **Atencao:** `src/pages/Paragominas.test.tsx:61` guarda o texto atual e vai quebrar. Atualize o teste junto.

  *Falhou se:* o teste passar sem ter sido alterado, sinal de que voce nao mexeu na fonte do h1.

- [x] **1.5 FEITO. Apontar o monitor para o arquivo certo.** `scripts/monitorar-seo.mjs:80` le `prerender-status.json`, do pipeline Playwright aposentado, que reporta falha para sempre. O pipeline vivo escreve `ssg-status.json`.

  *Feito alem do previsto:* `scripts/prerender.mjs` saiu do encadeamento de `build` no `package.json`. Ele era o ultimo passo, tentava subir um Chromium que nao existe no container da Lovable, falhava, e gravava o `prerender-status.json` enganoso. O arquivo do script continua no repositorio pelo valor do cabecalho dele, so nao roda mais. Confirmado: `dist/prerender-status.json` nao e mais gerado.

  *O monitor tambem ganhou dente:* rota na lista `puladas` do SSG agora e regressao, codigo de saida 1. Antes, rota pulada voltava a servir casca em silencio, que e o modo de falha por design do `ssg.mjs`.

  *Um comentario obsoleto foi corrigido junto:* a secao da CrUX explicava campo ruim como "SPA sem prerender no host, decisao registrada foi aceitar". Essa causa deixou de existir em 28/08. O texto novo diz que a serie da CrUX e esparsa e leva semanas para refletir a mudanca.

---

## Fase 2: as correcoes que destravam o SSG de verdade

**FEITA em 28/08/2026, com uma excecao.** 5 itens completos, 1 parcial, 1 bloqueado por depender de configuracao de host. Build passou com `SSG: 21 rotas com HTML completo` e as 603 verificacoes da suite passaram. Nada commitado.

### Resultado medido

Palavras no corpo servido, antes e depois do item 2.1:

| Pagina | Antes | Depois |
|---|---|---|
| `/procedimentos/capsulotomia-yag-laser` | 1524 | 2134 |
| `/procedimentos/glaucoma` | 1149 | 1670 |
| `/procedimentos/mapeamento-de-retina` | 860 | 1362 |
| `/procedimentos/cirurgia-de-catarata` | 762 | 1230 |
| `/procedimentos/tonometria` | 689 | 1156 |
| `/procedimentos/consulta-oftalmologica` | 609 | 1061 |

Regioes de acordeao vazias: **57 para 0**.

Links internos, depois do item 2.2:

| Rota | Antes | Depois |
|---|---|---|
| `/paragominas` | 2 | **17** |
| `/procedimentos` | 1 | **16** |
| `/belem` | 16 | 16 |
| `/procedimentos/glaucoma` | 17 | 17 |

Nao chegou a 18 porque `/auth` nao carrega a navegacao do site e nenhuma pagina linka para si mesma. Belem e glaucoma nao perderam nada, que era a condicao para a troca valer.

### Tres itens que a execucao provou errados

Vale registrar, porque os tres nasceram de medir do lado de fora sem abrir o codigo.

**2.4 nao era elemento de LCP.** A imagem de `/agendamento` vive dentro de `<aside className="sticky top-24 hidden self-start lg:flex">`. Ela **nao renderiza no mobile**, e no desktop fica na coluna lateral. O `loading="lazy"` estava certo e ficou. Tambem nao havia risco de CLS, porque `h-64 w-full` ja determina a caixa. O que sobrou de real foi o formato, JPG de 122.380 bytes onde existia WebP de 62.634.

**2.5 estava metade errado.** A hero de `/paragominas` ja era responsiva desde antes, com `<picture>` e `<source srcSet>` de 900w e 1400w. Minha contagem original so olhou tags `<img>` e nao viu o `<source>`. Sobrou so `/agendamento`, que agora tem tres variantes, 540w, 900w e 1400w.

**2.6 tinha o diagnostico trocado.** `src/pages/NotFound.tsx` ja emitia `noindex, follow`, com comentario explicando o problema. O buraco real era outro e mais interessante, esta descrito no item.

---

**Prazo original: proximas duas semanas**

> **Por que esta fase e a que importa.** O Search Console mostra que **11 das 18 paginas tiveram zero impressao em tres meses**. As mesmas paginas que o proprio site quase nao linka: seis paginas de procedimento com 2 links internos cada, o hub com 1, `/paragominas` com 2. Os itens 2.1 e 2.2 atacam exatamente isso.
>
> *Hipotese falsificavel:* se apos a Fase 2 o numero de paginas com zero impressao nao cair, o problema nao era link interno, e a proxima suspeita passa a ser demanda de busca insuficiente para esses termos em Paragominas e Belem.

- [x] **2.1 FEITO. FAQ no HTML servido.** 57 respostas hoje sao div vazia no HTML pre renderizado, nas 11 paginas de procedimento e em `/paragominas`. Passar `forceMount` no `AccordionContent` e esconder por CSS, que e o padrao Radix para SSR. Alternativa mais robusta: `details` nativo com o acordeao como melhoria progressiva.

  *Por que importa:* e o item que mais devolve valor ao SSG que acabou de entrar. `/` e `/belem` ja fazem certo, entao existe referencia dentro do proprio repositorio.

  *Feito:* `forceMount` no `AccordionPrimitive.Content` em `src/components/ui/accordion.tsx`. O CSS ja estava preparado, `data-[state=closed]:h-0` com `overflow-hidden`, e o comentario do arquivo ja explicava por que. So faltava a prop.

  *Guardado por teste:* `src/test/ssg.test.tsx` ganhou "as respostas de FAQ saem no corpo, nao so no JSON-LD". Ele verifica que nao ha regiao vazia e que o texto de uma resposta conhecida esta no corpo. Confirmei que ele falha de verdade removendo o `forceMount` e rodando, com a mensagem certa. Teste que nao falha quando o bug volta nao serve para nada.

  *Por que o teste antigo nao pegava:* `ssg.test.tsx` ja exigia mais de 1.500 caracteres de texto por rota, e as paginas tinham texto de sobra fora do FAQ. So a ausencia especifica da resposta denunciava.

- [x] **2.2 FEITO. Paragominas na navegacao global.** `src/components/Header.tsx:28` tem Belem com `href` e nao tem Paragominas. E o item "Procedimentos" da linha 23 e ancora de rolagem, sem `href` para o hub.

  *Dependencia:* fazer junto com o item 1.3. Os dois alimentam o mesmo hub. Separados, cada um entrega metade.

  *Falhou se:* `/paragominas` nao sair de 2 para 18 links internos e `/procedimentos` de 1 para 18.

- [x] **2.3 FEITO. Telefone clicavel em `/paragominas`.** Os numeros da Clinicor e do Hospital Geral existem, mas so dentro do JSON-LD. `/belem` ja faz certo, com link `tel:` e botao de rota por unidade. Replicar.

  *Falhou se:* nao houver link `tel:` no HTML de `/paragominas`.

- [x] **2.4 FEITO, com o diagnostico corrigido. Imagem de `/agendamento`.** `src/pages/Agendamento.tsx:29` importa o `.jpg` de 122.380 bytes, e a linha 749 aplica `loading="lazy"`. Trocar pelo WebP de 62.634 bytes que a home ja usa, tirar o lazy, por `fetchpriority="high"`, declarar `width` e `height`. Lazy no elemento de LCP e a forma mais direta de atrasar o LCP.

  *Falhou se:* o LCP de laboratorio de `/agendamento` no mobile nao melhorar. Se nao melhorar, o elemento de LCP nao e essa imagem, e a hipotese cai.

  *Faltou metade, achado na revisao de 29/08:* `src/pages/ParagominasAgendamento.tsx` continuava importando o mesmo JPG de 122.380 bytes, e o exibia como avatar de 64 por 64 pixels. Eu tinha corrigido a pagina e esquecido a irma. Trocado pela variante de 540w, 32.246 bytes. Ela era o ultimo consumidor do JPG, entao o arquivo saiu do `dist` inteiro.

- [x] **2.5 FEITO, so onde faltava. `srcSet` nas heros de `/paragominas` e `/agendamento`.** A variante de 540w ja existe em disco. A home ja aplica o padrao completo. E trabalho de atributo, nao de pipeline.

  *Falhou se:* PageSpeed mobile continuar listando "Properly size images".

- [x] **2.6 PARCIAL, e o diagnostico estava trocado. URL desconhecida e rotas de servico com `noindex`.**

  *O que eu supunha:* que faltava emitir `noindex` para rota inexistente.

  *O que era:* `src/pages/NotFound.tsx` **ja emitia** `noindex, follow`, e ate com um comentario descrevendo o problema. O buraco real eram duas outras coisas.

  A primeira: `src/pages/Auth.tsx` nao tinha `<Helmet>` nenhum. Nenhuma tag de robots, entao herdava o `index, follow` do HTML de fallback, que e a home.

  A segunda, e a que explica as impressoes no Search Console: `/auth` e `/obrigado` estavam em `Disallow` no `robots.txt`. **Bloquear rastreio nao remove do indice.** URL em Disallow pode ser indexada so pelo endereco, sem conteudo, e o Google nunca entra para ler o `noindex` que resolveria. Era o motivo de `/auth/` aparecer com impressoes: nao apesar do bloqueio, e sim por causa dele.

  *Feito, em tres partes que so funcionam juntas:*
  1. `Helmet` com `noindex, follow` em `src/pages/Auth.tsx`
  2. `/auth` entrou em `ROTAS_EXTRA` no `scripts/ssg.mjs`, para a tag estar no HTML cru e nao so apos a hidratacao
  3. `/auth` e `/obrigado` sairam do `Disallow` em `public/robots.txt`, com um comentario no arquivo explicando por que nao devem voltar. `/admin/` continua bloqueada, la o objetivo e poupar rastreio e nunca houve impressao.

  *O que ficou de fora:* o fallback de URL totalmente inventada, tipo `/home/`, continua servindo a home com 200 e `index, follow` no HTML cru. Para o Google isso se resolve na renderizacao, quando o React Router cai no `NotFound` e o `noindex` aparece. Para quem nao executa JS, nao se resolve. O conserto de verdade e regra de host, mesmo caso do 2.7.

  *Falhou se:* `/auth/` e `/home/` continuarem aparecendo no relatorio de paginas do GSC daqui a algumas semanas.

- [x] **2.7 FEITO em 29/08/2026, e nao como estava escrito.**

  *O que o item dizia:* criar uma Redirect Rule no painel do Cloudflare.

  *Por que estava errado:* nao existe painel. Os nameservers do dominio sao
  `ns1.dns-parking.com` e `ns2.dns-parking.com`, da Hostinger. O `Server:
  cloudflare` na resposta vem do Cloudflare **da Lovable**, na frente da
  hospedagem deles. O Cloudflare esta no caminho, mas nao e do medico.

  *O que foi feito:* as duas rotas entraram em `scripts/rotas-extra.mjs`, entao
  o SSG gera HTML proprio para elas, e o `RedirectToAgendamento` em
  `src/App.tsx` passou a emitir `noindex, follow` mais canonical apontando para
  `/agendamento`. Nao e um 301, mas resolve o que o 301 resolveria para busca:
  o Google para de indexar as duas e entende qual e a pagina real.

  *Um bug que a correcao criou e obrigou a consertar outro:* o `montar()` do
  `scripts/ssg.mjs` injetava canonical incondicionalmente, entao toda rota saia
  com DUAS tags. Nas 18 do sitemap as duas coincidiam e ninguem via. Nestas duas
  passaram a se contradizer, uma dizendo `/agendar` e a outra `/agendamento`, e
  canonicals conflitantes podem ser todos ignorados pelo Google. O canonical do
  SSG virou condicional, so entra quando a pagina nao emitiu o dela.

  **Isso fecha tambem o achado de canonical duplicado do `on-page-seo.md`.** As
  23 rotas agora tem exatamente uma tag, verificado no `dist`.

  *Feito de quebra:* o `<Navigate>` passou a renderizar so no cliente. No
  servidor ele era no-op e imprimia um aviso duas vezes por build. Aviso que
  aparece sempre e aviso que ninguem le.

  *Uma regressao que eu criei e a revisao pegou:* ao ganharem HTML proprio, as
  duas rotas passaram a sair com `<title>` VAZIO e sem nenhuma tag OG. Antes
  elas serviam a casca da home e herdavam o titulo e a previa dela. O `montar()`
  remove os OG da casca de proposito, e o Helmet nao repunha nada. Isso doi mais
  nestas duas que na maioria das paginas, porque sao justamente as URLs curtas
  que vao em campanha paga e em link colado no WhatsApp, e previa sem titulo
  parece link quebrado antes de qualquer um clicar. Corrigido, elas repetem o
  titulo, a description e os OG de `/agendamento`.

  *Duas limpezas de quebra:* o `SEM_HTML_PROPRIO` em `src/test/rotasComHtml.test.ts`
  ainda listava as duas rotas dizendo que pre renderizar um `<Navigate>` nao
  produziria HTML util, o contrario do que acabou de ser feito, e nenhum teste
  cruzava as duas listas, entao a contradicao era silenciosa. E o canonical de
  `/paragominas/agendamento` era o unico relativo do site, mascarado ate agora
  porque o SSG injetava a absoluta ao lado.

  *Falhou se:* alguma rota do `dist` tiver zero ou duas tags canonical, ou se
  `/agendar` deixar de apontar para `/agendamento`.

---

## Fase 3: schema e sinais de entidade

**PARCIAL, feita em 29/08/2026.** Quatro itens completos, dois parados esperando dado que so voce tem. Build com 21 rotas, 604 testes passando, tipos limpos.

### O que o grafo virou

Antes, as 12 paginas de procedimento emitiam quatro blocos JSON-LD soltos, cada um com seu proprio `@context`, e o Physician aparecia como copia sem `@id` dentro de `performer` e `reviewedBy`. Para o Google eram entidades diferentes do medico canonico da home.

Agora cada pagina emite um grafo unico e ligado:

| No | @id |
|---|---|
| Physician | `/#physician` |
| WebSite | `/#website` |
| MedicalWebPage | `<url>#webpage`, com `reviewedBy` apontando para `/#physician` |
| BreadcrumbList | `<url>#breadcrumb` |
| MedicalProcedure | `<url>#procedure`, com `performer` apontando para `/#physician` |
| FAQPage | `<url>#faq` |

Cobertura de BreadcrumbList por rota, antes e depois:

| Rota | Antes | Depois |
|---|---|---|
| 12 paginas de procedimento | sim, mas solta | sim, no grafo |
| `/procedimentos` | sim | sim |
| `/sobre`, `/belem`, `/paragominas`, `/agendamento` | **nao** | **sim** |
| `/politica-de-privacidade` | sem schema nenhum | WebPage mais BreadcrumbList |

### Um erro que quase passou

A primeira rodada inseriu o bloco de breadcrumb **duas vezes** nas quatro paginas, e o build aceitou sem reclamar. So apareceu ao conferir os tipos de no rota a rota no HTML gerado. Corrigido. Fica o registro de que build verde nao prova schema correto, porque JSON-LD duplicado e JSON valido.

---

**Prazo original: proximo mes**

- [x] **3.1 FEITO em 29/08/2026. `postalCode` nos quatro enderecos.**

  Estava ausente em 100% deles. Campo esperado pelo Google em negocio local, e
  CEP errado e pior que CEP ausente, porque o Google reconcilia NAP entre o site
  e o Google Business Profile.

  **Como os CEPs apareceram, e vale a pena registrar.** Nao veio de consulta aos
  Correios. Tres sairam da geocodificacao do proprio Google, lidos nos perfis do
  Google Business Profile depois que o medico os criou. Criar os perfis resolveu
  um item que estava travado por falta de dado.

  | Unidade | CEP | Origem |
  |---|---|---|
  | Clinicor | 68625-050 | base dos Correios, confirmado pelo medico |
  | Hospital Geral | 68625-080 | perfil do Google, Paragominas |
  | Instituto de Olhos | 66055-240 | perfil do Google, criado em 29/08 |
  | Vitria | 66025-160 | perfil do Google, criado em 29/08 |

  Nota: o Google e os Correios discordam de bairro em dois casos, em Belem. Os
  Correios listam 66055-240 como Umarizal e 66025-160 como Batista Campos, e o
  Google resolveu os dois como Nazare e Sao Braz. E divergencia de fronteira de
  bairro, comum em Belem. O CEP e o que vale, o bairro fica como esta.

  *Onde entrou:* `postalCode` no tipo `ClinicLocation`, nas quatro entradas, no
  `PostalAddress` de `clinicNodes()`, no endereco do `physicianNode` e no no
  Hospital exclusivo da capsulotomia YAG.

  *Verificado:* os CEPs saem no JSON-LD das rotas publicadas.

- [x] **3.2 FEITO em 29/08/2026, e resolvido em duas metades.**

  **`openingHoursSpecification` nao entra, por decisao.** O atendimento e
  flexivel e nao ha horario fixo. A opcao de declarar 24 por 7 foi levantada e
  descartada: horario que nao bate com o movimento real degrada a confianca do
  perfil no Google, e faz paciente chegar com a porta fechada. Perfil e schema
  sem horario nao perdem posicao, so nao ganham o selo de aberto.

  **`geo` entrou nas quatro unidades.** Coordenadas lidas do Google Maps:

  | Unidade | Latitude | Longitude |
  |---|---|---|
  | Clinicor | -3.0013246 | -47.3549239 |
  | Hospital Geral | -2.9927566 | -47.3552377 |
  | Instituto de Olhos | -1.4487456 | -48.4829544 |
  | Vitria | -1.4559713 | -48.4732988 |

  A do Hospital Geral saiu do proprio perfil do medico no Google Business
  Profile, entao e o pino que ele ja mantem. As outras tres vieram da resolucao
  de endereco do Maps.

  *Expectativa correta:* `geo` nao posiciona o negocio no Google, quem faz isso
  e o perfil. O campo serve para quem le o dado estruturado sem consultar o
  Maps, tipicamente assistente de IA respondendo qual unidade e a mais perto.

  *Divergencia registrada, para conferir com as clinicas um dia:* o perfil da
  Vitria mostra CEP 66025-160, e a busca de endereco no proprio Maps devolve
  66040-100 para o mesmo numero. O schema ficou com o do perfil, porque e contra
  ele que o Google reconcilia o site. Nao troque sem confirmar na conta de luz
  ou no cartao da clinica.

- [x] **3.4 FEITO. BreadcrumbList em `/sobre`, `/belem`, `/paragominas` e `/agendamento`.** Hoje so as paginas de procedimento e o hub tem.
- [x] **3.5 FEITO. JSON-LD minimo em `/politica-de-privacidade`.** Unica rota com zero blocos.
- [x] **3.6 FEITO em 29/08/2026, e era pior do que o registrado. Instagram.**

  *O que eu tinha escrito:* que existiam dois perfis e que isso fragmentava o sinal de entidade, entao bastava escolher um.

  *O que era de fato:* o site inteiro apontava para `@drjulianomachado.oftalmo`, e o perfil ativo do medico e `@drjuliano.oftalmo`. Nao era sinal dividido entre dois lugares, era sinal inteiro mandado para o lugar errado. Confirmado pelo proprio medico.

  *Onde estava:* tres lugares, todos trocados.

  | Arquivo | O que era |
  |---|---|
  | `src/lib/constants.ts` | a URL no `sameAs` do JSON-LD |
  | `src/components/Footer.tsx` | dois links do rodape |
  | `src/components/Footer.tsx` | o texto visivel `@drjulianomachado.oftalmo` |

  Atencao ao terceiro: o `href` e o rotulo eram valores separados. Trocar so os links deixaria o rodape mostrando um handle e levando para outro, que e pior que o erro original.

  *Verificado:* as tres ocorrencias por pagina saem corretas no HTML gerado, e o `sameAs` do no `Physician` aponta para o perfil certo.

  *Armadilha registrada no codigo:* nao tente confirmar handle do Instagram por HTTP. O dominio devolve 200 para qualquer nome, inclusive inexistente, porque serve a parede de login. Testei os dois e ambos deram 200.

`findings/schema.md` traz o JSON-LD corrigido pronto para colar, com marcadores explicitos onde falta CEP e coordenada.

---

## Fase 4: fora do site, e o de maior alavanca local

**Prazo: continuo. Nada disso e codigo.**

- [ ] **4.1 Conferir o perfil no AgendarConsulta.com.** E onde o telefone com DDD 19 do site antigo vazou. Nenhum agente conseguiu verificar o estado atual.
- [ ] **4.2 Conferir o Google Business Profile das duas cidades.** Nao verificavel pelas ferramentas desta auditoria. E o fator isolado de maior peso para o pacote local.
- [ ] **4.3 Criar ou reivindicar o Doctoralia.** A busca caiu num homonimo ortopedista de Pernambuco, o que sugere perfil inexistente ou nao reivindicado.
- [ ] **4.4 Citacoes que faltam,** em ordem: CRM-PA, Sociedade Brasileira de Oftalmologia, Sociedade Brasileira de Glaucoma, Bing Places, Apple Business Connect, pagina no Facebook.

---

## Fase 5: monitoramento

**PARCIAL, feita em 29/08/2026.** Tres itens completos, um depende de voce. 608 testes passando.

### O achado da fase

O item 5.4 mandava investigar se as duas propriedades GA4 eram rastreamento duplicado. Consultei as duas na mesma janela de 90 dias, ate 28/08/2026:

| Metrica | 449024836 | 449076345 |
|---|---|---|
| Sessoes | 20 | 20 |
| Usuarios | 16 | 16 |
| Pageviews | **68** | **67** |
| Rejeicao na home | **13,3%** | **26,7%** |

Sessoes e usuarios batem exatamente, o que confirma que as duas recebem os mesmos hits. Mas pageviews difere em um, e a rejeicao na home e o dobro numa delas, 2 contra 4 sessoes nao engajadas em 15.

**A anotacao anterior dizia que as duas devolviam dados identicos. Estava errada.** Elas contam engajamento de forma diferente, provavelmente por configuracao distinta de evento. Na pratica: antes de comparar qualquer numero de engajamento, confira de qual propriedade ele saiu.

---

**Prazo original: montar uma vez, rodar sob demanda**

- [x] **5.1 FEITO, com escopo maior que o previsto. Teste de cobertura de rotas.**

  Criado `src/test/rotasComHtml.test.ts`, com quatro invariantes. O item original falava em comparar `App.tsx` com o sitemap, mas desde a Fase 1 sao duas listas, o sitemap e a `ROTAS_EXTRA` do `scripts/ssg.mjs`, entao o teste confere as duas.

  1. Toda rota publica do `App.tsx` esta no sitemap ou em `ROTAS_EXTRA`
  2. O sitemap nao publica rota que o roteador nao serve
  3. Nenhuma rota esta nas duas listas, o que seria sinal contraditorio, sitemap pedindo indexacao e a pagina pedindo noindex
  4. Rota de `/admin` nao vazou para o sitemap

  A `ROTAS_EXTRA` e lida do proprio `ssg.mjs`, nao copiada para o teste. Copia divergiria em silencio, que e a classe de problema que o teste existe para pegar.

  *Verificado de verdade:* acrescentei uma rota falsa no `App.tsx` e o teste falhou nomeando ela. Depois `git checkout` e confirmacao de que o arquivo voltou limpo.
- [x] **5.2 FEITO. Baseline de drift capturado.**

  Tres paginas: home, `/paragominas` e `/procedimentos/cirurgia-de-catarata`.

  **Leia com atencao o que este baseline e.** Ele retrata a producao de HOJE, que ainda nao tem nenhuma das mudancas das Fases 1 a 3, porque nada foi publicado. Isso e proposital e util: depois do deploy, `drift compare` vai listar exatamente o que mudou, e essa lista serve de conferencia do que se esperava mudar.

  Sinal para acompanhar: hoje o baseline registra 6 blocos de schema em `/paragominas` e 4 na de catarata. Depois do deploy tem que virar 7 e 6. Se nao virar, o deploy nao levou o que se pensava.
- [ ] **5.3 DEPENDE DE VOCE. Adicionar a conta de servico na propriedade `sc-domain`.**

  Hoje a conta so enxerga a propriedade de prefixo de URL, e toda chamada com `sc-domain:` volta 403. A auditoria funcionou assim mesmo, mas a propriedade de dominio cobre subdominios e http, entao ela e a visao completa.

  *Como fazer:* Search Console, propriedade `sc-domain:drjulianomachado.com`, Configuracoes, Usuarios e permissoes, adicionar `claude-seo-gsc@crmprojeto-503414.iam.gserviceaccount.com` com permissao de leitura.

  *Falhou se:* `gsc_query.py` com `sc-domain:` continuar devolvendo 403.
- [x] **5.4 FEITO, e a premissa estava errada. As duas propriedades GA4.**

  Ver a tabela no topo desta fase. Elas nao devolvem dados identicos, e a diferenca esta em engajamento, nao em volume.

  *O que fica em aberto, e e decisao sua:* qual das duas aposentar. Enquanto as duas existirem, todo relatorio de engajamento precisa dizer de qual propriedade veio, ou vira comparacao de coisas diferentes. A anotacao de credenciais ja foi corrigida.

**Indicadores para acompanhar sem refazer auditoria:**

| Sinal | Onde | O que significa se piorar |
|---|---|---|
| "Duplicada, o Google escolheu um canonical diferente" | Cobertura no Search Console | O fallback universal se materializando |
| Soft 404 | Cobertura no Search Console | Idem |
| LCP p75 de campo | CrUX, janela de 28 dias | Se nao cair de 4.132ms nas proximas semanas, o SSG nao resolveu o que se esperava |
| Impressoes de `/paragominas` | Desempenho no Search Console | Se nao subir apos a Fase 2, a hipotese de links internos estava errada |

---

## Dividas encontradas na revisao de 29/08, fora do escopo da auditoria

A revisao de qualidade do commit apontou tres duplicacoes que **nao foram
introduzidas por esta auditoria** e nao foram corrigidas aqui, para nao inchar
um diff que ja mexia em 23 arquivos. Ficam registradas porque sao do mesmo
genero que a auditoria combateu: copia de dado que envelhece em silencio.

- [ ] **`src/components/procedimentos/yag/yagContent.ts`, linhas 15 a 18.** O
      `HGP_FALLBACK` repete `displayAddress` e `phone` da unidade `hgp` de
      `src/lib/locations.ts`. O `HGP_SLUG = "hgp"` ja esta na linha 11, entao a
      busca e uma linha. Este e o texto **visivel**, o que torna a divergencia
      pior que a do JSON-LD, ja corrigida.

- [ ] **`src/pages/procedimentos/Index.tsx`, linhas 174 a 180.** Ultima pagina
      do site com `BreadcrumbList` montado a mao. Depois desta auditoria, todas
      as outras doze usam `breadcrumbNode()` de `lib/schema.ts`. A diferenca
      concreta: o helper poe `@id` na trilha e ancora ela no grafo, e a versao
      a mao deixa a trilha solta.

- [ ] **`src/pages/procedimentos/Index.tsx`, linha 259.** Link
      `https://wa.me/5591936180476` escrito a mao. As outras onze paginas de
      procedimento usam `<WhatsAppButton />` sobre `useSiteWhatsApp`. Trocar o
      numero no admin nao muda este botao.

As tres se resolvem junto, no mesmo arquivo em dois dos casos, e sao trabalho de
poucos minutos. Nao entram em nenhuma fase porque nao vieram da auditoria.

### Duas escolhas conscientes da mesma revisao

Levantadas, avaliadas e **nao** aplicadas, com o motivo.

- [ ] **A leitura do sitemap esta escrita duas vezes,** em `scripts/ssg.mjs` e
      em `src/test/rotasComHtml.test.ts`. Mesma expressao regular de `<loc>` e
      mesmo `replace(BASE, "")`. E exatamente o risco que motivou criar o
      `scripts/rotas-extra.mjs`, entao a critica e justa. Ficou de fora porque
      o diff ja mexia em 24 arquivos e cada correcao nova reabria a revisao de
      qualidade. Sao dez linhas, e o lugar natural e o proprio `rotas-extra.mjs`
      exportando tambem a funcao de leitura.

- [ ] **O no `Hospital` da capsulotomia YAG nao tem `@id`.** Ele descreve o
      mesmo Hospital Geral que `clinicNodes()` ja emite como `MedicalClinic`
      com `@id` proprio. Para o Google sao dois lugares em vez de um. O endereco
      ja deixou de ser copiado, entao a divergencia de dado acabou, mas a
      duplicacao de entidade continua. Resolver bem exige decidir se o no deve
      referenciar o clinico canonico por `@id`, e essa referencia ficaria
      pendurada, porque `procedureGraph` nao inclui os nos de clinica.
