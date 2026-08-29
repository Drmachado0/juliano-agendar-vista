# Dados reais do Google para drjulianomachado.com

Fonte: Google API (dados de campo e de console), via claude-seo, Tier 2 completo.
Propriedade GSC usada: `https://drjulianomachado.com/` (prefixo de URL). A propriedade `sc-domain:drjulianomachado.com` retorna 403 e não foi usada.
Propriedade GA4 usada: `449024836`.

AVISO IMPORTANTE DE TEMPORALIDADE. Hoje, 28/08/2026, o site passou a servir HTML pré-renderizado nas 18 rotas do sitemap (antes era uma casca de 9,8 KB). Todos os dados de campo (CrUX) e boa parte dos dados de console (GSC) abaixo cobrem janelas anteriores a essa mudança. Eles descrevem o estado ANTERIOR do site, não o estado atual pós-pré-renderização. Isso está sinalizado de novo em cada seção relevante.

Status desta rodada de coleta. Este arquivo foi atualizado depois da primeira entrega parcial, agora inclui a inspeção de indexação (URL Inspection) das 18 URLs do sitemap mais as 4 rotas fora do sitemap suspeitas de duplicação. O único item que ficou de fora é a checagem da propriedade GA4 duplicada e o status de Mudança de Endereço na interface do Search Console, que não tem endpoint de API disponível.

## 1. Indexação por URL (gsc_inspect), uma consulta por vez

As 18 URLs do sitemap foram inspecionadas individualmente (sem usar `--batch`, por causa do problema conhecido de estado vazio sem sinalização de erro). Todas as 19 chamadas desta seção (18 URLs mais uma nova tentativa da política de privacidade, que teve timeout de rede na primeira tentativa) retornaram `coverage_state` preenchido, nenhuma veio vazia.

Resultado, as 18 URLs do sitemap estão "Submitted and indexed" (enviada e indexada), com `page_fetch_state` SUCCESSFUL e `robots_txt_state` ALLOWED em todas. Nenhuma mostrou "Duplicada, o Google escolheu um canonical diferente" e não houve nenhum caso de conflito entre a canonical escolhida pelo Google e a declarada pela página. Em 12 URLs a API retornou as duas canonicals e elas batem (google_canonical = user_canonical = a própria URL). Em 6 URLs (/agendamento, /procedimentos/consulta-oftalmologica, /procedimentos/cirurgia-de-catarata, /procedimentos/cirurgia-de-pterigio, /procedimentos/capsulotomia-yag-laser, /politica-de-privacidade) a API não devolveu a canonical declarada (user_canonical veio vazio), mas a canonical escolhida pelo Google nesses 6 casos ainda é a própria URL, sem sinal de duplicação.

| URL | Coverage | Fetch | Robots | Último rastreamento (UTC) | Canonical Google = declarada |
|---|---|---|---|---|---|
| / | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-26T23:10:04Z | Sim |
| /agendamento | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-13T12:31:04Z | Google canon = própria URL, declarada não retornada |
| /paragominas | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T16:16:57Z | Sim |
| /belem | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T16:30:05Z | Sim |
| /procedimentos | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-27T12:27:18Z | Sim |
| /procedimentos/consulta-oftalmologica | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-06-05T03:02:35Z | Google canon = própria URL, declarada não retornada |
| /procedimentos/cirurgia-de-catarata | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-07-10T04:48:07Z | Google canon = própria URL, declarada não retornada |
| /procedimentos/cirurgia-de-pterigio | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-07-09T01:46:18Z | Google canon = própria URL, declarada não retornada |
| /procedimentos/capsulotomia-yag-laser | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-07-11T11:24:14Z | Google canon = própria URL, declarada não retornada |
| /sobre | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:03:51Z | Sim |
| /procedimentos/glaucoma | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:10:04Z | Sim |
| /procedimentos/mapeamento-de-retina | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T18:52:42Z | Sim |
| /procedimentos/retinografia | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:10:02Z | Sim |
| /procedimentos/tonometria | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:10:03Z | Sim |
| /procedimentos/gonioscopia | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:12:27Z | Sim |
| /procedimentos/biometria-ultrassonica | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-28T17:16:06Z | Sim |
| /procedimentos/iridotomia-a-laser | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-08-27T17:40:33Z | Sim |
| /politica-de-privacidade | Submitted and indexed | SUCCESSFUL | ALLOWED | 2026-07-09T09:54:32Z | Google canon = própria URL, declarada não retornada |

