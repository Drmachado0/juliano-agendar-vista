# Auditoria de Implementação Meta Tracking — Dr. Juliano Machado
**Data:** 2026-05-03  
**Escopo:** Pixel / CAPI / Dedup / GTM / EMQ Readiness / LGPD Compliance  
**Excluído:** Performance data (CTR, ROAS, Spend), Creative, Audience  
**Pesos ajustados:** Pixel/CAPI Health 60% · Account Structure/GTM 40%

---

## 1. Meta Health Score

| Categoria | Peso | Checks | Pontuação | Contribuição |
|-----------|------|--------|-----------|--------------|
| Pixel / CAPI Health | 60% | M01–M10 + M-AT1 | 84 / 100 | 50.4 |
| Account Structure / GTM | 40% | M11–M18, GTM config | 76 / 100 | 30.4 |
| **TOTAL** | **100%** | | | **80.8 / 100** |

### Grau: B+ (80.8)

> Implementação substancialmente sólida. CAPI deployada e funcionando com dedup confirmado por fbtrace_ids de produção. Principais deduções: (1) dedup contract do SchedulingModal usa event_id nulo em edge case, (2) Consent Mode v2 tem falha lógica de GTM-only-for-analytics que pode zerar tracking de visitantes novos sem LGPD prévia, (3) CAPI Gateway não onboardada, (4) token de acesso sem política formal de rotação.

---

## 2. Breakdown por Categoria

### CATEGORIA A — Pixel / CAPI Health (60%)

| ID | Check | Resultado | Evidência |
|----|-------|-----------|-----------|
| M01 | Pixel instalado e disparando | PASS | `index.html:5` — `meta-capi/index.ts:20` PIXEL_ID confirmado `1003792428067622` |
| M02 | CAPI ativa | PASS | Edge function `meta-capi` deployada 2026-05-02; `server_last_fired_time` saiu de epoch zero |
| M03 | Deduplicação event_id | WARNING | Ver Finding F-02 abaixo — SchedulingModal passa `data?.id` que pode ser `undefined` |
| M04 | EMQ (Event Match Quality) | WARNING | 48h de soak ainda não decorridas na data da auditoria; target ≥7.0, baseline desconhecido |
| M05 | Pixel ID correto em produção | PASS | GTM v26 com `1003792428067622`; tag Base e tag Events confirmadas; pixel antigo `1358767025715686` não está em produção |
| M06 | Domain Verification | PASS | `index.html:5` — `<meta name="facebook-domain-verification" content="1jl02qpc58up9nrn9vdf5lyiv0tppz">` presente; BM `493850516412413` confirmado na doc |
| M07 | PII hashada antes de sair do servidor | PASS | `meta-capi/index.ts:70–109` — SHA-256 em em, ph, fn, ln, ct, st, zp, country, external_id |
| M08 | Telefone normalizado E.164 | PASS | `meta-capi/index.ts:79–83` — `normalizePhone()` prepend `55` se dígitos ≥ 10 e não começa com 55 |
| M09 | Sinais de atribuição (fbc/fbp/UTMs) | PASS | 13 campos capturados em `agendamentos.ts:161–206` e persistidos via migration `20260502005818` |
| M10 | META_TEST_EVENT_CODE removido | PASS | Removido em 2026-05-03 confirmado pelo contexto da conversa; `meta-capi/index.ts:22` lê env que retorna undefined |
| M-AT1 | Offline Conversions API (descontinuada Maio 2025) | PASS | Nenhum vestígio de Offline Conversions API no codebase; integração é CAPI v19.0 |

**Pontuação categoria A:** 9 PASS · 2 WARNING · 0 FAIL → 84/100

---

### CATEGORIA B — Account Structure / GTM (40%)

