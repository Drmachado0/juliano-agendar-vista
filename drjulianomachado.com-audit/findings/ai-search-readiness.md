# AI Search Readiness / GEO, drjulianomachado.com

Data: 2026-08-28. Auditoria refeita apos a entrada do SSG em 28/08/2026. Nota anterior deste arquivo: 55/100, medida quando o HTML cru tinha 9,8 KB e nenhum crawler sem JS via conteudo.

## Nota: 60/100 (subiu de 55/100, mas leia a ressalva abaixo antes de comemorar o numero)

A nota anterior de 55 dava credito a coisas que existiam so no codigo React (FAQPage, texto em formato de pergunta e resposta), nao no HTML que um crawler sem JS realmente recebia. Feito o teste estrito de hoje, so olhando para o que um `curl` puro devolve, o patamar real de antes desta mudanca era muito mais baixo que 55 em quase toda dimensao dependente de conteudo (perto de zero em citabilidade, estrutura e autoridade, porque nada disso chegava ao crawler). O ganho de verdade do SSG e maior do que "55 para 60" sugere. Ele destrava, pela primeira vez, a possibilidade de qualquer coisa neste relatorio ser citada por um modelo que nao executa JavaScript. O motivo do numero final nao ser mais alto e um achado novo desta sessao, nao um problema do SSG em si. Passagem por passagem, boa parte do conteudo mais citavel do site, as respostas do FAQ, existe no HTML servido mas fica dentro de uma div de acordeao vazia, invisivel para qualquer extrator de texto que nao interprete o JSON-LD do `<head>`. Isso e detalhado na secao 3.

### Score por dimensao

| Dimensao | Peso | Nota | Pontos |
|---|---|---|---|
| Citabilidade | 25% | 45/100 | 11,25 |
| Legibilidade estrutural | 20% | 78/100 | 15,60 |
| Conteudo multimodal | 15% | 35/100 | 5,25 |
| Autoridade e sinais de marca | 20% | 55/100 | 11,00 |
| Acessibilidade tecnica para IA | 20% | 85/100 | 17,00 |
| **Total** | | | **60,10, arredondado para 60/100** |

Ferramentas usadas nesta sessao. O wrapper `claude-seo run render_page.py` citado no prompt do agente nao foi localizado no ambiente (busca no filesystem nao retornou o script). Como alternativa, usei `curl` puro com varios User-Agents diferentes, o que e suficiente aqui porque o relatorio irmao `technical-seo.md` ja confirmou nesta mesma data, via `render_page.py --mode auto`, que a home e classificada como `is_spa: false` e que `content` e `raw_content` sao identicos, ou seja, nao ha lacuna de hidratacao a considerar nas 18 rotas do sitemap. Nao havia ferramenta de WebSearch disponivel nesta sessao, usei busca HTML do DuckDuckGo via `curl` como substituto parcial. Nao havia ferramentas DataForSEO disponiveis.

## 1. Acesso de crawlers de IA (testado sem executar JS)

Testei a home com `curl` puro (sem render, sem JS) trocando so o User-Agent:

| Crawler | HTTP | Bytes recebidos | Bloqueado no robots.txt |
|---|---|---|---|
| GPTBot | 200 | 147.248 | Nao |
| ClaudeBot | 200 | 147.248 | Nao |
| PerplexityBot | 200 | 147.248 | Nao |
| CCBot | 200 | 147.248 | Nao |
| Google-Extended | 200 | 147.248 | Nao |
| OAI-SearchBot | 200 | 147.248 | Nao |
| curl generico (sem UA de crawler) | 200 | 147.248 | Nao |

Todas as respostas vieram com o mesmo tamanho e o mesmo HTML, incluindo `<h1>`, texto e o bloco `application/ld+json`. Nao ha cloaking por User-Agent, o crawler de IA recebe exatamente o que um navegador recebe. Antes de 28/08/2026 essa mesma tabela teria 9,8 KB de casca vazia em todas as linhas. Essa e a virada real da mudanca de hoje.