Aviso de temporalidade, todos esses last_crawl_time são de rastreamentos feitos antes ou, no máximo, no mesmo dia da mudança de pré-renderização de hoje. O mais recente registrado foi 28/08/2026 às 18:52 UTC (mapeamento-de-retina), mas não dá para confirmar se esse rastreamento específico já capturou o HTML pré-renderizado ou ainda a casca antiga, dado o timestamp da mudança também ser hoje.

Referências (referring_urls) capturadas na inspeção da home, https://dr-juliano-authority-landing.lovable.app/, https://wonvision.com/0da88c648073673267bb45008b77f7f7-l/ e https://drjulianomachado.com/auth/. Nenhuma menção ao domínio antigo drjulianosmachado.com.br apareceu nas referências capturadas nesta rodada (ver seção 5).

### 1.1 Rotas fora do sitemap suspeitas de conteúdo duplicado

As quatro rotas apontadas como servindo a home inteira com index, follow foram inspecionadas individualmente, /agendar, /paragominas/agendamento, /agendar-consulta e /obrigado. Nas quatro, o resultado foi o mesmo, verdict NEUTRAL, coverage_state "URL is unknown to Google", sem last_crawl_time e sem dado de canonical.

Isso significa que o Google ainda não rastreou nem processou nenhuma dessas quatro URLs o suficiente para ter uma canonical ou um veredito de indexação. Elas não aparecem como "Duplicada, o Google escolheu um canonical diferente" no momento desta consulta, esse estado específico não foi encontrado. Isso não confirma a hipótese de conteúdo duplicado do jeito que foi levantada, mas também não a descarta, porque o Google simplesmente ainda não chegou a rastrear essas rotas o bastante para classificá-las. Vale reconsultar depois que o Google rastrear essas URLs, algo que pode acontecer a qualquer momento já que elas não têm bloqueio de robots conhecido.

Também foi confirmado por outra via (GSC por página, seção 2.3) que duas outras URLs fora do sitemap, /auth/ e /home/, já têm impressão de busca registrada, essas sim já rastreadas pelo Google, mas não foram inspecionadas individualmente nesta rodada.

## 2. GSC Search Analytics

### 2.1 Totais e comparação de período

Os totais abaixo vêm da consulta agregada sem dimensões (`totals_source: dimensionless_aggregate` ou `dimensionless_query`, `totals_complete: true`), não da soma das linhas por consulta.

| Período | Início | Fim | Cliques | Impressões | CTR | Posição média |
|---|---|---|---|---|---|---|
| Últimos 28 dias | 2026-07-31 | 2026-08-25 | 11 | 611 | 1.8% | 3.5 |
| 28 dias anteriores | 2026-07-05 | 2026-07-30 | 9 | 582 | 1.55% | 3.7 |
| Últimos 3 meses | 2026-05-30 | 2026-08-25 | 35 | 1.865 | 1.88% | 3.4 |
| 3 meses anteriores | 2026-03-03 | 2026-05-29 | 40 | 2.047 | 1.95% | 3.3 |

Tendência de 28 dias, cliques subiram de 9 para 11 (mais 22%) e impressões de 582 para 611 (mais 5%). Volume ainda muito baixo para tirar conclusão estatística.

Tendência de 3 meses, cliques caíram de 40 para 35 e impressões de 2.047 para 1.865. A janela anterior de 3 meses (2026-03-03 a 2026-05-29) se sobrepõe parcialmente ao período de erro de contagem de impressões do GSC, que a própria ferramenta sinaliza automaticamente: "GSC impressions logging error affected impressions, CTR, and average position from 2025-05-13 through 2026-04-27, clicks were not affected." Ou seja, a queda de impressões e a posição média da janela anterior de 3 meses podem estar distorcidas por esse bug documentado do Google, não refletindo necessariamente uma piora real. Cliques não são afetados pelo bug, então a queda de 40 para 35 cliques é o número mais confiável de comparação.

### 2.2 Por consulta (busca)