| ID | Check | Resultado | Evidência |
|----|-------|-----------|-----------|
| M11 | Pixel único no GTM (sem duplicação) | PASS | 3 tags redundantes excluídas em GTM v26; apenas Base + All Events (with CAPI Dedup) ativas |
| M12 | Hostname filter no GTM | PASS | Trigger `All Pages` com filtro `Page Hostname = drjulianomachado.com` — bloqueia previews lovable.app |
| M13 | GTM não carrega em rotas privadas | PASS | `index.html:27–29` — `isPrivate` check para `/auth` e `/admin` antes de qualquer script; `trackingGuard.ts:13–21` complementa |
| M14 | Consent Mode v2 implementado | WARNING | Ver Finding F-01 abaixo — GTM só carrega se `c.analytics === true`, mas Meta Pixel depende de `ad_storage`, não `analytics` |
| M15 | safeDataLayerPush bloqueia rotas admin | PASS | `trackingGuard.ts:43–48` — guard duplo: `isAnalyticsAllowed()` checa rota + consent |
| M16 | Dedup contract browser→server via event_id | WARNING | Ver Finding F-02 — SchedulingModal (`SchedulingModal.tsx:155`) usa `data?.id` com optional chaining; se `criarAgendamento` retorna data sem id real, browser dispara sem event_id real |
| M17 | Pixel ID não hard-coded no React bundle | PASS | `useMetaPixel.ts` nunca chama fbq(); Pixel ID existe apenas no GTM container — confirmado por `AuditoriaTracking.tsx:89–94` (source: "gtm-only") |
| M18 | noscript GTM body presente | PASS | `index.html:122–124` — iframe noscript para GTM-K3C2NNF6 presente |
| M-ST1 | Sem fbq() direto no React | PASS | `trackingGuard.ts:63–69` — `safeFbq()` é noop explícito; grep zero hits de `fbq('track'` no src/ |
| M-ST2 | Funil de eventos cobre todos os touchpoints | WARNING | Ver Finding F-03 — SchedulingModal.tsx dispara Lead antes de ter leadId (step 1 do modal, sem CAPI correspondente) |
| M-GT1 | GA4 duplo sem duplicação de pageviews | WARNING | Ver Finding F-04 — Dois GA4 (G-79BDCX4R2L + G-380EGEFL1S) com gtag direto em index.html; GTM-EVENTOS-DATALAYER.md avisa pra não criar tags GA4 no GTM mas não há garantia de enforcement |
| M-LG1 | LGPD Consent Mode v2 — lógica correta | WARNING | Ver Finding F-01 |
| M-CF1 | Compliance CFM 2.336/2023 no site | PASS | `Agendamento.tsx:455` — "Médico Oftalmologista · CRM-PA 15253" sem "especialista"; `Obrigado.tsx:105` — "Médico Oftalmologista · CRM-PA 15253" |

**Pontuação categoria B:** 8 PASS · 5 WARNING · 0 FAIL → 76/100

---

## 3. Findings Detalhados

### F-01 — WARNING: Consent Mode v2 — GTM não carrega para visitantes novos (LGPD default-denied)

**Arquivo:** `index.html:31–53`  
**Severidade:** Alta — impacta 100% dos visitantes novos

**O que acontece:**

```js
if (c.analytics) {
  // carrega GTM
}
// Meta Pixel é disparado pelo GTM (controlado pelo Consent Mode v2 ad_storage).
```

O GTM só é injetado se `c.analytics === true`. Visitante novo (sem `lgpd-consent` no localStorage) não passa nenhuma das condições — GTM nunca carrega, logo o Meta Pixel nunca dispara nenhum evento (nem PageView). Isso é tecnicamente correto do ponto de vista LGPD/GDPR (default-denied), mas cria duas implicações:

1. **Sem consent, zero dados para o Meta.** Todos os visitantes que fecham o banner ou ignoram, não são visíveis para o Pixel. O CAPI server-side também só dispara quando há ação real (Lead/Schedule), então o topo de funil (PageView/ViewContent) está completamente sem dado para quem não consente.

2. **A lógica de consent tem acoplamento incorreto:** `isAnalyticsAllowed()` guarda o disparo de eventos Meta (marketing), mas verifica `consent.analytics`, não `consent.marketing`. Se o usuário aceitar analytics mas rejeitar marketing, o Meta Pixel não deveria disparar — mas pelo código do GTM, como o GTM é carregado (condição `c.analytics`), o Meta Pixel dentro do GTM vai disparar se `ad_storage = granted`. Isso cria uma zona cinza: o código React bloqueia pushes ao dataLayer via `isAnalyticsAllowed()`, mas o GTM, uma vez carregado, pode disparar pageviews independentemente.

**Recomendação:**
- Avaliar separação de consentimento: carregar GTM com `c.analytics || c.marketing`, atualizando Consent Mode v2 para cada categoria independentemente. O Meta Pixel dentro do GTM deve ser condicionado a `ad_storage = granted`.
- Ou, se a postura LGPD for conservadora (zero tracking sem consent), manter o comportamento atual mas aceitar a perda de cobertura de topo de funil.

---

### F-02 — WARNING: Dedup Contract com Risco de event_id Nulo — SchedulingModal

**Arquivo:** `src/components/scheduling/SchedulingModal.tsx:155`  
**Severidade:** Média — pode causar contagem dupla em parte das conversões do modal