`robots.txt` atual:
```
User-agent: Googlebot
Allow: /
Disallow: /admin/
Disallow: /auth
Disallow: /obrigado

User-agent: Bingbot
Allow: /
Disallow: /admin/
Disallow: /auth
Disallow: /obrigado

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /auth
Disallow: /obrigado

Sitemap: https://drjulianomachado.com/sitemap.xml
```

Nenhum dos seis crawlers de IA listados no briefing (GPTBot, ClaudeBot, PerplexityBot, CCBot, Google-Extended, OAI-SearchBot) tem uma secao propria. Todos caem na regra `User-agent: *`, que da `Allow: /` com as mesmas tres excecoes de admin, auth e obrigado que valem para Googlebot e Bingbot. Ou seja, sim, a regra `*` cobre todos eles e nenhum esta bloqueado. Isso e o comportamento correto para maximizar visibilidade em busca por IA.

Ponto de decisao, nao um erro. CCBot (treina modelos via Common Crawl) e os bots de treinamento da Anthropic e da Cohere citados no briefing como "bloqueio opcional" tambem caem no `*` e portanto estao liberados hoje, inclusive para uso de treinamento, nao so de busca. Isso e uma escolha valida (mais exposicao para modelos que usam Common Crawl como fonte), mas deve ser uma escolha consciente do consultorio, nao um efeito colateral de nao ter regra dedicada. Se o Dr. Juliano quiser permitir busca mas nao treinamento, precisaria de uma regra especifica bloqueando so os bots de treinamento, mantendo GPTBot, ClaudeBot, PerplexityBot e OAI-SearchBot liberados.

## 2. /llms.txt

Status HTTP 200, 2.473 bytes, confirmado nesta sessao.

O que esta certo. O arquivo lista as 18 rotas do sitemap, sem faltar nenhuma e sem citar nenhuma URL morta. Conferi cruzando contra o `sitemap.xml` (tambem 18 URLs) e bate rota a rota. As descricoes de cada link sao curtas e corretas, sem erro factual perceptivel (nomes de clinicas, procedimentos e o texto de abertura com "mais de 15 anos de experiencia" e "CRM-PA 15253", consistente com o que aparece no proprio site).

Ressalva importante, para nao inflar o beneficio. O Google nao usa `/llms.txt` para nada, nem para Search nem para AI Overviews, isso nao e uma politica documentada do Google, e nenhum dos grandes provedores (OpenAI, Anthropic, Perplexity) confirmou publicamente que o arquivo altera taxa de citacao. Na pratica `llms.txt` e uma convencao voluntaria, funciona como um sitemap resumido e legivel por humano, sem garantia de que qualquer sistema de IA de fato o leia antes de responder. Antes do SSG, esse arquivo era o unico lugar onde um crawler sem JS enxergava texto real do site, isso justificava manter o esforco nele mesmo sem prova de impacto. Agora que as 18 paginas tem HTML completo, o `llms.txt` deixa de ser a unica fonte e vira redundante com o conteudo real. Recomendacao, manter como esta (custo de manutencao baixo, sem risco), mas nao tratar como alavanca de prioridade alta daqui para frente. O ganho real esta em corrigir o que aparece na secao 3.

## 3. Citabilidade em nivel de passagem (achado central desta auditoria)

Testei as perguntas do briefing contra o texto realmente extraivel do HTML (descartando `<script>`, replicando o que um pipeline de citacao tipo trafilatura faria, sem ler dentro de `application/ld+json`).

### "O que e pterigio", resposta boa e autocontida, mas curta

Pagina `/procedimentos/cirurgia-de-pterigio`, paragrafo de abertura logo apos o H1:
> "O pterigio e um crescimento de tecido sobre a cornea que pode causar vermelhidao, irritacao e, em alguns casos, alteracao da visao. O Dr. Juliano Machado avalia a indicacao cirurgica e realiza o procedimento em Paragominas e Belem."

