# Auditoria Tecnica de SEO, drjulianomachado.com
Data: 2026-08-28

## Nota: 55/100

O SSG novo funciona bem e cobre as 18 URLs do sitemap com HTML completo (title, h1, meta description, Open Graph, JSON-LD). O problema central da nota baixa nao esta nessas 18 paginas, esta em tudo que fica fora delas. Qualquer rota, existente ou nao no app React, cai num fallback que devolve a home inteira com HTTP 200, index/follow e canonical para "/". Isso inclui pelo menos uma pagina de conversao real (`/paragominas/agendamento`) que nunca sera indexada como ela mesma, e dois redirects que hoje so existem no cliente. Some a isso a ausencia total de CSP, Permissions-Policy e X-Frame-Options num site de saude que coleta dados de agendamento, e o redirect de www com status 302 em vez de 301.

## O que esta certo

- Sitemap.xml valido (18 URLs, todas HTTP 200), declarado corretamente no robots.txt e confirmado pelo `sitemap_discovery.py`.
- As 18 rotas do sitemap tem HTML pre-renderizado completo: title, h1 unico, meta description, Open Graph, canonical e JSON-LD (`@graph` com Physician, MedicalClinic, Organization, FAQPage, entre outros tipos, 5958 bytes, valido).
- `render_page.py --mode auto` classificou a home como `is_spa: false` e `mode_used: raw`, ou seja, nao precisou de Playwright. `content` e `raw_content` sao identicos (146943 caracteres), sem gap de hidratacao nas rotas do sitemap.
- HTTPS forcado (http para https em 301 direto, sem hops extras).
- HSTS com includeSubDomains, X-Content-Type-Options nosniff e Referrer-Policy strict-origin-when-cross-origin presentes em todas as respostas testadas, inclusive em respostas 404 e de redirect.
- Cache de assets estaticos hasheados (JS, CSS, imagens em `/assets/`) com Cache-Control publico, max-age de um ano, immutable, com ETag. Bom para Core Web Vitals em visitas recorrentes.
- Fontes auto-hospedadas com preload e font-display swap, evitando bloqueio de renderizacao por origem de terceiros (comentario no proprio HTML documenta a decisao).
- Viewport correto e responsivo: width=device-width, initial-scale=1.0, viewport-fit=cover.
- Paths de exploit tipicos de WordPress (/wp-login.php e variantes .php) recebem 404 real do Cloudflare, nao caem no fallback do SPA.

## Achados por severidade

### CRITICAL

**1. Fallback universal devolve a home inteira para qualquer rota fora do sitemap, incluindo paginas reais do app e redirects que so existem no cliente**

O `scripts/ssg.mjs` so pre-renderiza as 18 rotas do sitemap. Qualquer outro path bate no `index.html` do SPA, que o servidor sempre responde com HTTP 200. Isso ja era conhecido para slugs inventados, mas a verificacao aprofundada mostrou que o mesmo problema atinge rotas reais listadas em `src/App.tsx`.

| Rota | O que deveria acontecer | O que o servidor devolve |
|---|---|---|
| /paragominas/agendamento | pagina real, componente ParagominasAgendamento, fora do sitemap | copia byte a byte da home |
| /agendar | redirect 301 para /agendamento | copia byte a byte da home, HTTP 200 |
| /agendar-consulta | redirect 301 para /agendamento | copia byte a byte da home, HTTP 200 |
| /obrigado | pagina de obrigado, bloqueada no robots.txt | copia byte a byte da home |

Evidencia (verificado nesta sessao):
```
curl -s https://drjulianomachado.com/paragominas/agendamento | wc -c   -> 147248
curl -s https://drjulianomachado.com/agendar | wc -c                  -> 147248
curl -s https://drjulianomachado.com/agendar-consulta | wc -c         -> 147248
curl -s https://drjulianomachado.com/obrigado | wc -c                 -> 147248
```
Nas quatro, o title, o meta robots (index, follow) e as duas tags link canonical apontando para https://drjulianomachado.com/ sao identicos aos da home.

O mesmo padrao se confirma para slugs totalmente inventados (testado com variacoes de querystring, maiuscula, barra final, subpath de procedimentos e barra dupla):
```
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "https://drjulianomachado.com/rota-que-nao-existe-xyz?foo=bar"    -> 200 147248
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "https://drjulianomachado.com/ROTA-MAIUSCULA-XYZ"                -> 200 147248
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "https://drjulianomachado.com/rota-inexistente-barra/"           -> 200 147248
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "https://drjulianomachado.com/procedimentos/slug-que-nao-existe" -> 200 147248
curl -s -o /dev/null -w "%{http_code} %{size_download}\n" "https://drjulianomachado.com//dupla-barra-teste"                -> 200 147248
```
Home real, para comparacao: `curl -s -o /dev/null -w "%{http_code} %{size_download}\n" https://drjulianomachado.com/` retorna 200 147248 (mesmo tamanho, mesma pagina).