Aviso de leitura. Nas linhas por consulta de 28 dias, todas as 56 consultas retornadas aparecem com 0 cliques, mesmo o total real sendo 11 cliques. Isso é o comportamento documentado do GSC de anonimizar cliques em consultas de baixo volume, os 11 cliques reais do total agregado existem mas estão distribuídos em consultas individualmente pequenas demais para aparecer detalhadas. A janela de 3 meses tem volume suficiente para mostrar cliques reais em algumas consultas.

Top consultas por impressões, últimos 28 dias (2026-07-31 a 2026-08-25), 56 consultas distintas no total:

| Consulta | Cliques | Impressões | Posição |
|---|---|---|---|
| oftalmologista | 0 | 53 | 1.9 |
| oftalmologista paragominas | 0 | 49 | 1.0 |
| oftalmologista em paragominas | 0 | 17 | 1.0 |
| drjulianomachado.com | 0 | 9 | 9.7 |
| dr juliano oftalmologista | 0 | 8 | 2.9 |
| psiquiatra paragominas | 0 | 8 | 6.9 |
| cirurgia refrativa | 0 | 6 | 3.7 |
| day clinic paragominas | 0 | 6 | 5.3 |
| olhos | 0 | 6 | 5.3 |
| eye doctor near me | 0 | 4 | 1.0 |

Top consultas por cliques, últimos 3 meses (2026-05-30 a 2026-08-25), 147 consultas distintas no total:

| Consulta | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| oftalmologista paragominas | 6 | 169 | 3.55% | 1.0 |
| oftalmologista em paragominas | 2 | 47 | 4.26% | 1.0 |
| dr juliano machado | 1 | 4 | 25.0% | 1.0 |
| oftalmologista | 0 | 174 | 0% | 1.9 |
| cirurgia refrativa | 0 | 25 | 0% | 5.1 |
| dr juliano oftalmologista | 0 | 22 | 0% | 6.0 |
| olhos | 0 | 17 | 0% | 5.5 |
| drjulianomachado.com | 0 | 16 | 0% | 10.2 |
| eye doctor near me | 0 | 12 | 0% | 1.0 |
| oftalmologia | 0 | 11 | 0% | 1.9 |

A consulta "oftalmologista + paragominas" concentra praticamente todos os cliques reais registrados no site nos últimos 3 meses.

### 2.3 Por página

Últimos 28 dias (2026-07-31 a 2026-08-25), 7 das 18 páginas do sitemap com alguma impressão registrada:

| Página | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| / | 10 | 564 | 1.77% | 3.1 |
| /agendamento | 1 | 38 | 2.63% | 7.7 |
| /politica-de-privacidade | 0 | 11 | 0% | 6.7 |
| /procedimentos/capsulotomia-yag-laser | 0 | 17 | 0% | 8.4 |
| /procedimentos/cirurgia-de-catarata | 0 | 17 | 0% | 8.3 |
| /procedimentos/cirurgia-de-pterigio | 0 | 20 | 0% | 8.7 |
| /procedimentos/consulta-oftalmologica | 0 | 1 | 0% | 1.0 |

Últimos 3 meses (2026-05-30 a 2026-08-25), 9 páginas com impressão:

| Página | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| / | 33 | 1.768 | 1.87% | 2.9 |
| /agendamento | 2 | 70 | 2.86% | 7.5 |
| /auth/ | 0 | 8 | 0% | 8.1 |
| /home/ | 0 | 11 | 0% | 6.5 |
| /politica-de-privacidade | 0 | 24 | 0% | 7.5 |
| /procedimentos/capsulotomia-yag-laser | 0 | 34 | 0% | 15.9 |
| /procedimentos/cirurgia-de-catarata | 0 | 52 | 0% | 11.4 |
| /procedimentos/cirurgia-de-pterigio | 0 | 34 | 0% | 8.4 |
| /procedimentos/consulta-oftalmologica | 0 | 10 | 0% | 7.5 |

Dois achados importantes aqui.

Primeiro, 11 das 18 URLs do sitemap (agendamento não, mas paragominas, belem, sobre, procedimentos hub, glaucoma, mapeamento-de-retina, retinografia, tonometria, gonioscopia, biometria-ultrassonica, iridotomia-a-laser) tiveram zero impressões em busca nos últimos 3 meses. Sem dado nenhum de aparição no Google para essas páginas no período.