32 palavras, direto, sem depender de contexto anterior, cita a entidade e a localizacao. Logo abaixo, o bloco H2 "O que e o pterigio" acrescenta mais duas frases (mecanismo e sintomas), chegando a pouco mais de 60 palavras combinadas. E citavel, mas fica abaixo da faixa otima de 134 a 167 palavras indicada no briefing. Recomendacao de baixo esforco, fundir definicao mais sintomas mais quando procurar ajuda num unico bloco de resposta direta perto de 150 palavras.

### "Quanto tempo dura a cirurgia de catarata", a resposta existe, mas esta invisivel para quem le so o HTML renderizado

Esse e o achado mais importante da secao. A pergunta aparece como H3 na pagina `/procedimentos/cirurgia-de-catarata`, dentro de "Perguntas frequentes". A resposta real existe, mas so dentro do JSON-LD:

```
"name":"Quanto tempo dura a cirurgia?","acceptedAnswer":{"@type":"Answer","text":"A parte cirurgica em si costuma durar poucos minutos por olho. Considerando preparo, anestesia e recuperacao imediata, o tempo total no centro cirurgico e maior. Voce recebera todas as orientacoes antes do procedimento."}
```

No corpo visivel da mesma pagina, o HTML do acordeao dessa mesma pergunta e este, vazio:
```html
<div data-state="closed" id="radix-:Rcktaj:" hidden="" role="region" ... class="overflow-hidden text-sm ..."></div>
```
Sem nenhum texto dentro da div. O componente de acordeao (Radix Accordion) so escreve a resposta no HTML quando o item esta aberto, e a versao pre-renderizada fica com todos os itens fechados e a div de conteudo literalmente vazia, nao e so escondida por CSS, o texto nao esta la. Confirmei o mesmo padrao, acordeao com `hidden=""` e div de conteudo vazia, nas paginas `/procedimentos/cirurgia-de-catarata` (5 perguntas), `/procedimentos/cirurgia-de-pterigio` (5 perguntas), `/procedimentos/glaucoma` (6 perguntas), `/procedimentos/consulta-oftalmologica` (5 perguntas) e `/paragominas` (4 perguntas). Nao testei individualmente as outras 7 paginas de procedimento (mapeamento-de-retina, retinografia, tonometria, gonioscopia, biometria-ultrassonica, iridotomia-a-laser, capsulotomia-yag-laser), mas usam o mesmo template de FAQ, entao o mesmo problema deve se repetir nelas, marco como nao verificado individualmente.

Isso significa que a pergunta exata do briefing, "quanto tempo dura a cirurgia de catarata", tem uma resposta escrita, correta e curta, mas um crawler que extrai so texto de corpo (o que o proprio briefing pede para GEO, extracao ao estilo trafilatura, ignorando script tags) nao a encontra. Ele encontra a pergunta como titulo (H3) e nada embaixo. Para um extrator de passagem isso e pior do que nao ter a pergunta, porque cria uma promessa de resposta sem entrega.

Achei duas paginas que fazem isso certo, prova de que a correcao e so de implementacao, nao de conteudo. Na home, o mesmo componente de acordeao imprime o texto da resposta dentro da div mesmo fechada (sem o atributo `hidden`):
```html
<div data-state="closed" id="radix-:R1d9aj:" ...><div class="pb-4 pt-0 text-sm md:text-base text-muted-foreground leading-relaxed">Muito rapido. Em menos de 1 minuto voce escolhe o horario, preenche seus dados e envia o pedido...</div></div>
```
E a pagina `/belem` nem usa acordeao, o FAQ inteiro (4 perguntas) e texto estatico direto no corpo, sem nenhum componente interativo escondendo nada. As duas abordagens funcionam para citacao. O padrao que falha e o das 11 paginas de procedimentos mais `/paragominas`.

