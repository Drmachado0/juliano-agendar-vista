# Auditoria SEO completa - drjulianomachado.com

**Data:** 27/08/2026  
**Health Score:** 79/100  
**Tipo:** Local Service - Medical Practice (oftalmologia, 2 cidades)

Medicao: as 18 URLs do sitemap foram renderizadas com Playwright esperando h1 e canonical, porque o HTML cru e casca e daria falso negativo. Dados de campo do CrUX, 25 semanas.

## Notas por categoria

| Categoria | Nota | Peso |
|---|---|---|
| Technical SEO | 82/100 | 22% |
| Content Quality | 88/100 | 23% |
| On-Page SEO | 86/100 | 20% |
| Schema / Structured Data | 92/100 | 10% |
| Performance (CWV) | 38/100 | 10% |
| AI Search Readiness | 55/100 | 10% |
| Images | 96/100 | 5% |

## Principais achados

1. LCP de 4.946ms no campo, faixa ruim, porque nada pinta antes do JS executar
2. HTML servido e casca de 9,8 KB nas 18 rotas; prerender nao roda no build da Lovable
3. Crawler de IA sem execucao de JS nao ve conteudo nenhum
4. 258,6 KB gzip no caminho critico, com Supabase pre-carregado ate onde nao e usado
5. Seis titulos passam de 60 caracteres e sao cortados no resultado

## Situacao dos ganhos rapidos

- FEITO: seis titulos encurtados para caber em 60 caracteres
- FEITO: cinco descriptions aparadas para a faixa de 120-160
- CANCELADO: tirar supabase do modulepreload seria pessimizacao, ver Performance
- CANCELADO: o alt vazio de /paragominas e correto, imagem decorativa com aria-hidden
- Ampliar /procedimentos, hoje com 170 palavras

---

## Technical SEO - 82/100

### O que esta certo

- robots.txt libera o site e bloqueia /admin/, /auth e /obrigado, com Sitemap declarado
- sitemap.xml com 18 URLs, todas respondendo 200
- canonical auto-referente e unico nas 18 paginas
- http:// e www. redirecionam para a versao canonica https sem www
- HSTS com includeSubDomains, X-Content-Type-Options e Referrer-Policy presentes
- assets com Cache-Control immutable de 1 ano

### Achados

**[High] O HTML servido e uma casca de 9,8 KB nas 18 rotas**

Producao devolve o mesmo shell sem h1, canonical ou JSON-LD para toda rota. O prerender existe e funciona no build local (18 rotas em 9s), mas o container de build da Lovable nao tem as bibliotecas de sistema do Chromium (libglib-2.0.so.0, exitCode=127), registrado em /prerender-status.json. O Google executa JS e indexa normalmente; o prejuizo e para buscadores e crawlers que nao executam.

*Correcao:* Decisao ja tomada de aceitar. Se virar prioridade: Chromium empacotado, SSG sem navegador, ou troca de host. Ver .claude/skills/prerender-na-lovable/.

**[Low] Falta X-Frame-Options e Content-Security-Policy**

Os cabecalhos cobrem HSTS, nosniff e Referrer-Policy, mas nao ha protecao contra clickjacking nem CSP.

*Correcao:* Baixa prioridade em site institucional. Se a Lovable permitir cabecalho customizado, adicionar X-Frame-Options: SAMEORIGIN.

---

## Content Quality - 88/100

### O que esta certo

- 18 paginas com conteudo clinico proprio, entre 170 e 1.415 palavras
- E-E-A-T forte: CRM-PA 15253 visivel, formacao detalhada, revisao medica com data e revisor
- MedicalWebPage.lastReviewed e reviewedBy alimentados por fonte unica (REVISAO_CLINICA)
- Seis exames que eram becos sem saida agora tem pagina propria e interligada
- Nenhum titulo ou description duplicado entre as 18 paginas

### Achados

**[Low] /procedimentos tem 170 palavras e /agendamento tem 224**

As duas unicas paginas abaixo de 300 palavras. Ambas sao de navegacao ou transacao, nao de conteudo, entao o volume baixo e coerente com a funcao.

*Correcao:* Em /procedimentos, um paragrafo curto por grupo de exames captaria buscas amplas sem competir com as filhas. /agendamento pode ficar como esta.

---

## On-Page SEO - 86/100

### O que esta certo

- Exatamente um H1 por pagina nas 18
- Hierarquia H2/H3 coerente, ate 14 H2 nas paginas longas
- Nenhuma tag duplicada de canonical ou description
- html lang=pt-BR e og:image em todas

### Achados

**[Medium] Seis titulos passam de 60 caracteres**

consulta-oftalmologica (67), biometria-ultrassonica (67), cirurgia-de-catarata (65), cirurgia-de-pterigio (65), mapeamento-de-retina (65) e iridotomia-a-laser (63). O Google corta perto de 60, entao o sufixo com o nome do medico some do resultado.