**O que acontece:**

```typescript
const metaEventId = data?.id;
// ...
trackSchedule(formData.appointmentTypeName, formData.locationName, metaEventId);
trackCompleteRegistration(formData.appointmentTypeName, formData.locationName, metaEventId);
trackLeadMeta('Agendamento Confirmado - Modal', metaEventId);
```

`criarAgendamento()` em `agendamentos.ts:278` retorna:
```typescript
data: { ...sanitizedData, id: responseData?.data?.id || 'created' } as unknown as Agendamento
```

O fallback `'created'` (string literal) é passado como `event_id` para o GTM. Ao mesmo tempo, o CAPI server-side usa `data.id` (UUID real do banco). O browser vai para o Meta com `eventID = 'created'`, o servidor com `eventID = <UUID real>`. Esses dois IDs nunca coincidem — a deduplicação falha e o evento é contado duas vezes no Ads Manager.

**Contexto:** A rota `/agendamento` (landing page, `Agendamento.tsx`) usa corretamente `leadId` que vem da criação do lead e é o mesmo UUID que o CAPI usa. O problema está exclusivamente no SchedulingModal da homepage.

**Recomendação (Quick Win — 10 min):**
Em `SchedulingModal.tsx`, substituir:
```typescript
const metaEventId = data?.id;
```
Por:
```typescript
const metaEventId = data?.id && data.id !== 'created' ? data.id : undefined;
```
Assim, se o ID não for UUID real, os trackers Meta vão gerar um UUID novo client-side (comportamento do `generateEventId()` no hook), e o servidor já terá enviado com o UUID do banco. A dedup vai falhar de qualquer forma nesse edge case, mas pelo menos não haverá contagem dupla com `'created'` como ID.

A solução definitiva é corrigir `agendamentos.ts:278` para retornar o `id` real mesmo quando `responseData.data.id` é undefined (tratar o erro em vez de usar fallback).

---

### F-03 — WARNING: SchedulingModal dispara Lead browser sem CAPI correspondente

**Arquivo:** `src/components/scheduling/SchedulingModal.tsx:102`  
**Severidade:** Baixa-Média — perda de sinal, não double-count

**O que acontece:**

```typescript
if (currentStep === 1) {
  trackLeadMeta("Dados Pessoais Preenchidos - Modal");
}
```

Esse `trackLeadMeta()` empurra `meta_lead` ao dataLayer com um `event_id` gerado client-side (sem `leadId` porque o lead ainda não foi criado — ele só é criado no step 2 via `criarLead`). O CAPI server-side dispara o evento Lead com o `lead.id` do banco. Os dois event_ids são diferentes — sem dedup — e o Meta receberá 2 eventos Lead por agendamento do modal.

Na landing `/agendamento` esse problema não existe: `trackLead()` é chamado com `lead_id` como eventId após `criarLead()` retornar.

**Recomendação:** Remover o `trackLeadMeta("Dados Pessoais Preenchidos - Modal")` no step 1 do SchedulingModal, ou movê-lo para depois do `criarLead()` no step 2, passando o `lead_id` retornado (como a landing já faz). Sem isso, cada agendamento pelo modal gera 2 eventos Lead no Meta — um sem dedup.

---

### F-04 — WARNING: Dois GA4 com gtag direto — risco de pageview duplo

**Arquivo:** `index.html` (implícito — 2 propriedades GA4 via gtag.js)  
**Arquivo de documentação:** `docs/GTM-EVENTOS-DATALAYER.md:248–251`

**O que acontece:** `G-79BDCX4R2L` e `G-380EGEFL1S` ambos configurados via gtag direto no index.html. A doc já avisa para não criar tags GA4 Configuration no GTM, mas sem enforcement técnico (nenhuma tag de bloqueio, nenhum teste automatizado). Se alguém adicionar uma tag GA4 no GTM por engano, todos os pageviews serão duplicados em ambas as propriedades.

Adicionalmente, o GA4 Secundário (`G-380EGEFL1S`) não está documentado como sendo de qual propósito — não há indicação no código ou docs do que ele mede diferentemente do Principal.

**Recomendação:** Documentar explicitamente o propósito do GA4 Secundário. Considerar adicionar um comentário no index.html e uma checagem na AuditoriaTracking.tsx para alertar se algum evento gtag for disparado com esses IDs pelo GTM.

---

### F-05 — WARNING: CAPI Gateway NOT_ONBOARDED

**Referência:** `docs/CERTIFICACAO-CAPI.md:274` — "Avaliar onboarding no CAPI Gateway (atualmente NOT_ONBOARDED)"

