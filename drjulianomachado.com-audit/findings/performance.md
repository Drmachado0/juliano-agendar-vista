# Performance (CWV) - nota 38/100

## O que esta certo

- CLS de 0,048 no campo, dentro do bom
- Assets com cache immutable de 1 ano
- Fontes auto-hospedadas com preload, sem ida ao Google Fonts
- modulepreload ja configurado para os chunks principais

## Achados

### [Critical] LCP de 4.946 ms no campo (CrUX p75), faixa ruim

Dados reais de 25 semanas: LCP 4.946ms, FCP 4.041ms, TTFB 2.119ms, CLS 0,048, INP sem dados. Em laboratorio com emulacao movel, FCP e LCP sao IGUAIS na home (3.132ms): nada pinta antes do JS executar e o React montar. O elemento LCP e um paragrafo de texto, nao imagem. Nao adianta otimizar imagem porque imagem nao e o gargalo.

**Correcao:** O conserto estrutural e servir HTML pronto, que e o que o prerender faria e nao roda na Lovable. Sem ele, os ganhos sao marginais: enxugar o caminho critico.

### [High] 258,6 KB gzip no caminho critico, com Supabase carregado ate onde nao e usado

O index.html e compartilhado por todas as rotas e faz modulepreload de supabase (48,2 KB gzip), que paginas informativas como /procedimentos/glaucoma nao usam ate haver interacao. Entry 112,8 + react 57,2 + supabase 48,2 + css 26,1 + query 11,9.

**Correcao:** NAO basta tirar o modulepreload: supabase e import ESTATICO da raiz, via AuthContext (que envolve o app todo) e WhatsAppButton (presente em toda pagina). Sem o preload os mesmos bytes continuariam necessarios, so descobertos mais tarde - seria pessimizacao. O ganho real exige import dinamico nos dois: no WhatsAppButton e trivial, porque so usa supabase dentro do clique; no AuthContext e refatoracao do bootstrap de autenticacao, que merece decisao propria por mexer em login de sistema em producao.

### [High] TTFB de 2.119 ms no campo

Medido daqui: 1,7s a frio e 0,21s quente. O HTML vai com no-cache, must-revalidate, entao nao fica na borda da Cloudflare e cada visita nova busca na origem.

**Correcao:** Fora do nosso controle na Lovable. Seria resolvido por host que permita cache de HTML na borda com revalidacao.
