# Auditoria SEO completa, drjulianomachado.com

**Data:** 28/08/2026
**Health Score:** 66/100
**Tipo:** Local Service, consultorio medico de oftalmologia, duas cidades no Para
**Auditoria anterior:** 27/08/2026, 82/100

Medicao: as 18 URLs do sitemap baixadas com `curl` puro, **sem execucao de JavaScript**. Isso mudou hoje. Ate ontem o HTML servido era uma casca de 9,8 KB e qualquer medicao exigia Playwright. Campo pela CrUX History API. Laboratorio pelo PageSpeed Insights.

## Leia isto antes de olhar as notas

**A nota caiu de 82 para 66 e nada regrediu.** As duas auditorias mediram coisas diferentes.

A de 27/08 avaliava um site cujo HTML era casca. Ela nao tinha como enxergar links internos, grafo de schema, conformidade de publicidade medica ou experiencia de busca, porque nada disso existia no HTML servido. As notas altas de entao refletiam o que o codigo React prometia.

A de hoje mede o que o servidor entrega. Aparecerem problemas que estavam escondidos nao e piora, e o primeiro retrato honesto.

**O que de fato mudou hoje, para melhor:** o SSG entrou no ar. As 18 rotas servem HTML completo, de 45 a 143 KB. O LCP de laboratorio em desktop caiu para 0,7s e o TTFB de origem esta entre 5 e 10ms. A causa registrada do LCP ruim de campo, "nada pinta antes do JS executar", deixou de existir.

## Notas por categoria

| Categoria | Nota | Peso | Anterior |
|---|---|---|---|
| Technical SEO | 55/100 | 22% | 82 |
| Content Quality | 65/100 | 23% | 92 |
| On-Page SEO | 78/100 | 20% | 96 |
| Schema / Structured Data | 58/100 | 10% | 92 |
| Performance (CWV) | 74/100 | 10% | 38 |
| AI Search Readiness | 60/100 | 10% | 55 |
| Images | 84/100 | 5% | 96 |

Fora da media ponderada, medidos pela primeira vez:

| Categoria | Nota |
|---|---|
| SXO, experiencia de busca | 58/100 |
| Local SEO | 54/100 |

## Os cinco achados que importam

### 1. Publicidade medica, dois itens Critical

A home tem uma secao "Antes e depois" com fotos reais do mesmo olho, legendadas "Opacidade da capsula posterior" e "Abertura central apos o YAG laser". A `/agendamento` reproduz tres depoimentos de pacientes com nome completo dentro do funil de conversao.

Os dois esbarram na Resolucao CFM 1.974/2011 e no art. 112 do Codigo de Etica Medica. O aviso "resultado varia de paciente para paciente" nao descaracteriza a comparacao.

Este e o unico item da auditoria cujo risco nao e de ranqueamento. E decisao do medico, nao recomendacao tecnica. Detalhe em `findings/content-quality.md`.

### 2. Toda URL fora do sitemap serve a home inteira

`scripts/ssg.mjs` le `public/sitemap.xml` como lista de rotas, e escreve a rota `/` em `dist/index.html`, que e tambem o arquivo de fallback da SPA. Consequencia: qualquer URL nao reconhecida devolve 147.248 bytes identicos a home, com HTTP 200 e `index, follow`.

Isso atinge quatro rotas reais do app, incluindo `/paragominas/agendamento`, uma pagina de conversao da cidade principal que nenhum crawler enxerga e que nao esta no sitemap. Detalhe em `findings/ssg-cobertura-e-monitor.md`.

Antes do SSG o fallback era uma casca neutra e inofensiva. O SSG melhorou 18 rotas e, pelo mesmo mecanismo, transformou o fallback em conteudo duplicado real.