Segundo, e isso é relevante para a investigação de rotas fora do sitemap, o GSC registra impressões de busca para `/auth/` e `/home/`, duas URLs que NÃO estão nas 18 URLs do sitemap atual. Isso confirma que existem URLs fora do sitemap sendo rastreadas e aparecendo em resultado de busca, mas essas duas (`/auth/`, `/home/`) são diferentes das quatro rotas mencionadas na investigação (`/paragominas/agendamento`, `/agendar`, `/agendar-consulta`, `/obrigado`). Nenhuma dessas quatro rotas específicas apareceu nos relatórios de página do período consultado, nem em 28 dias nem em 3 meses. A checagem individual com URL Inspection (seção 1.1) confirmou o motivo, essas quatro rotas ainda estão como "URL is unknown to Google", o Google ainda não as rastreou, por isso não geram impressão nem aparecem como duplicidade confirmada no momento desta consulta.

### 2.4 Por dispositivo

Últimos 28 dias (2026-07-31 a 2026-08-25):

| Dispositivo | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| Mobile | 8 | 509 | 1.57% | 3.5 |
| Desktop | 3 | 100 | 3.0% | 3.1 |
| Tablet | 0 | 2 | 0% | 6.5 |

Últimos 3 meses (2026-05-30 a 2026-08-25):

| Dispositivo | Cliques | Impressões | CTR | Posição |
|---|---|---|---|---|
| Mobile | 29 | 1.524 | 1.9% | 3.0 |
| Desktop | 6 | 335 | 1.79% | 5.1 |
| Tablet | 0 | 6 | 0% | 4.0 |

Mobile domina o tráfego de busca (cerca de 82% dos cliques em 3 meses), mas desktop tem CTR levemente melhor em 28 dias.

### 2.5 Sitemaps

| Sitemap | Último envio | Tipo | Conteúdo enviado | Erros | Avisos |
|---|---|---|---|---|---|
| /sitemap.xml | 2026-08-27 | sitemap | 18 web | 0 | 0 |
| / (raiz, envio direto) | 2026-08-27 | não informado | 0 itens | 1 | 0 |
| /page-sitemap.xml | 2024-07-08 | sitemap | 2 web + 12 imagem | 0 | 0 |
| /sitemap_index.xml | 2024-07-08 | índice | 2 web + 12 imagem | 0 | 0 |

O sitemap.xml atual, com as 18 URLs, está sem erro e foi reenviado ontem (2026-08-27). Mas há um sitemap enviado diretamente pela raiz do domínio (`https://drjulianomachado.com/`) que aparece com 1 erro e 0 itens processados, precisa de checagem manual no Search Console para saber o que é esse erro. Além disso, existem dois sitemaps antigos (page-sitemap.xml e sitemap_index.xml) com último envio em julho de 2024, quase dois anos atrás, sinal de estrutura de sitemap legada de uma versão anterior do site que nunca foi removida do Search Console. Nota da própria ferramenta, a API de Sitemaps só reflete contagem de URLs enviadas, não é prova de indexação real, isso só se confirma com URL Inspection.

## 3. GA4, tráfego orgânico (propriedade 449024836)

Janela, 2026-05-30 a 2026-08-27 (90 dias, com 1 dia de defasagem do GA4).

| Métrica | Valor |
|---|---|
| Sessões orgânicas | 19 |
| Usuários orgânicos | 15 |
| Visualizações de página | 65 |
| Média diária de sessões | 1.5 |

Páginas de destino orgânicas (as únicas duas que tiveram sessão no período):

| Página | Sessões | Usuários | Pageviews | Taxa de rejeição | Engajamento |
|---|---|---|---|---|---|
| / | 14 | 9 | 55 | 14.3% | 85.7% |
| /agendamento | 4 | 4 | 10 | 25.0% | 75.0% |

Conversões, não retornadas pelo relatório organic/top-pages desta ferramenta (ela não consulta eventos de conversão configurados no GA4), não constam neste arquivo.

Volume de tráfego orgânico extremamente baixo, 19 sessões em 90 dias equivalem a menos de uma sessão orgânica a cada 4 dias. A propriedade duplicada `449076345`, mencionada como possível rastreamento redundante do mesmo GTM, não foi consultada nesta rodada.

## 4. CrUX History, Core Web Vitals de campo (origem, form factor ALL)

