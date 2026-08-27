# Plano de acao - drjulianomachado.com

Health Score: 82/100

## Fase 1: Ganhos rapidos

**Prazo:** Esta semana

- [x] [feito] Encurtar os seis titulos acima de 60 caracteres
- [x] [feito] Aparar as cinco descriptions acima de 160 caracteres
- [x] [cancelado] Remover supabase do modulepreload: seria pessimizacao, nao ganho
- [x] [cancelado] Adicionar alt em /paragominas: a marcacao ja esta correta

## Fase 2: Conteudo

**Prazo:** FEITO em 27/08/2026

- [x] [feito] /procedimentos reagrupado em tres secoes com paragrafo editorial cada; 170 -> 433 palavras
- [x] [feito] Os cinco exames orfaos entraram no indice: 6 -> 11 links para paginas filhas
- [x] [feito] Teste src/test/procedimentosIndex.test.ts guarda o indice contra o sitemap
- [x] [ja estava ok] llms.txt cobre as 18 rotas, guardado por src/test/llmsTxt.test.ts

## Fase 2b: Supabase fora do caminho critico

**Prazo:** Decisao propria, nao e ganho rapido

- [ ] WhatsAppButton: trocar import estatico por dinamico dentro do clique (baixo risco)
- [ ] AuthContext: adiar o cliente para depois da primeira pintura (mexe em bootstrap de login)
- [ ] So os dois juntos tiram os 48,2 KB do caminho critico; um sozinho nao muda nada

## Fase 3: Decisao estrutural

**Prazo:** DECIDIDO em 27/08/2026: aceitar como esta

- [x] [decidido] Prerender nao roda no build da Lovable por falta de bibliotecas de sistema do Chromium (libglib-2.0.so.0, exitCode=127). Descartados com evidencia: flags de container, rede, permissao e prazo. Registro em scripts/prerender.mjs e .claude/skills/prerender-na-lovable/.
- [x] [decidido] Aceitar: o Google executa JS e indexa; os previews de link vivem das tags og estaticas do index.html. O custo recai sobre crawlers de IA que nao executam JS.
- [ ] GATILHO PARA REABRIR: se o LCP de campo passar de 5.000ms de forma sustentada, ou se citacao por IA virar meta de negocio. O monitor reporta os dois — rode npm run monitorar:seo.
- [ ] Se reabrir, as saidas em ordem de custo: Chromium empacotado (@sparticuz/chromium), SSG sem navegador, troca de host.

## Fase 4: Monitoramento

**Prazo:** FEITO em 27/08/2026; rodar sob demanda

- [x] [feito] npm run monitorar:seo — checa prerender-status, sitemap x rotas vivas, invariantes por pagina e CrUX; sai com codigo 1 em regressao
- [x] [feito] O monitor usa queryHistoryRecord e informa a data da janela, porque a serie e esparsa
- [ ] Ligar o Search Console por conta de servico para ter indexacao real (precisa de credencial sua)