*Correcao:* Encurtar para caber. Ex.: Biometria Ultrassonica em Paragominas | Dr. Juliano Machado, que da 57.

**[Low] Seis descriptions fora da faixa de 120-160**

capsulotomia-yag-laser (180) e glaucoma (177) passam do corte; politica-de-privacidade (111) fica curta.

*Correcao:* Aparar as duas longas para 155-160. A da politica pode ficar.

---

## Schema / Structured Data - 92/100

### O que esta certo

- @graph completo: Physician, MedicalClinic, MedicalWebPage, MedicalProcedure, FAQPage, BreadcrumbList, ItemList
- MedicalWebPage com lastReviewed e reviewedBy nas 17 paginas de conteudo
- BreadcrumbList em 12 paginas, FAQPage em 14
- aggregateRating auto-declarado removido, que era achado da auditoria anterior
- Quatro blocos JSON-LD por pagina de procedimento

### Achados

**[Info] /politica-de-privacidade sem structured data**

Unica pagina sem JSON-LD.

*Correcao:* Um WebPage simples fecharia, mas o ganho e proximo de zero.

---

## Performance (CWV) - 38/100

### O que esta certo

- CLS de 0,048 no campo, dentro do bom
- Assets com cache immutable de 1 ano
- Fontes auto-hospedadas com preload, sem ida ao Google Fonts
- modulepreload ja configurado para os chunks principais

### Achados

**[Critical] LCP de 4.946 ms no campo (CrUX p75), faixa ruim**

Dados reais de 25 semanas: LCP 4.946ms, FCP 4.041ms, TTFB 2.119ms, CLS 0,048, INP sem dados. Em laboratorio com emulacao movel, FCP e LCP sao IGUAIS na home (3.132ms): nada pinta antes do JS executar e o React montar. O elemento LCP e um paragrafo de texto, nao imagem. Nao adianta otimizar imagem porque imagem nao e o gargalo.

*Correcao:* O conserto estrutural e servir HTML pronto, que e o que o prerender faria e nao roda na Lovable. Sem ele, os ganhos sao marginais: enxugar o caminho critico.

**[High] 258,6 KB gzip no caminho critico, com Supabase carregado ate onde nao e usado**

O index.html e compartilhado por todas as rotas e faz modulepreload de supabase (48,2 KB gzip), que paginas informativas como /procedimentos/glaucoma nao usam ate haver interacao. Entry 112,8 + react 57,2 + supabase 48,2 + css 26,1 + query 11,9.

*Correcao:* NAO basta tirar o modulepreload: supabase e import ESTATICO da raiz, via AuthContext (que envolve o app todo) e WhatsAppButton (presente em toda pagina). Sem o preload os mesmos bytes continuariam necessarios, so descobertos mais tarde - seria pessimizacao. O ganho real exige import dinamico nos dois: no WhatsAppButton e trivial, porque so usa supabase dentro do clique; no AuthContext e refatoracao do bootstrap de autenticacao, que merece decisao propria por mexer em login de sistema em producao.

**[High] TTFB de 2.119 ms no campo**

Medido daqui: 1,7s a frio e 0,21s quente. O HTML vai com no-cache, must-revalidate, entao nao fica na borda da Cloudflare e cada visita nova busca na origem.

*Correcao:* Fora do nosso controle na Lovable. Seria resolvido por host que permita cache de HTML na borda com revalidacao.

---

## AI Search Readiness - 55/100

### O que esta certo

- llms.txt publicado com as 18 paginas e resumo do consultorio
- robots.txt nao bloqueia crawlers de IA
- Conteudo em perguntas e respostas, formato que LLM cita bem
- FAQPage em 14 paginas com perguntas que sao buscas reais

### Achados

**[High] Crawler que nao executa JS enxerga pagina vazia**

O HTML cru tem 9,8 KB e nenhum conteudo. Boa parte dos crawlers de IA nao renderiza JavaScript, entao llms.txt e FAQPage nao compensam: o texto que eles citariam nao esta la. Os previews de link do WhatsApp e Facebook sobrevivem apenas pelas tags og estaticas do index.html.

*Correcao:* Mesmo conserto do prerender. Ate la, o llms.txt e a unica superficie que esses crawlers leem de verdade, entao vale mante-lo rico.

---

## Images - 96/100

### O que esta certo

- og:image nas 18 paginas
- alt presente em praticamente todas as imagens
- Fontes auto-hospedadas em woff2 com subset latin
- A unica imagem sem texto alternativo e um logo decorativo com alt vazio e aria-hidden, que e a marcacao correta: alt vazio evita anuncio duplicado no leitor de tela