### "Oftalmologista em Paragominas", resposta boa, mas na pagina errada

A melhor resposta direta e autocontida para essa consulta esta na home, nao na landing page dedicada. H1 da home, "Oftalmologista em Paragominas e Belem", seguido do paragrafo "Consultas, exames e cirurgias com o Dr. Juliano Machado. Sao quatro locais de atendimento entre as duas cidades, voce escolhe o mais perto de voce ao agendar." (33 palavras, entidade e localizacao explicitas). Ja a pagina `/paragominas`, que deveria ser a resposta canonica para essa busca, abre com um H1 de tom publicitario, "Sua visao, com mais clareza", que nao menciona a entidade nem a cidade na propria frase, forcando o extrator a montar o contexto a partir de elementos ao redor (breadcrumb, meta title) em vez de uma frase unica autocontida. Recomendacao de baixo esforco, ajustar o H1 ou o paragrafo de abertura de `/paragominas` para incluir explicitamente "Dr. Juliano Machado" e "Paragominas" na mesma frase resposta, do jeito que a home ja faz.

## 4. Sinais de entidade e menção de marca

O `schema.md` desta mesma auditoria ja cobre o JSON-LD em profundidade (nota 58/100, com achados proprios sobre CEP ausente e fragmentacao de grafo nas paginas de procedimento). Aqui registro so o angulo especifico de GEO, correlacao de citacao por IA com presenca de marca fora do site.

O que esta certo no proprio site:
- `Physician` com `identifier` estruturado do CRM (`CRM-PA 15253`), presente de forma consistente em todas as amostras que abri (home, sobre, belem, paragominas, catarata, pterigio). E o desambiguador mais forte que um site de medico pode ter, muito mais confiavel do que casar so pelo nome.
- Nao encontrei nenhum resicuo de "11 anos de experiencia" nem de telefone com DDD 19 no HTML servido nem no texto extraido das paginas amostradas nesta sessao. Todas as menções de tempo de experiencia que vi dizem "mais de 15 anos". Essa checagem cobre so as paginas que abri diretamente, nao uma varredura completa das 18 URLs, marco como parcialmente verificado.
- O dominio antigo `drjulianosmachado.com.br` (com "s" extra) hoje devolve HTTP 301 com `Location: https://drjulianomachado.com/`, confirmado com header completo de navegador (com header `Accept` simplificado o servidor respondia 406, com header completo funciona, registrar essa sensibilidade caso alguem va testar de novo). O redirect esta no ar e funcionando.

