# Análise GEO — drjulianomachado.com

**Data:** 2026-08-26 · **Escopo:** 18 rotas públicas
**Método:** requisição crua com `User-Agent: GPTBot` (sem execução de JS) contra produção, comparada com o `dist/` de um build fresco. Comportamento visual conferido em navegador real (Playwright).

> **Nota de correção.** A primeira versão deste relatório avaliou o schema a partir de um
> `dist/` obsoleto: o prerender havia reescrito `dist/index.html` a partir de um bundle JS
> compilado antes das mudanças em `src/lib/schema.ts`. Três achados daquela versão —
> "FAQPage ausente na home", "zero sinais de data" e "`sameAs` com um perfil só" — **estavam
> errados**. Um build fresco desmentiu os três. O que sobrou, e o que apareceu no lugar,
> está abaixo.

---

## GEO Readiness Score: 9/100 (produção) · 64/100 (potencial pós-deploy)

O site não tem problema de conteúdo nem, hoje, de dado estruturado. Tem um problema de
**entrega**: a produção serve um shell vazio de 5.682 bytes para todas as rotas.

| Critério | Peso | Produção | Potencial |
|---|---|---|---|
| Acessibilidade técnica | 20% | 4 | 16 |
| Citabilidade de passagens | 25% | 0 | 16 |
| Legibilidade estrutural | 20% | 0 | 13 |
| Conteúdo multimodal | 15% | 3 | 7 |
| Autoridade e marca | 20% | 2 | 12 |
| **Total** | | **9** | **64** |

### Por plataforma

| Plataforma | Situação | Motivo |
|---|---|---|
| ChatGPT (GPTBot / OAI-SearchBot) | **0 — invisível** | Não executa JS. Recebe `<div id="root"></div>` |
| Perplexity (PerplexityBot) | **0 — invisível** | Idem |
| Claude (ClaudeBot) | **0 — invisível** | Idem |
| Google AI Overviews | Degradado | Googlebot renderiza JS, mas depende do render tier |
| Google AI Mode | Degradado | Favorece frescor e passagens extraíveis do HTML bruto |
| Bing Copilot | Degradado | Bingbot renderiza JS de forma limitada |

---

## 1. [CRÍTICO · em aberto] Produção serve HTML vazio em todas as rotas

**Evidência medida contra produção:**

```
rota                                   bytes   h1   json-ld
/                                      5682     0     0
/sobre                                 5682     0     0
/belem                                 5682     0     0
/paragominas                           5682     0     0
/procedimentos/glaucoma                5682     0     0
/procedimentos/cirurgia-de-catarata    5682     0     0
/procedimentos/mapeamento-de-retina    5682     0     0
```

As sete rotas retornam **byte a byte o mesmo arquivo**. O `<body>` contém apenas
`<div id="root"></div>`. As "203 palavras" detectadas são o script de consentimento inline
e as meta tags — zero conteúdo médico.

**Bundle em produção:** `/assets/index-BlI5od9Q.js` — o mesmo bundle antigo do deploy
travado. O prerender nunca chegou ao ar.

**Build local, fresco:** 18 rotas, ~5s, `0 mantida(s) como shell`, `dist/index.html` com
183 KB, 1 H1 e o `@graph` completo.

**Impacto:** para ChatGPT, Perplexity e Claude o site é uma página em branco. Nenhuma
outra otimização produz efeito enquanto isto não for resolvido.

**Verificação depois de publicar:**
`curl -sSL https://drjulianomachado.com/ | grep -c "<h1"` — precisa retornar `1`, não `0`.

---

## 2. [ALTO · corrigido] `/paragominas` declarava um segundo médico

`Paragominas.tsx` montava um `Physician` à mão, e era exatamente a divergência que
`src/lib/schema.ts` foi escrito para acabar — a página nunca migrou:

- **sem `@id`** → para o Google, uma **segunda pessoa**, distinta da da home, com as
  avaliações presas nela em vez de na entidade real;