**Isto deixou de ser risco e virou fato.** O relatorio de paginas do Search Console ja registra impressoes para `/auth/` e `/home/`. Nenhuma das duas deveria estar la: `/auth` e bloqueada no `robots.txt`, e `/home` nao e rota do app, nao existe em lugar nenhum do `src/App.tsx`. As duas devolvem os mesmos 147.248 bytes da home, com `index, follow`. O Google esta acumulando impressoes em URLs inventadas que servem conteudo duplicado.

### 3. Cinquenta e sete respostas de FAQ nao existem no HTML servido

O acordeao Radix renderiza conteudo fechado como div vazia no servidor. Nas 11 paginas de procedimento e em `/paragominas`, as respostas so existem dentro do JSON-LD. `/` e `/belem` fazem certo, o que prova ser bug e nao decisao.

Isso anula, nessas doze rotas, boa parte do ganho que o SSG acabou de entregar para crawlers que nao executam JS.

### 4. Paragominas e a cidade mais invisivel do proprio site

A cidade sede nao esta na navegacao global. `/belem` recebe 16 links internos, `/paragominas` recebe 2. O h1 de `/paragominas` e "Sua visao,com mais clareza.", sem a cidade e sem o espaco depois da virgula, enquanto `/belem` usa "Oftalmologista em Belem". A pagina nao tem telefone clicavel na tela, so dentro do JSON-LD.

Some-se a isso que `/paragominas/agendamento`, destino dos CTAs da landing, serve a home.

### 5. O hub `/procedimentos` recebe 1 link interno

O breadcrumb das 11 paginas filhas aponta o nivel 2 para `/#procedimentos`, uma ancora na home, em vez do hub real. HTML e JSON-LD erram junto, o que ao menos os mantem coerentes entre si. O rich result de breadcrumb na SERP mostra a home como pagina mae.

## O que esta certo, e vale proteger

- **SSG cobrindo as 18 rotas do sitemap.** `render_page.py` confirma `is_spa: false` e `content` igual a `raw_content`. Nenhum cloaking: os seis crawlers de IA testados recebem o mesmo HTML.
- **Titulos e descriptions.** As 18 paginas dentro da faixa, 45 a 59 e 111 a 160 caracteres.
- **E-E-A-T de base.** CRM-PA 15253 no cabecalho fixo, formacao com datas e carga horaria, rodape de revisao por procedimento com data, `reviewedBy` no schema, politica LGPD completa.
- **NAP interno consistente.** Quatro clinicas com endereco e telefone proprios, sem residuo do DDD 19 nem do "11 anos" do site antigo.
- **Performance de desktop.** LCP 0,7s, performance 96 a 100, TTFB de origem 5 a 10ms.
- **Hero da home.** `srcSet` com duas variantes, `sizes` real, dimensoes declaradas, `fetchpriority="high"`. O padrao correto existe no repositorio.

## Detalhe por categoria

Cada arquivo em `findings/` traz evidencia, comando de verificacao e correcao especifica.

| Arquivo | Autor |
|---|---|
| `technical-seo.md` | agente tecnico |
| `content-quality.md` | agente de conteudo |
| `schema.md` | agente de schema |
| `performance.md` | agente de performance |
| `ai-search-readiness.md` | agente de GEO |
| `local-seo.md` | agente local |
| `sxo.md` | agente de SXO |
| `on-page-seo.md` | medicao propria |
| `images.md` | medicao propria |
| `ssg-cobertura-e-monitor.md` | medicao propria |
| `google-data.md` | agente de APIs do Google |

## Dados reais do Google

Propriedade GSC `https://drjulianomachado.com/`, propriedade GA4 `449024836`. Detalhe completo em `findings/google-data.md`.

### Indexacao: as 18 rotas estao certas

As 18 URLs do sitemap foram inspecionadas **uma por uma**, nao em lote, porque `gsc_inspect.py --batch` devolve estado vazio sem sinalizar erro. Todas voltaram "Submitted and indexed", fetch SUCCESSFUL, robots ALLOWED, canonical escolhida pelo Google igual a declarada. Zero divergencia.