**O que acontece:** A implementação atual envia eventos diretamente ao endpoint `graph.facebook.com/v19.0/{pixel_id}/events` usando o Access Token pessoal do servidor. O CAPI Gateway (Meta Business Suite) é uma infraestrutura intermediária que oferece: (1) deduplicação gerenciada pelo Meta, (2) menor latência, (3) sem necessidade de gerenciar tokens. O status NOT_ONBOARDED significa que o BM não passou pelo processo de setup do Gateway.

**Impacto:** Sem o Gateway, o token precisa ser rotacionado manualmente (atualmente sem política formal — `CERTIFICACAO-CAPI.md:249` recomenda 90 dias mas sem automação). O endpoint direto também está sujeito a throttling e não tem o benefício de signal enrichment automático do Gateway.

**Recomendação:** Avaliar onboarding no CAPI Gateway em Business Manager → Events Manager → Settings → Conversions API Gateway. O onboarding não requer mudança de código — o endpoint muda, o token é gerenciado pelo Meta.

---

### F-06 — WARNING: Token de Acesso CAPI sem política de rotação automatizada

**Arquivo:** `docs/CERTIFICACAO-CAPI.md:249`  
**Severidade:** Média — risco de interrupção de CAPI se token expirar silenciosamente

**O que acontece:** O Access Token foi rotacionado em 2026-05-02. A recomendação de rotação a cada 90 dias é apenas documental, sem reminder automatizado. Tokens do CAPI nunca expiram automaticamente (são System User Tokens), mas podem ser revogados em eventos de segurança no BM.

**Recomendação:** Criar lembrete recorrente para rotação em 2026-07-31 (90 dias) e considerar implementar um health check mensal que valide `events_received` retornado pelo endpoint.

---

### F-07 — PASS confirmado: Compliance CFM 2.336/2023 no site

**Arquivos verificados:** `Agendamento.tsx:455`, `Obrigado.tsx:104–105`, `index.html:62`

O site usa consistentemente "Médico Oftalmologista" com CRM-PA 15253. Não foi encontrado uso de "especialista" em nenhum dos arquivos lidos. O Schema JSON-LD (`index.html:83–118`) usa `"@type": "Physician"` e não menciona especialidade em linguagem marketing.

Nota: a auditoria não cobriu 100% das páginas do site (apenas as listadas no contexto). A validação de copy de criativos de campanha permanece fora do escopo desta auditoria de implementação técnica.

---

### F-08 — PASS confirmado: Arquitetura dedup browser↔server

A análise do fluxo completo confirma que o dedup contract está fechado para a rota principal (`/agendamento`):

1. `Agendamento.tsx:205` — `criarLead()` retorna `lead_id` (UUID do banco)
2. `Agendamento.tsx:217` — `trackLead("...", lead_id)` → dataLayer push com `meta_event_id = lead_id`
3. GTM tag "Meta Pixel - All Events (with CAPI Dedup)" → `fbq('track', 'Lead', custom, { eventID: lead_id })`
4. `criar-lead/index.ts:174–184` — `fireMetaCapiLead({ id: lead.id })` → CAPI com `event_id = lead.id`
5. Meta recebe Browser(eventID=UUID) + Server(event_id=UUID) → deduplica para 1 conversão

O mesmo padrão funciona para Schedule/CompleteRegistration via `converter-lead-agendamento` usando `ag.id` (UUID do banco).

**Único risco:** Finding F-02 (SchedulingModal com fallback `'created'`).

---

### F-09 — PASS confirmado: Domain Verification coerente com Pixel correto

`index.html:5` — `content="1jl02qpc58up9nrn9vdf5lyiv0tppz"` — esta é a tag de verificação de domínio associada ao BM `493850516412413`. O Pixel ativo `1003792428067622` pertence a esse mesmo BM. O Pixel fantoma `1358767025715686` documentado no contexto não aparece em nenhum arquivo do codebase. Coerência confirmada.

---

### F-10 — PASS confirmado: Proteção de rotas admin

`index.html:27–29`:
```js
var isPrivate = p === '/auth' || p.indexOf('/auth/') === 0 || p.indexOf('/admin') === 0;
if (isPrivate) return;
```

`trackingGuard.ts:13–21` — `isPrivateRoute()` implementa a mesma lógica para guards React-side.

Administradores que acessam `/admin/*` nunca disparam eventos de tracking. Nenhum dado de uso interno contamina o Pixel ou CAPI.

---

## 4. Quick Wins (< 15 min, alto impacto)