O que preocupa, fora do site:
- Apesar do redirect 301 estar correto, o cache de busca ainda mostra o dado antigo. Uma busca por `"Dr. Juliano Machado" oftalmologista Doctoralia` no DuckDuckGo retornou, entre os primeiros resultados, o proprio `drjulianosmachado.com.br` com o snippet "Como oftalmologista com mais de 11 anos de experiencia, meu compromisso e garantir que voce tenha uma visao perfeita..." Esse e exatamente o dado errado que o briefing pediu para procurar, e ele ainda esta circulando hoje, mesmo com o 301 no ar desde hoje. Vai sumir so quando os buscadores re-rastrearem e atualizarem o cache, nao ha acao adicional no site que acelere isso alem de manter o 301 estavel.
- Encontrei dois perfis de Instagram diferentes associados ao nome. O que o proprio site declara em `sameAs` e no rodape e `@drjulianomachado.oftalmo`. A busca tambem retornou `@drjuliano.oftalmo` (2.396 seguidores, mesma bio de oftalmologista, mesmas cidades). Sao handles diferentes, nao uma variacao de exibicao do mesmo, o que sugere ou uma conta antiga ainda ativa ou duas contas concorrentes pelo mesmo profissional. Isso fragmenta o sinal de entidade para qualquer sistema que tente casar "Dr. Juliano Machado oftalmologista" com um unico perfil social. Vale o dono confirmar qual conta e a oficial e, se a outra ainda for dele, unificar ou redirecionar bio para a oficial.
- Achei o Dr. Juliano listado no `agendarconsulta.com` de duas formas. Um perfil individual (`agendarconsulta.com/perfil/dr-dr-juliano-machado-1720017204`, reparar no "dr-dr-" duplicado na propria URL, sinal de cadastro malfeito pelo diretorio) que esta incompleto, o proprio snippet diz "Eu ainda nao disponibilizei essa informacao" para a pergunta "esta aceitando novos pacientes". E a pagina de categoria `agendarconsulta.com/medico-oftalmologista/paragominas`, onde ele aparece como unico oftalmologista listado em Paragominas ("Pagina 1 de 1"). Isso e uma oportunidade barata, e a unica entrada da categoria, completar o perfil custa pouco e tem zero concorrencia direta nesse diretorio especifico.
- Nao encontrei Doctoralia, Wikipedia, YouTube, LinkedIn nem mencoes em Reddit nas buscas feitas nesta sessao. Isso nao prova ausencia total, as buscas foram poucas e uma delas (consulta combinada com OR) nao retornou nenhum resultado utilizavel, marco Doctoralia, Wikipedia, YouTube, LinkedIn e Reddit como nao verificados de forma exaustiva. Dito isso, pelo que a tabela de correlacao do briefing indica, YouTube (0,737) e Wikipedia (alta) sao os sinais mais fortes de todos, mais fortes que Domain Rating (0,266, fraco). Se de fato estiverem ausentes, esse e o maior teto de crescimento da dimensao de Autoridade, mais impactante do que qualquer ajuste de backlink.

## 5. Acessibilidade tecnica (visao GEO do achado ja documentado em technical-seo.md)

O `technical-seo.md` desta auditoria ja registrou como CRITICAL o problema de fallback, qualquer rota fora das 18 do sitemap (`/paragominas/agendamento`, `/agendar`, `/agendar-consulta`, `/obrigado`, e qualquer slug inventado) recebe uma copia byte a byte da home, HTTP 200, com `index, follow` e canonical para "/". Confirmei o mesmo nesta sessao com o User-Agent do GPTBot, as quatro URLs devolveram 147.248 bytes, identico a home.

Do ponto de vista especifico de GEO, o risco nao e so de SEO classico (rastreamento desperdicado, canonical). E que um crawler de IA usa o conjunto de paginas para montar um mapa do que o site oferece. Varias URLs distintas devolvendo o mesmo conteudo parecem, para esse mapa, paginas duplicadas ou um padrao de baixa qualidade, o que pode reduzir a confianca do sistema no dominio inteiro, nao so nessas quatro URLs. O caso mais caro e `/paragominas/agendamento`, uma pagina real de conversao que nunca vai ser reconhecida como ela mesma por nenhum sistema, de busca tradicional ou de IA. Nao vou repetir aqui a tabela de evidencia completa nem o plano de correcao, ja estao detalhados em `technical-seo.md`, achado CRITICAL 1.

## Top 5 mudancas de maior impacto

