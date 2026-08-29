# Auditoria de Sitemap — drjulianomachado.com

**Categoria:** Sitemap Architecture
**Data:** 2026-08-29
**Ferramentas:** `sitemap_discovery.py` (claude-seo), `curl` (status codes, canonical, robots meta)

## Descoberta do sitemap

`sitemap_discovery.py https://drjulianomachado.com --json` retornou:

- **Declarado em robots.txt:** `https://drjulianomachado.com/sitemap.xml` → HTTP 200, `urlset` válido ✅
- Caminhos comuns alternativos (`sitemap_index.xml`, `sitemap-index.xml`, `wp-sitemap.xml`) → 404 (esperado, não é falha)
- O robots.txt declara o sitemap corretamente na última linha: `Sitemap: https://drjulianomachado.com/sitemap.xml`

## Relatório de validação

| Check | Resultado | Severidade |
|---|---|---|
| XML válido (`urlset`, namespace 0.9) | ✅ Pass | — |
| ≤50.000 URLs / ≤50MB | ✅ Pass (18 URLs, 3.431 bytes) | — |
| Todas as URLs retornam HTTP 200 | ✅ Pass (18/18 testadas individualmente) | — |
| Sem URLs noindex no sitemap | ✅ Pass (16/18 com `index, follow` explícito; `/agendamento` e `/procedimentos` sem meta robots = indexável por padrão) | — |
| Sem URLs redirecionadas no sitemap | ✅ Pass (nenhum redirect nas 18) | — |
| Apenas HTTPS, host apex consistente | ✅ Pass | — |
| Canonical de cada página == URL do sitemap | ✅ Pass (18/18 verificados, ex.: `/belem` → `href="https://drjulianomachado.com/belem"`) | — |
| `<lastmod>` em W3C Datetime válido | ✅ Pass (formato `2026-08-29`) | — |
| `<lastmod>` reflete modificação real | ⚠️ Suspeito — as 18 URLs têm **exatamente o mesmo** `2026-08-29` | Low |
| Tags deprecated `<priority>` / `<changefreq>` | ⚠️ Presentes em todas as 18 URLs | Info |
| Sitemap referenciado no robots.txt | ✅ Pass | — |

## Cobertura: crawl vs. sitemap

**Páginas no sitemap (18):** `/`, `/agendamento`, `/paragominas`, `/belem`, `/procedimentos`, 11 subpáginas de `/procedimentos/*`, `/sobre`, `/politica-de-privacidade` — confere exatamente com a lista esperada. Nenhuma faltando, nenhuma extra.

**Rotas vivas fora do sitemap (correto):** `/agendar`, `/agendar-consulta`, `/auth`, `/obrigado` retornam 200 mas servem `<meta name="robots" content="noindex, follow">` no HTML pré-renderizado — exclusão do sitemap está **correta**. `/agendar` e `/agendar-consulta` ainda canonicalizam para `/agendamento` (consolidação de sinal correta).

**Quality gates de location pages:** apenas 2 páginas de cidade (`/belem`, `/paragominas`) — muito abaixo do limiar de 30. Nenhum gate acionado. ✅

## Findings

### 1. [High] Soft 404: URLs inexistentes retornam HTTP 200 com o conteúdo da home

**Evidência:** `curl https://drjulianomachado.com/pagina-que-nao-existe-xyz` → HTTP **200**, HTML de 146.982 bytes com `<h1>Oftalmologista em...` (conteúdo da home). Nenhuma menção a 404 no HTML.

**Impacto:** qualquer URL arbitrária (parâmetros, typos, lixo de crawl) vira duplicata da home aos olhos do Google. Isso dilui sinal, desperdiça crawl budget e pode gerar o rótulo "Soft 404" / "Duplicada sem canonical" no Search Console — o que degrada a confiança do Google nos sinais do site, incluindo o sitemap.

**Recomendação:** configurar o host (Vercel/Netlify/edge) para que rotas fora da lista conhecida retornem status **404** de verdade servindo uma página de erro estática, ou, no mínimo, que o fallback SPA emita `<meta name="robots" content="noindex">` em rotas desconhecidas. Com pré-render estático e apenas 18 rotas, um rewrite "catch-all → 404.html" é trivial.