Risco real por tipo de URL:
- /paragominas/agendamento (risco alto). E uma pagina de negocio, nao um erro do usuario. Como o canonical dela aponta para "/", ela nunca vai ranquear como ela mesma. Se algum canal externo (Ads, WhatsApp, redes sociais) linkar para essa URL, o link equity e sinalizado para a home, nao para a pagina de conversao de Paragominas, e a pagina em si fica invisivel para quem busca por ela no Google.
- /agendar e /agendar-consulta (risco medio). Sao redirects declarados so no React Router, o servidor nunca devolve 301 ou 302 para essas duas URLs. Cada uma vira, do ponto de vista do Googlebot, mais uma URL totalmente duplicada da home (nao da pagina de agendamento real). O canonical consistente para "/" tende a evitar indexacao separada, mas isso depende do Google respeitar o canonical em escala e desperdica rastreamento.
- Slugs inventados e /obrigado (risco baixo a medio). O robots.txt ja bloqueia /obrigado via Disallow, entao o Googlebot normalmente nem baixa esse HTML, mas qualquer humano que acesse esse link direto (por exemplo depois de preencher um formulario) ve a home em vez da pagina de agradecimento. Para slugs aleatorios, o padrao de dezenas de URLs com canonical para / e o cenario mais provavel de gerar avisos do tipo "pagina alternativa com tag canonical adequada" no Search Console, sem indexacao indevida, mas com rastreamento desperdicado.

Correcao, considerando o stack (SSG proprio mais Lovable atras de Cloudflare):
- Nao da para servir HTTP 404 real para rotas de SPA nesse stack hoje. Qualquer path sem arquivo estatico correspondente cai no index.html, que o servidor sempre responde 200. Isso so muda com uma camada de roteamento por status na borda (Cloudflare Worker, ou um mecanismo de redirects com status code exposto pela Lovable), que nao esta disponivel atualmente. Enquanto isso nao existir, noindex e o teto realista, nao 404.
- Curto prazo, dentro do proprio `scripts/ssg.mjs`: comparar o path solicitado contra a lista de rotas validas (o `scripts/atualizar-lastmod.mjs` ja faz essa leitura de rotas a partir do App.tsx, reaproveitar a mesma logica) e, para qualquer path fora dessa lista, servir um HTML de fallback diferente da home, trocando so duas coisas no head: meta robots como "noindex, follow" no lugar do atual "index, follow", e nao emitir a tag link canonical apontando para a home (ou apontar para a propria URL solicitada, sem indexar). Isso e viavel porque o SSG ja controla o head por rota, e nao exige mudanca na Lovable nem no Cloudflare.
- Para as rotas reais que faltam: /paragominas/agendamento precisa entrar no sitemap e ganhar HTML proprio pelo SSG, do mesmo jeito que as 18 atuais. /agendar e /agendar-consulta precisam de redirect real no servidor (301 para /agendamento), nao so no React Router. Como o site esta atras de Cloudflare, uma Redirect Rule ou Bulk Redirect no painel do Cloudflare resolve isso sem depender de mudanca no build da Lovable.

### CRITICAL

**2. Ausencia total de Content-Security-Policy, Permissions-Policy e X-Frame-Options**

Verificado em todas as respostas testadas (home, assets, redirects, bloqueio de .php):
```
curl -sI https://drjulianomachado.com/ | grep -iE "content-security-policy|permissions-policy|x-frame-options"
-> nenhum resultado, nenhum dos tres headers esta presente
```
Isso vale tanto para o documento HTML quanto para os assets estaticos verificados.

Risco: o site e de uma clinica medica com formulario de agendamento (dados pessoais sob LGPD). Sem X-Frame-Options ou frame-ancestors via CSP, qualquer site terceiro pode carregar drjulianomachado.com dentro de um iframe e montar um ataque de clickjacking sobre o formulario de agendamento. Sem Permissions-Policy, scripts de terceiros carregados condicionalmente (Google Tag Manager, e via GTM o Meta Pixel, conforme o proprio bootstrap de consentimento no HTML) herdam acesso padrao a APIs sensiveis do navegador (camera, microfone, geolocalizacao) caso algum desses scripts seja comprometido. A ausencia de CSP tambem amplia a superficie de um XSS caso alguma dependencia de terceiro seja comprometida.