Ressalva de leitura: os ultimos rastreamentos vao de 05/06/2026 ate 28/08/2026 as 18h52 UTC, quase todos **anteriores** ao SSG entrar no ar. O Google indexou essas paginas executando JS na casca. O que ele vai encontrar no proximo rastreamento e melhor do que o que ele indexou.

### Trafego: pequeno, e concentrado

| Janela | Cliques | Impressoes | CTR | Posicao |
|---|---|---|---|---|
| 28 dias, 31/07 a 25/08 | 11 | 611 | 1,8% | 3,5 |
| 28 dias anteriores, 05/07 a 30/07 | 9 | 582 | | |
| 3 meses, 30/05 a 25/08 | 35 | 1.865 | | 3,4 |
| 3 meses anteriores, 03/03 a 29/05 | 40 | 2.047 | | |

GA4 organico, 90 dias: 19 sessoes, 15 usuarios, 65 pageviews. Media de 1,5 sessao por dia. So duas paginas de destino organicas, a home com 14 sessoes e `/agendamento` com 4.

Mobile domina, 29 dos 35 cliques em tres meses. A consulta "oftalmologista paragominas" concentra a maior parte dos cliques reais.

Nota sobre a comparacao trimestral: o trimestre anterior se sobrepoe ao bug documentado de contagem de impressoes do GSC, de 13/05/2025 a 27/04/2026. Cliques nao foram afetados. Nao trate a queda de 2.047 para 1.865 impressoes como sinal.

### O numero que reorganiza a prioridade

**Onze das dezoito paginas tiveram zero impressao em tres meses.**

Isso conversa diretamente com a medicao de links internos deste relatorio. Seis das onze paginas de procedimento recebem 2 links internos cada, o hub `/procedimentos` recebe 1, e `/paragominas` recebe 2. Paginas que o proprio site nao linka sao paginas que o Google nao tem motivo para ranquear.

A hipotese e falsificavel: se as correcoes da Fase 2 do plano forem aplicadas e o numero de paginas com zero impressao nao cair nas semanas seguintes, o problema nao era link interno.

### Posicao 3,4 com CTR de 1,8%

Posicao media 3,4 deveria render CTR bem acima de 1,8%. As leituras possiveis sao duas: as impressoes vem majoritariamente de termos de marca ou do pacote local, onde o clique vai para o Maps e nao para o site, ou o site ranqueia em terceiro para termos de volume muito baixo. Nao consegui separar as duas com os dados disponiveis. Vale investigar antes de tratar CTR como problema de titulo, porque os titulos ja estao todos na faixa correta.

### Rotas fora do sitemap

`/agendar`, `/paragominas/agendamento`, `/agendar-consulta` e `/obrigado` voltaram "URL is unknown to Google". O Google ainda nao as rastreou, entao a duplicacao ainda nao esta confirmada para elas. Ja `/auth/` e `/home/` aparecem no relatorio de paginas com impressoes, o que confirma o mecanismo.

### Migracao do dominio antigo

Nenhum sinal encontrado nos dados coletados. Nao existe endpoint de API para o status de Mudanca de Endereco, entao isso so pode ser conferido na interface do Search Console.

## Limitacoes desta auditoria

- **Campo nao cobre o pos-SSG.** A ultima janela completa do CrUX e 05/07 a 01/08/2026, inteiramente anterior. As tres janelas seguintes vieram vazias por trafego insuficiente. INP de campo nao existe em nenhuma das 25 semanas coletadas.
- **Perfis externos nao verificados.** Google Business Profile, Doctoralia, AgendarConsulta e o registro no CRM-PA nao puderam ser confirmados. A URL testada no Doctoralia caiu num homonimo ortopedista de Pernambuco.
- **Backlinks nao analisados.** Nenhum agente de backlinks foi acionado nesta rodada.
- **Propriedade GA4 duplicada nao conferida.** `449076345` nao foi consultada nesta rodada.
- **Sem baseline de drift.** `drift_history.py` nao encontrou banco para esta URL, entao nao ha comparacao automatica com estados anteriores.