- `identifier: DOCTOR.crm` como string crua, enquanto o nó canônico usa
  `PropertyValue {propertyID: "CRM", value}` — dois formatos para o mesmo registro;
- `url: CANONICAL` na mesma entidade que, na home, declara `url` como a raiz: a mesma
  pessoa apontando para dois endereços canônicos;
- `memberOf` como `MedicalOrganization` aqui e `Organization` lá;
- os dois endereços inline no próprio nó, sem os `MedicalClinic` com `@id` que a busca
  local precisa.

Migrado para o `@graph` compartilhado. Estado verificado no build:

```
@id             : https://drjulianomachado.com/#physician
url             : https://drjulianomachado.com
mainEntityOfPage: https://drjulianomachado.com/paragominas
identifier      : {@type: PropertyValue, propertyID: CRM, value: CRM-PA 15253}
memberOf        : [Organization, Organization]
```

`aggregateRating` foi mantido porque a página exibe a nota na tela.

---

## 3. [ALTO · corrigido] `/belem` não dizia quem é o médico

A página que responde por "oftalmologista em Belém" emitia **só dois `MedicalClinic`**.
Sem `Physician`, sem `WebSite`, sem `MedicalWebPage` — e os clínicos apontavam para um
`@id` de médico que a própria página nunca definia. Para um mecanismo que lê essa URL
isolada (e é assim que assistente de IA lê), a entidade principal não existia.

O FAQ de 4 perguntas já estava na tela em `<dl>/<dt>/<dd>`, com texto visível, **sem
`FAQPage`**. Agora tem, alimentado pelo mesmo array que a interface renderiza.

`/procedimentos` recebeu o mesmo tratamento: tinha `BreadcrumbList` e `ItemList`, mas
nenhum dono e nenhuma data de revisão clínica.

**Cobertura de schema depois das correções:**

| rota | Physician | WebSite | MedicalWebPage | FAQPage | clínicas |
|---|---|---|---|---|---|
| `/` | sim | sim | sim | 1 | 4 |
| `/belem` | sim | sim | sim | 1 | 2 |
| `/paragominas` | sim | sim | sim | 1 | 2 |
| `/procedimentos` | sim | sim | sim | — | — |
| `/sobre`, `/agendamento` | sim | sim | sim | — | — |
| 11 páginas de procedimento | — | — | sim | 1 | — |

---

## 4. [MÉDIO · corrigido] Respostas do FAQ da home fora do DOM

O accordion Radix desmonta o conteúdo fechado: as três perguntas apareciam no HTML
prerenderizado e **o texto das respostas não**. O `FAQPage` já levava o par completo, mas
extrator que lê texto visível, e não dado estruturado, via pergunta sem resposta.

Resolvido com `forceMount` no `AccordionContent`. Isso sozinho seria **regressão visual**:
sem o atributo `hidden`, o colapso passaria a depender de `animate-accordion-up`, que é
`0.2s ease-out` **sem `fill-mode: forwards`** — animação sem `forwards` não retém o estado
final, e na primeira renderização nem chega a rodar. O FAQ abriria inteiro na tela.

Por isso o `data-[state=closed]:h-0` no primitivo. Conferido em navegador real:

```
resposta existe no DOM        : true
altura com o item FECHADO     : 0px
visível para o usuário?       : false
altura depois de ABRIR        : 64px
```

---

## 5. [MÉDIO · corrigido] `llms.txt` contradizia o site inteiro

`public/llms.txt` anunciava **"mais de 13 anos"**; todo o resto do site diz 15
(`DOCTOR.yearsExperience`). Havia até teste proibindo o "+13 anos" nas meta tags
(`indexHtmlMetaTags.test.ts:85`), mas **nada** tocava no `llms.txt` — por isso ele
sobreviveu à migração.