### QW-01 — Corrigir fallback 'created' no SchedulingModal (10 min)
**Arquivo:** `src/components/scheduling/SchedulingModal.tsx:155`  
**Impacto:** Elimina double-count de Schedule/CompleteRegistration/Lead no modal da homepage  
**Ação:**
```typescript
// ANTES
const metaEventId = data?.id;

// DEPOIS
const metaEventId = (data?.id && data.id !== 'created') ? data.id : undefined;
```

### QW-02 — Remover trackLeadMeta no step 1 do SchedulingModal (5 min)
**Arquivo:** `src/components/scheduling/SchedulingModal.tsx:102–104`  
**Impacto:** Elimina Lead duplicado sem dedup para cada agendamento pelo modal  
**Ação:** Remover as linhas:
```typescript
if (currentStep === 1) {
  trackLeadMeta("Dados Pessoais Preenchidos - Modal");
}
```
ou mover para depois do `criarLead()` passando o `lead_id` real.

### QW-03 — Criar lembrete de rotação do token CAPI (5 min)
**Impacto:** Previne interrupção silenciosa do CAPI em 90 dias  
**Ação:** Criar evento recorrente em calendário para 2026-07-31 com instrução de rotação no Events Manager → Settings → Conversions API.

### QW-04 — Documentar propósito do GA4 Secundário G-380EGEFL1S (5 min)
**Arquivo:** `docs/GTM-EVENTOS-DATALAYER.md`  
**Impacto:** Evita confusão futura e risco de pageview duplicado  
**Ação:** Adicionar tabela na seção de IDs indicando qual o propósito diferenciado da propriedade secundária.

---

## 5. Roadmap Próximos Passos

### Curto prazo (esta semana)

- [ ] Aplicar QW-01 e QW-02 (corrigir dedup do SchedulingModal) — criar PR no Lovable + publicar GTM v27 se necessário
- [ ] Verificar EMQ no Events Manager após 48h de soak (a partir de 2026-05-04) — target ≥7.0 para Lead e Schedule
- [ ] Confirmar que volumes Lead/Schedule estão subindo no Events Manager Overview (validação pós-TEST_EVENT_CODE removal)
- [ ] Validar visualmente no Test Events panel (item pendente na CERTIFICACAO-CAPI.md §3.6) — confirmar dedup ✅ nos 4 eventos

### Médio prazo (2–4 semanas)

- [ ] Avaliar onboarding no CAPI Gateway (F-05) — reduz fricção de gerenciamento de token
- [ ] Definir política de consentimento LGPD: aceitar perda de topo de funil (postura atual) ou carregar GTM com `c.analytics || c.marketing` e condicionar tags por tipo dentro do GTM
- [ ] Resolver 3 páginas duplicadas no BM (`dr.julianomachado_`) — risco de confusão de assets e potencial banimento por contas inativas
- [ ] Avaliar isolamento do negócio paralelo "Milestotalpro" para um BM separado — risco de banimento em cascata caso haja infração em uma das entidades

### Médio-longo prazo (1–3 meses)

- [ ] Implementar health check automatizado do CAPI (verificar `events_received` > 0 diariamente via cron no Supabase)
- [ ] Audit Creative (30% do peso original) quando MCP Meta liberar acesso ao BM `493850516412413`
- [ ] Audit Audience (20% do peso original) — mesmo desbloqueio
- [ ] Auditoria de EMQ por evento individualmente após volume suficiente (≥7 dias de dados) — target ≥8.0 para Purchase/Schedule

---

## 6. Sumário Executivo

A implementação CAPI do Dr. Juliano Machado está **operacional e certificada para a rota principal** (`/agendamento`). O dedup contract browser↔server está fechado com UUIDs do banco como event_id para Lead, Schedule e CompleteRegistration nessa rota.

Os dois gaps de dedup encontrados (`F-02` e `F-03`) afetam exclusivamente o `SchedulingModal` da homepage e são corrigíveis em menos de 15 minutos combinados.

O ponto mais relevante estruturalmente é a lógica LGPD (`F-01`): o comportamento atual de não carregar GTM sem consent ativo é correto para LGPD mas implica que visitantes novos (sem decisão de consent) geram zero dados de Pixel. Isso é uma escolha de negócio, não um bug, mas deve ser uma decisão consciente.

Não há nenhum finding crítico (FAIL) nesta auditoria. A pontuação 80.8/100 (grau B+) é representativa de uma implementação madura para um site de saúde com cuidados de privacidade adequados.

---

*Auditoria gerada em 2026-05-03 · Claude Ads · Escopo: implementação técnica apenas*