Alvo consultado: `https://drjulianomachado.com` (nível de origem, agregando todas as páginas). Série de 25 janelas móveis de 28 dias, de 2026-02-08 até 2026-08-22, com vários pontos nulos por baixo volume de tráfego Chrome.

ATENÇÃO DE DATA. A última janela da série (2026-07-26 a 2026-08-22) não tem dado nenhum, todas as métricas nulas por tráfego insuficiente naquela semana específica. A última janela com dado utilizável termina em 2026-08-01, ou seja, quase um mês antes da mudança de pré-renderização de hoje (28/08/2026). Nenhuma janela do CrUX cobre a mudança de hoje. Os números abaixo são o estado de ANTES da pré-renderização, não depois.

Última janela com dado, 2026-07-05 a 2026-08-01:

| Métrica | p75 | Classificação | % Bom | % Precisa melhorar | % Ruim |
|---|---|---|---|---|---|
| LCP | 4.132 ms | Ruim (limite ruim é 4.000 ms) | 40.4% | 32.0% | 27.6% |
| FCP | 3.527 ms | (limite bom 1.800 / ruim 3.000) | 37.3% | 25.3% | 37.4% |
| CLS | 0.0 | Bom (limite bom 0.1) | 97.6% | 2.4% | 0.0% |
| TTFB | 2.056 ms | (limite bom 800 / ruim 1.800) | 23.4% | 40.3% | 36.3% |
| INP | sem dado | insuficiente em toda a série de 6 meses | , | , | , |

O valor de LCP de 4.132 ms bate exatamente com o número de referência mencionado na tarefa. Tendência de 6 meses (fev a ago de 2026), a ferramenta classifica o LCP como "stable" com variação de +1.4% (piora leve), média do início da série 4.876 ms contra 4.946 ms no fim.

Complemento de laboratório (PageSpeed Insights, rodado hoje, 2026-08-28, por volta de 22h56 UTC, momento incerto em relação ao deploy da pré-renderização de hoje, então não deve ser lido como "depois" com certeza):

| Estratégia | Performance | LCP laboratório | FCP laboratório | CLS laboratório |
|---|---|---|---|---|
| Mobile | 77/100 | 4,4 s | 2,1 s | 0.002 |
| Desktop | 100/100 | 0,7 s | 0,4 s | 0.000 |

CrUX no nível da URL exata da home (não da origem) retornou erro, "No CrUX data for this origin, the site likely has insufficient Chrome traffic volume for eligibility". Só o agregado de origem tem dado, e mesmo assim é esparso.

## 5. Migração do domínio antigo (drjulianosmachado.com.br)

Nenhum sinal direto dessa migração foi encontrado nos dados coletados nesta rodada. Não apareceu nenhuma consulta de busca relacionada ao domínio antigo nas listas de consultas de 28 e de 90 dias. Nas 19 chamadas de URL Inspection desta rodada, o campo referring_urls só veio preenchido para 3 URLs (home, política de privacidade e iridotomia a laser), e nenhuma delas cita drjulianosmachado.com.br. Essa amostra é pequena e não é uma checagem exaustiva de backlinks, então isso não prova ausência de sinal, só que não apareceu nas URLs verificadas aqui. As ferramentas usadas nesta rodada não têm um endpoint dedicado ao status da Mudança de Endereço do Search Console, essa informação normalmente só aparece na interface do Search Console em Configurações, Mudança de Endereço, e não foi possível confirmar via API nesta rodada.

## Erros e itens não consultados nesta rodada

- Propriedade GA4 duplicada `449076345`, não consultada.
- Status oficial de Mudança de Endereço no Search Console, sem endpoint de API disponível nas ferramentas usadas, só confirmável na interface web do Search Console.
- Uma chamada teve erro transitório e foi refeita com sucesso, a primeira tentativa de gsc_inspect.py em /politica-de-privacidade falhou com timeout de rede, WinError 10060, uma tentativa de conexão falhou porque o host conectado não respondeu. A segunda tentativa retornou normalmente e o dado usado neste arquivo é da segunda tentativa.
- Fora isso, nenhuma chamada retornou erro. Todas as chamadas de gsc_query, ga4_report, crux_history, pagespeed_check e as 22 chamadas de gsc_inspect.py (18 URLs do sitemap mais 4 rotas fora do sitemap) tiveram error null e código de saída 0.
