# AI Search Readiness - nota 55/100

## O que esta certo

- llms.txt publicado com as 18 paginas e resumo do consultorio
- robots.txt nao bloqueia crawlers de IA
- Conteudo em perguntas e respostas, formato que LLM cita bem
- FAQPage em 14 paginas com perguntas que sao buscas reais

## Achados

### [High] Crawler que nao executa JS enxerga pagina vazia

O HTML cru tem 9,8 KB e nenhum conteudo. Boa parte dos crawlers de IA nao renderiza JavaScript, entao llms.txt e FAQPage nao compensam: o texto que eles citariam nao esta la. Os previews de link do WhatsApp e Facebook sobrevivem apenas pelas tags og estaticas do index.html.

**Correcao:** Mesmo conserto do prerender. Ate la, o llms.txt e a unica superficie que esses crawlers leem de verdade, entao vale mante-lo rico.