### 2. [Low] `<lastmod>` idêntico em todas as 18 URLs

**Evidência:** todas as 18 entradas do sitemap live usam `<lastmod>2026-08-29</lastmod>`. O arquivo do repositório (`public/sitemap.xml`) tinha mix de `2026-08-28`/`2026-08-29`, e existe `scripts/atualizar-lastmod.mjs` — indicativo de atualização em massa por build, não por modificação real de conteúdo.

**Impacto:** o Google só honra `<lastmod>` quando é consistentemente verificável. Datas uniformes em páginas que claramente não mudaram juntas (ex.: `/politica-de-privacidade` vs. home) fazem o sinal ser ignorado.

**Recomendação:** gravar a data real da última alteração de conteúdo por página (ex.: data do último commit que tocou o arquivo da rota) em vez de "data do build".

### 3. [Info] Tags deprecated `<priority>` e `<changefreq>` em todas as URLs

**Evidência:** todas as 18 entradas têm `<changefreq>monthly|yearly</changefreq>` e `<priority>0.3–1.0</priority>`.

**Impacto:** nenhum — o Google ignora ambas desde ~2023. É ruído no XML.

**Recomendação:** remover ao regenerar o sitemap. Opcional.

### 4. [Low] Duplicatas por trailing slash e redirect www com 302

**Evidência:** `https://drjulianomachado.com/belem/` → HTTP 200 (sem redirect para `/belem`); `https://www.drjulianomachado.com/` → **302** para o apex (deveria ser 301).

**Impacto:** mitigado — todas as variantes com trailing slash servem o canonical correto (`href="https://drjulianomachado.com/belem"`), então a consolidação de sinal acontece. Mas servir 200 nas duas formas em vez de redirecionar 301 gasta crawl e depende 100% do canonical.

**Recomendação:** redirect 301 de `/*/` → `/*` e trocar o redirect www de 302 para 301. Baixa prioridade dado o canonical correto.

### 5. [Info] Meta robots ausente em 2 das 18 páginas indexáveis

**Evidência:** `/agendamento` e `/procedimentos` não emitem `<meta name="robots">` (as outras 16 emitem `index, follow`).

**Impacto:** nenhum na prática — ausência = indexável por padrão. Apenas inconsistência de template.

**Recomendação:** uniformizar para `index, follow` explícito em todas as rotas públicas.

## Pontos positivos (registrar)

- Sitemap válido, declarado no robots.txt, 100% de cobertura das páginas indexáveis.
- Tratamento de `/auth` e `/obrigado` exemplar: noindex rastreável (não Disallow), com comentário no robots.txt documentando o porquê — prática correta e rara.
- Canonicals 100% alinhados com as URLs do sitemap.
- Sem URLs noindex, redirecionadas ou não-200 no sitemap.

## Limitações

- Nenhum script adicional da skill foi necessário além de `sitemap_discovery.py` (executado com sucesso via launcher `claude-seo`).
- Sem screenshots — especialidade não gera artefatos visuais.
- Google Search Console não consultado (fora do escopo desta categoria; dados de cobertura de índice complementariam o finding de soft 404).

## Score da categoria: 88/100

Sitemap tecnicamente limpo e com cobertura perfeita; a nota é puxada para baixo pelo soft 404 sitewide (afeta a integridade dos sinais de indexação) e pelo lastmod artificialmente uniforme.

## Resumo

O sitemap de drjulianomachado.com é válido, declarado no robots.txt e cobre exatamente as 18 páginas indexáveis — todas HTTP 200, canonical alinhado, sem noindex/redirects. As rotas utilitárias (`/auth`, `/obrigado`, `/agendar`) estão corretamente fora do sitemap com noindex rastreável. O problema mais sério é sitewide, não do sitemap: URLs inexistentes retornam 200 com o conteúdo da home (soft 404). Secundários: `<lastmod>` idêntico em todas as URLs (sinal ignorável pelo Google), tags deprecated `priority`/`changefreq`, duplicata por trailing slash (mitigada por canonical) e redirect www com 302. Nenhum quality gate de location pages acionado (apenas 2 páginas de cidade).