Correcao (via Cloudflare, sem mudar o build da Lovable):
- Adicionar X-Frame-Options como SAMEORIGIN (ou equivalente via frame-ancestors self na CSP) atraves de uma Transform Rule de resposta no Cloudflare.
- Adicionar Permissions-Policy restringindo pelo menos camera, microphone e geolocation (liberar geolocation apenas se algum recurso do site usar, como localizar a unidade mais proxima).
- Adicionar CSP comecando em modo Report-Only para mapear os dominios reais em uso antes de bloquear (evitar quebrar o GTM condicional por LGPD). Dominios ja identificados no HTML: googletagmanager.com (carregado condicionalmente apos consentimento). Fontes ja sao self-hosted, entao nao ha mais dependencia de fonts.googleapis.com. Sugestao de diretivas, cada uma tratada como um item isolado (a juncao final delas segue a sintaxe padrao de CSP, nao reproduzida aqui literalmente):
  - default-src: self
  - script-src: self, googletagmanager.com
  - connect-src: self, google-analytics.com
  - img-src: self, data, https
  - frame-ancestors: self
  - base-uri: self

### HIGH

**3. Redirect de www para apex e 302, nao 301**

```
curl -sI http://www.drjulianomachado.com/  -> HTTP/1.1 302 Found, Location: https://drjulianomachado.com/
curl -sI https://www.drjulianomachado.com/ -> HTTP/1.1 302 Found, Location: https://drjulianomachado.com/
```
Comparar com o apex sem www, que redireciona corretamente: `curl -sI http://drjulianomachado.com/` devolve 301 Moved Permanently.

Um 302 sinaliza redirecionamento temporario. Motores de busca podem continuar considerando www como URL candidata em vez de consolidar todo o sinal na apex. Correcao: trocar a regra de redirect do host www no Cloudflare (Page Rule ou Redirect Rule) de 302 para 301. E mudanca de configuracao de borda, sem risco para a aplicacao.

**4. H1 da pagina de agendamento nao descreve a pagina**

A pagina /agendamento, o funil de conversao mais importante do site, tem um unico h1, e ele esta dentro do header fixo com o nome da marca, nao com um titulo da etapa:
```
<h1 class="text-base font-serif font-semibold leading-tight text-foreground md:text-lg">Dr. Juliano Machado</h1>
```
O titulo real da etapa ("Quem vai ser atendido?") esta como h3, subordinado a um h1 que nao fala da acao da pagina.

Correcao: mover o h1 semantico para o titulo da etapa do wizard (por exemplo, um heading do tipo "Agendar Consulta com Dr. Juliano Machado" acima do formulario) e rebaixar o nome da marca no cabecalho fixo para um elemento sem peso de heading (span ou p), ou no maximo h2, mantendo um unico h1 por pagina que descreva o conteudo.

### MEDIUM

**5. Meta robots ausente em 2 das 18 paginas do sitemap**

/agendamento e /procedimentos (pagina indice) nao emitem a tag meta robots, enquanto as outras 16 rotas do sitemap emitem "index, follow" explicitamente:
```
https://drjulianomachado.com/              -> tag meta robots presente
https://drjulianomachado.com/agendamento   -> tag meta robots ausente
https://drjulianomachado.com/procedimentos -> tag meta robots ausente
(demais 15 rotas checadas individualmente -> tag meta robots presente)
```
Ausencia de tag equivale a index, follow por padrao, entao nao ha problema pratico de indexacao hoje. E uma inconsistencia de template que sugere que essas duas rotas nao herdam o mesmo bloco de Helmet das demais no `scripts/ssg.mjs`, o que e um risco de regressao silenciosa (um dia podem herdar noindex por engano, ou nao herdar nada em uma mudanca futura). Correcao: adicionar a tag explicitamente nessas duas rotas por consistencia.

**6. Canonical duplicado em todas as 18 paginas**

Toda pagina tem duas tags link rel canonical, uma com o atributo data-rh true (react-helmet, gerada no SSG) e outra sem:
```
<link data-rh="true" rel="canonical" href="https://drjulianomachado.com/agendamento"/>
<link rel="canonical" href="https://drjulianomachado.com/agendamento" />
```
Confirmado que os valores coincidem nas 18 URLs verificadas, entao nao ha ambiguidade de qual URL e a canonica hoje. Ainda assim, duas declaracoes identicas nao sao validas segundo a especificacao (deveria haver uma unica), e sugerem que o template base (index.html) ja tem uma tag canonical estatica e o Helmet injeta outra por cima, sem substituir a primeira. Se um dia o valor estatico e o gerado pelo SSG divergirem, isso vira uma ambiguidade real. Correcao: no `scripts/ssg.mjs` ou `scripts/build-ssr.mjs`, fazer o Helmet substituir a tag canonical do template base em vez de adicionar uma segunda.