É especialmente ruim porque o `llms.txt` é o resumo que o site oferece aos crawlers de IA
como descrição autoritativa de si mesmo. Número errado ali é o site se contradizendo na
fonte que um modelo lê primeiro.

Corrigido, e criado `src/test/llmsTxt.test.ts` para travar: tempo de atuação amarrado a
`DOCTOR.yearsExperience`, CRM amarrado a `DOCTOR.crm`, e a lista de rotas obrigada a bater
com o `sitemap.xml` (hoje 18 = 18).

---

## 6. [OK] Acesso dos crawlers de IA

`robots.txt` está correto. `User-agent: *` com `Allow: /` cobre GPTBot, OAI-SearchBot,
ClaudeBot, PerplexityBot e CCBot. Sem bloqueio de `Google-Extended`, então o site segue
elegível para grounding do Gemini. `Disallow` apropriados (`/admin/`, `/auth`,
`/obrigado`). Sitemap declarado.

---

## 7. [OK] Sinais de data e identidade

`medicalWebPageNode` emite `lastReviewed` + `reviewedBy` a partir de `REVISAO_CLINICA`
(hoje `2026-08-26`), agora em 15 das 18 rotas. Para conteúdo médico YMYL isso é o sinal
certo — melhor que `dateModified` genérico, porque diz **quem** revisou e com qual CRM. Nas
páginas de procedimento a data também aparece visível ao paciente
(`ProcedurePageLayout.tsx:267`).

O `Physician` corresponde à realidade: `identifier` com CRM-PA 15253, `memberOf` SBO e SBG,
`aggregateRating` 5.0/14 batendo com os depoimentos exibidos, `alumniOf`, `knowsAbout` e as
4 `MedicalClinic` com endereço e telefone. `sameAs` com dois perfis verificados (Instagram
e Google Business Profile por CID) — o Lattes ficou de fora de propósito, porque a URL do
buscatextual devolve captcha.

Títulos únicos nas 18 rotas, hierarquia H1→H2→H3 limpa.

---

## O que falta

| # | Ação | Esforço | Impacto |
|---|---|---|---|
| 1 | **Publicar o build com prerender** | — (pronto) | **Destrava tudo.** 0 → visível em ChatGPT, Perplexity, Claude |
| 2 | `Physician` + `WebSite` nas 11 páginas de procedimento (`ProcedurePageLayout`) | Baixo | Hoje elas têm `MedicalWebPage` e `FAQPage`, mas não declaram o profissional |
| 3 | Blocos de definição de 134–167 palavras ("X é…") no topo de cada procedimento | Médio | Passagem autocontida é o que um modelo consegue citar sem contexto |
| 4 | Cabeçalhos em forma de pergunta nas páginas de procedimento | Baixo | Casam com o formato real das consultas |
| 5 | Ampliar `sameAs` (Doctoralia, LinkedIn, Facebook, YouTube) | Baixo | Menções de marca correlacionam ~3× mais que backlinks com citação em IA |
| 6 | Vídeo curto por procedimento | Alto | Multimodal eleva taxa de seleção; YouTube é o sinal de menção mais correlacionado |

Observação lateral: `/procedimentos` lista 6 procedimentos no `ItemList`, mas existem 11
páginas publicadas (Retinografia, Tonometria, Gonioscopia, Biometria e Iridotomia entraram
depois). São páginas prerenderizadas, no sitemap e no `llms.txt`, mas órfãs desse índice.
Não mexi porque são trabalho não commitado de outra frente — vale conferir se o link
interno está saindo de outro lugar.

---

## Observação metodológica

As recomendações acima são SEO fundamental aplicado às superfícies de busca generativa,
não uma disciplina separada — a posição oficial do Google é que otimizar para IA é o mesmo
trabalho de sempre. Em particular, o `llms.txt` **não** é alavanca de ranqueamento no
Google Search: mantê-lo correto importa para os demais crawlers e por coerência factual,
não por posicionamento.