1. **Impacto alto, esforco medio.** Corrigir o componente de FAQ para manter o texto da resposta no HTML mesmo com o item fechado, replicando o padrao que ja funciona na home (div de conteudo presente, sem `hidden`) ou no formato estatico da pagina Belem. Aplicar nas 11 paginas de `/procedimentos/*` e em `/paragominas`. Isso destrava, de fato, a citacao direta das perguntas de paciente mais buscadas (duracao de cirurgia, cobertura por convenio, dor, recuperacao), hoje escritas mas invisiveis ao extrator de texto.
2. **Impacto alto, esforco baixo a medio.** Resolver o fallback de rotas fora do sitemap (mesmo achado do technical-seo.md), gerar HTML proprio para `/paragominas/agendamento` e aplicar `noindex` ou redirect real de servidor para `/agendar`, `/agendar-consulta` e `/obrigado`, para nao poluir o mapa de conteudo que um crawler de IA constroi do dominio.
3. **Impacto medio, esforco baixo.** Expandir os blocos de definicao (o que e catarata, o que e pterigio, o que e glaucoma) para perto de 134 a 167 palavras cada, unindo definicao, causa e sintoma num unico paragrafo autocontido, hoje ficam entre 30 e 90 palavras.
4. **Impacto medio, esforco baixo.** Higiene de marca fora do site, completar o perfil no agendarconsulta.com (unica entrada da categoria em Paragominas), esclarecer com o Dr. Juliano se `@drjuliano.oftalmo` ainda e uma conta dele para unificar ou redirecionar, e avaliar presenca em Doctoralia, hoje nao encontrada nas buscas realizadas.
5. **Impacto baixo, esforco baixo.** Decisao explicita sobre CCBot e bots de treinamento (anthropic-ai, cohere-ai) no robots.txt, hoje liberados so por caírem no `*`, sem regra propria. Confirmar com o consultorio se isso e o desejado ou se preferem permitir busca (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) e negar treinamento.

## Notas metodologicas e itens nao verificados nesta sessao

- Nao verifiquei individualmente o acordeao de FAQ nas 7 paginas de procedimento que nao abri (mapeamento-de-retina, retinografia, tonometria, gonioscopia, biometria-ultrassonica, iridotomia-a-laser, capsulotomia-yag-laser). Assumo o mesmo padrao das 4 que testei, por usarem o mesmo template, mas isso e uma inferencia, nao uma medicao direta.
- Nao contei eu mesmo as 166 ocorrencias de "CRM-PA 15253" mencionadas por outro fluxo desta auditoria, incorporo o numero sem checagem propria, mas e consistente com a presenca constante que vi amostrando 9 das 18 paginas.
- Ausencia de Doctoralia, Wikipedia, YouTube, LinkedIn e Reddit nao foi confirmada de forma exaustiva, so nao apareceram nas poucas buscas feitas via DuckDuckGo HTML nesta sessao, sem WebSearch nem DataForSEO disponiveis.
- Telefone com DDD 19 (Campinas), residuo do site antigo, nao encontrado nas paginas que abri nem nas buscas feitas, mas nao fiz uma varredura dedicada a esse numero especifico fora do site.
- Os scores por plataforma abaixo sao estimativas qualificadas, baseadas em como cada crawler rastreia (executa JS ou nao), nao testes ao vivo de citacao, por falta de ferramenta de WebSearch ou DataForSEO nesta sessao.

## Scores por plataforma (estimativa qualificada, sem teste ao vivo)

| Plataforma | Antes do SSG | Depois do SSG | Por que |
|---|---|---|---|
| ChatGPT (GPTBot / OAI-SearchBot) | ~10 | ~65 | Esses bots nao executam JS, o shell vazio era invisivel, agora leem HTML completo, mas ainda perdem as respostas de FAQ nas paginas de procedimento e em Paragominas |
| Perplexity (PerplexityBot) | ~10 | ~62 | Mesma logica do ChatGPT, Perplexity favorece trechos curtos e diretos, a perda das respostas de FAQ pesa proporcionalmente mais aqui |
| Google AI Overviews | ~50 | ~65 | Googlebot renderiza JS ha anos, o Google provavelmente ja via boa parte do conteudo renderizado mesmo antes do SSG, o ganho vem mais de velocidade e consistencia de indexacao do que de um desbloqueio total |
| Bing Copilot (Bingbot) | ~45 | ~68 | Bingbot tambem renderiza JS e ja estava liberado explicitamente no robots.txt antes, ganho moderado, menor que ChatGPT e Perplexity |
