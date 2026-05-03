# Quick Wins — Multi-Platform Ads
**Data:** 2026-05-03
**Critério:** Critical/High severity + fix <15 min

---

## 🥇 #1 — Remover gtag direto duplicado (5 min, CRÍTICO)

**Plataforma:** Google Ads
**Por que:** Cada agendamento gera 2 conversões no Google Ads (gtag direto + tag GTM). CPA inflado, ROAS distorcido, Smart Bidding aprende errado.

**Como fazer:**
```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx
// Linhas: 168-174

// DELETAR este bloco inteiro:
if (typeof (window as any).gtag !== 'undefined') {
  (window as any).gtag('event', 'conversion', {
    send_to: 'AW-436492720/tUOICNX06JwcELCzkdAB',
    value: 300,
    currency: 'BRL',
  });
}
```

**Validação:** depois do deploy, em DevTools Network filtrar `googleads.g.doubleclick.net` durante um agendamento de teste. Esperado: 1 hit, não 2.

---

## 🥈 #2 — Fix Consent Mode bootstrap (15 min, CRÍTICO)

**Plataforma:** Meta + Google (cross-platform)
**Por que:** GTM só carrega se `c.analytics === true`. Usuário que aceita só marketing perde Meta Pixel E perde conversão Google Ads.

**Como fazer:**
```html
<!-- Arquivo: index.html, linha 44 -->

<!-- ANTES: -->
if (c.analytics) {
  (function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-K3C2NNF6');
  window.__gtmLoaded = true;
}

<!-- DEPOIS: -->
if (c.analytics || c.marketing) {
  (function(w,d,s,l,i){...})(window,document,'script','dataLayer','GTM-K3C2NNF6');
  window.__gtmLoaded = true;
}
```

**Validação:** smoke test em aba anônima:
1. Abre site, recusa analytics, aceita marketing
2. F12 → Network → confirma `gtm.js` carregou
3. F12 → Application → DataLayer → confirma eventos disparando
4. Network → confirma fbq events firing

---

## 🥉 #3 — Mover trackLeadMeta do step 1 do modal (5 min, ALTO)

**Plataforma:** Meta
**Por que:** Dispara Lead Meta antes do lead existir no DB → event_id sem CAPI correspondente. Lead duplicado sem dedup.

**Como fazer:**
```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx, linha ~101 (dentro de nextStep, antes de setCurrentStep)

// DELETAR este bloco:
if (currentStep === 1) {
  trackLeadMeta("Dados Pessoais Preenchidos - Modal");
}

// O Lead correto já dispara em handleSubmit com lead_id real
```

**Validação:** Events Manager principal nos próximos minutos pós-conversão. Esperado: 1 Lead por agendamento (não 2).

---

## 🏅 #4 — Fix dedup do modal (10 min, ALTO)

**Plataforma:** Meta
**Por que:** Fallback `'created'` quebra dedup CAPI. Eventos Schedule/CompleteRegistration/Lead do modal contam 2× no Meta (browser + server sem match).

**Como fazer:**
```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx, linha ~155

// ANTES:
const metaEventId = data?.id;

// DEPOIS:
const metaEventId = (data?.id && data.id !== 'created') ? data.id : undefined;
```

(E investigar separadamente o fallback `|| 'created'` em `agendamentos.ts:278` — provavelmente é gambiarra que merece refatoração)

**Validação:** Events Manager → Test Events → tag dedup ✅ verde nos eventos do modal.

---

## 🎖 #5 — Documentar GA4 Secundário (5 min, MÉDIO)

**Plataforma:** Google
**Por que:** `G-380EGEFL1S` está no código mas ninguém sabe pra que serve.

**Como fazer:**
```markdown
<!-- Arquivo: docs/GTM-EVENTOS-DATALAYER.md -->
<!-- Adicionar após a tabela de IDs -->

## GA4 — Estratégia de propriedades duplas

- **GA4 Principal `G-79BDCX4R2L`** — propriedade canônica, alimenta Looker Studio e relatórios
- **GA4 Secundário `G-380EGEFL1S`** — [PREENCHER: motivo de existência]

Decisão arquitetural: ambas via `gtag.js` direto em `index.html`. **NÃO criar** tag GA4 Configuration no GTM (causaria duplicação de pageviews).
```

(Você precisa preencher o motivo do secundário — eu não tenho contexto)

**Validação:** read-back o doc, valida que próximo dev consegue entender a decisão.

---

## 🎁 #6 — Calendar reminder rotação token (5 min, BAIXO)

**Plataforma:** Meta
**Por que:** Token CAPI vence "moralmente" em 90 dias (boas práticas). Sem lembrete, fica esquecido.

**Como fazer:**
1. Abre Google Calendar
2. Cria evento recorrente:
   - **Título:** Rotacionar META_CAPI_ACCESS_TOKEN
   - **Próxima ocorrência:** 2026-08-02 09:00
   - **Recorrência:** A cada 90 dias
   - **Notas:** Procedimento em `docs/META-CAPI-SETUP.md`. Após gerar novo token: Lovable Cloud → Secrets → META_CAPI_ACCESS_TOKEN → editar. Validar com `scripts/test-meta-capi.ps1`.

**Validação:** evento criado e visível no calendar.

---

## 📊 Total Quick Wins

| # | Plataforma | Tempo | Severity |
|---|---|---|---|
| 1 | Google | 5 min | CRITICAL |
| 2 | Meta+Google | 15 min | CRITICAL |
| 3 | Meta | 5 min | HIGH |
| 4 | Meta | 10 min | HIGH |
| 5 | Google | 5 min | MEDIUM |
| 6 | Meta | 5 min | LOW |
| **TOTAL** | | **45 min** | |

---

## 🚀 Sugestão executiva

**Dedica 1 hora hoje à tarde:**
- 30 min: implementar fixes #1, #3, #4 (código)
- 15 min: deploy + smoke test
- 15 min: fixes #2, #5, #6 (config + docs)

**Resultado:**
- Health score sobe de 75.6 → ~90
- CPA Google reportado: corrige inflação 2×
- Conversões cross-platform deduplicadas
- Compliance LGPD +1 (Consent Mode coupling fix)

**ROI:** ~1h de trabalho hoje = poupar ~30 dias de Smart Bidding training corrompido (Google Ads) + recuperar 10-30% conversões iOS quando Enhanced Conversions for adicionado.