**7. prerender-status.json e um resquicio enganoso do pipeline antigo**

Ainda publico e respondendo com um erro do pipeline Playwright descontinuado:
```
curl -s https://drjulianomachado.com/prerender-status.json
-> motivo: sem-chromium, carimbo 2026-08-28T22:24:56Z, com erro de libglib-2.0.so.0 ausente
```
O SSG atual, baseado em renderToPipeableStream, ja resolveu o problema real, confirmado nesta auditoria (render_page.py retornou is_spa false, com content igual a raw_content). O arquivo hoje e um falso-negativo. Quem rodar `npm run monitorar:seo` (que le esse arquivo) vai concluir que o site ainda depende de prerender quebrado, e nao vai olhar para o problema real, que e o fallback universal do achado 1. Alem disso, o endpoint expoe detalhes de infraestrutura interna (caminhos e flags do Playwright) publicamente, sem necessidade.

Correcao: remover a geracao desse arquivo do pipeline de build antigo, e atualizar `scripts/monitorar-seo.mjs` para validar o SSG novo diretamente (por exemplo, baixar uma rota do sitemap e checar h1, canonical e JSON-LD, como esta auditoria fez), em vez de ler um artefato do prerender Playwright que nao e mais o mecanismo em uso. Enquanto isso nao e feito, bloquear /prerender-status.json no robots.txt e parar de gerar esse arquivo em producao.

### LOW e INFO

**8.** O redirect de http para https no apex e limpo, 301 direto, sem cadeia de hops intermediarios. Sem correcao necessaria.

**9.** .php e paths de exploit comuns (/wp-login.php) recebem 404 real do Cloudflare, nao caem no fallback do SPA descrito no achado 1, o que e positivo, mas nao ficou claro se e uma regra deliberada da Lovable ou do Cloudflare, ou um comportamento incidental da borda. Ver secao "Onde nao verificou".

**10.** O campo extracted_text do render_page.py retornou apenas 881 caracteres para a home, bem abaixo do texto visivel real (cerca de 6958 caracteres so na home, medido removendo script, style e demais tags do HTML). Isso e uma particularidade da extracao de texto da propria ferramenta, parece capturar so um primeiro bloco, nao um problema do site. Registrado para nao gerar falso alarme em auditorias futuras que usem esse campo como proxy de volume de conteudo.

**11.** O atributo lang do html esta correto como pt-BR, sem divergencia entre as paginas verificadas.

**12.** O Cache-Control do documento HTML e no-cache, must-revalidate, com max-age zero, em todas as paginas testadas. Correto para HTML que muda a cada deploy, evita que o Cloudflare sirva uma versao desatualizada apos publicacao. Sem correcao necessaria, registrado para completude do panorama de cache.

## Onde nao verificou

- Nao foi possivel confirmar via ferramenta se o bloqueio de .php e outros paths de exploit e uma regra deliberada configurada no Cloudflare (WAF ou Redirect Rule) ou um comportamento padrao da borda. Nao verificado.
- Nao foi testado o comportamento de mobile-friendliness em viewport real (emulacao de toque, tamanho de alvos clicaveis, sobreposicao de elementos) alem da leitura estatica da tag viewport e das classes Tailwind responsivas no HTML. Nao ha dados de Lighthouse mobile nem CrUX nesta rodada. Nao verificado em profundidade.
- Nao foi medido LCP, INP ou CLS reais, de campo ou de laboratorio, apenas inspecao de fontes de bloqueio de renderizacao (fontes self-hosted com preload, ja considerado positivo). Nao ha execucao de PageSpeed Insights ou CrUX nesta auditoria. Nao verificado.
- Nao foi verificado o comportamento do fallback de rota fora do sitemap em nenhuma pagina alem das quatro citadas (/paragominas/agendamento, /agendar, /agendar-consulta, /obrigado) e dos slugs inventados testados. E possivel que existam outras rotas reais do App.tsx no mesmo estado, nao mapeadas nesta rodada.
- Nao foi verificado o header Content-Security-Policy ou Permissions-Policy em todas as 18 rotas do sitemap individualmente, apenas na home e em amostras de asset e redirect. Assumido como ausente em todo o site por padrao de infraestrutura compartilhada (Cloudflare na frente de tudo), mas nao checado rota a rota.
- Nao foi lido o conteudo de `scripts/ssg.mjs`, `scripts/build-ssr.mjs` e `scripts/atualizar-lastmod.mjs` diretamente no codigo-fonte para confirmar a causa exata do canonical duplicado e da ausencia de meta robots em duas rotas. Essas correcoes propostas partem do sintoma observado no HTML final, nao de leitura do codigo.
