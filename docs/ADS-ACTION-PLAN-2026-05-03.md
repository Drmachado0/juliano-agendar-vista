# Action Plan — Multi-Platform Ads (Meta + Google)
**Data:** 2026-05-03
**Origem:** `docs/ADS-AUDIT-REPORT-2026-05-03.md`

---

## Priorização

- 🔴 **CRITICAL** — fix imediato (revenue/data risk)
- 🟠 **HIGH** — fix em até 7 dias (performance drag)
- 🟡 **MEDIUM** — fix em até 30 dias
- 🟢 **LOW** — backlog (best practice)

---

## 🔴 CRITICAL (fix HOJE/AMANHÃ)

### 1. Resolver dupla conversão Google Ads

- **Plataforma:** Google Ads
- **Origem:** AUDIT-GOOGLE CT-02, CT-09
- **Impacto:** cada agendamento conta 2× → CPA artificial /2, Smart Bidding training corrompido
- **Tempo:** 5 min

**Como fazer (Opção A, recomendada):**

```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx
// Linhas: 168-174

// REMOVER este bloco completo:
if (typeof (window as any).gtag !== 'undefined') {
  (window as any).gtag('event', 'conversion', {
    send_to: 'AW-436492720/tUOICNX06JwcELCzkdAB',
    value: 300,
    currency: 'BRL',
  });
}
// Confiar na tag GTM "Google Ads - Conversão Formulário" que dispara via 'purchase'
```

**Validação:** após deploy, abrir DevTools Network durante agendamento de teste → filtrar `googleads.g.doubleclick.net` → confirmar 1 hit (não 2).

### 2. Fix Consent Mode bootstrap (afeta Meta + Google)

- **Plataforma:** Cross-platform
- **Origem:** AUDIT-META F-01, AUDIT-GOOGLE CT-07, ST-08
- **Impacto:** usuário que aceita só marketing (sem analytics) tem GTM não carregado → perde Pixel + perde Google Ads conversion
- **Tempo:** 15 min

**Como fazer:**

```html
<!-- Arquivo: index.html, linha 44 -->

<!-- ANTES: -->
if (c.analytics) {
  // carrega GTM
}

<!-- DEPOIS: -->
if (c.analytics || c.marketing) {
  // carrega GTM
  // (Consent Mode v2 já controla internamente o que cada tag pode fazer)
}
```

**Validação:** smoke test em aba anônima:
1. Abre site, recusa analytics, aceita marketing
2. F12 → Network → `gtm.js` deve carregar
3. F12 → Application → DataLayer → eventos disparando
4. Network → fbq events firing

---

## 🟠 HIGH (fix esta semana)

### 3. Configurar Enhanced Conversions (Google Ads)

- **Plataforma:** Google Ads
- **Origem:** AUDIT-GOOGLE CT-08
- **Impacto:** recupera 10-30% conversões iOS (Apple ATT, Safari ITP)
- **Tempo:** 20-30 min

**Como fazer:**
1. Google Ads UI → Ferramentas → Conversões → Configurações de conversão → ativar **Enhanced Conversions**
2. Atualizar tag GTM "Google Ads - Conversão Formulário" pra enviar `user_data` com email/phone hash:
   - Email: `{{DLV - email}}` (criar nova DLV se não existir)
   - Phone: `{{DLV - phone}}` (criar nova DLV se não existir)
   - Os dados existem em `formData` no momento de `handleSubmit()` mas precisam ser empurrados ao dataLayer antes do `purchase`
3. Alternativa: ativar Enhanced Conversions via gtag.js auto-collect (Google detecta campos do form automaticamente — menos código mas menos controle)

**Validação:** Google Ads → Conversões → coluna "Enhanced Conversions" deve mostrar % crescente após 7 dias.

### 4. Fix dedup no SchedulingModal (Meta)

- **Plataforma:** Meta
- **Origem:** AUDIT-META F-02
- **Impacto:** eventos do modal homepage não dedupam com CAPI server
- **Tempo:** 10 min

**Como fazer:**

```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx, linha ~155

// ANTES:
const metaEventId = data?.id;

// DEPOIS:
const metaEventId = (data?.id && data.id !== 'created') ? data.id : undefined;
```

E em `agendamentos.ts:278`, o fallback `'created'` é mal-cheiroso — quando há erro o id deveria ser nulo, não string fake. Investigar se é gambiarra de error handling ou intencional.

**Validação:** Events Manager → Test Events → confirmar Lead/Schedule chegando com Dedup ✅ ao usar modal homepage.

### 5. Mover trackLeadMeta do step 1 do modal

- **Plataforma:** Meta
- **Origem:** AUDIT-META F-03
- **Impacto:** Lead duplicado sem dedup (1 sem CAPI no step 1, 1 com dedup no submit)
- **Tempo:** 5 min

**Como fazer:**

```ts
// Arquivo: src/components/scheduling/SchedulingModal.tsx, linha ~101

// REMOVER trackLeadMeta("Dados Pessoais Preenchidos - Modal") do step 1
// Lead já é disparado corretamente no submit final com event_id real
```

**Validação:** Network DevTools → Test Events → confirmar 1 Lead por agendamento.

---

## 🟡 MEDIUM (fix este mês)

### 6. Documentar GA4 Secundário G-380EGEFL1S

- **Plataforma:** Google
- **Origem:** AUDIT-GOOGLE SL-06
- **Impacto:** confusão futura, manutenção difícil
- **Tempo:** 5 min (se você sabe o motivo) ou 30 min (investigação)

**Como fazer:** adicionar seção em `docs/GTM-EVENTOS-DATALAYER.md`:
- Por que existe um GA4 secundário?
- Quem o usa? (analytics terceirizado? backup? deduplicação?)
- Pode ser desativado?

### 7. Implementar Offline Conversions Google Ads

- **Plataforma:** Google
- **Origem:** AUDIT-GOOGLE CT-11
- **Impacto:** Smart Bidding otimiza por agendamento online (lead) e não por consulta efetiva (conversão real)
- **Tempo:** 4-8 horas (requer auth OAuth Google Ads + novo edge function)

**Como fazer:**
1. Capturar `gclid` no momento do agendamento (já fazemos via Conversion Linker)
2. Persistir gclid em `agendamentos.gclid` (já existe na migration `20260502005818`)
3. Quando consulta é confirmada/realizada, enviar offline conversion via API:
   ```
   POST https://googleads.googleapis.com/v17/customers/{customer_id}/conversionUploads:uploadClickConversions
   ```
4. Configurar conversion action "Consulta Realizada" no Google Ads UI
5. Marcar como conversão de valor higher do que "Lead" (e.g., R$ 600 vs R$ 300)

### 8. Onboard CAPI Gateway (Meta)

- **Plataforma:** Meta
- **Origem:** AUDIT-META F-05
- **Impacto:** sem o Gateway, rotação de token é manual sem automação. Gateway oferece automação melhor + analytics
- **Tempo:** 2 horas + aprovação Meta

**Como fazer:** seguir https://www.facebook.com/business/help/2998810550114526 — onboarding leva ~2h e requer aprovação.

### 9. Lembrete automatizado de rotação token (Meta)

- **Plataforma:** Meta
- **Origem:** AUDIT-META F-06
- **Impacto:** rotação manual fica esquecida
- **Tempo:** 5 min (Opção B) ou 30 min (Opção A/C)

**Como fazer (escolhe 1):**
- **A:** Cron job em Supabase ou n8n que envia email a cada 90 dias
- **B:** Calendar reminder Google Calendar (mais simples) — recorrente a cada 90 dias
- **C:** GitHub Actions workflow recorrente que abre issue

---

## 🟢 LOW (backlog)

### 10. Code guard contra duplicação GA4

- **Plataforma:** Google
- **Origem:** AUDIT-GOOGLE ST-07, SL-05
- **Tempo:** 1-2 horas

**Como fazer:** adicionar pre-commit hook ou ESLint custom rule que bloqueia criação de tag GA4 Configuration com All Pages no GTM (via JSON export validation no CI).

### 11. Server-side GTM (sGTM)

- **Plataforma:** Cross-platform
- **Origem:** Best practice modern stack
- **Tempo:** 1-2 dias setup + custo de hosting

**Como fazer:** considerar migração pra Server-side GTM (sGTM) hospedado em Cloud Run ou similar — proteção adicional contra ad blockers, melhor latência, controle de PII.

### 12. Outras pendências do roadmap CAPI (`docs/CERTIFICACAO-CAPI.md`)

- Audit Creative quando MCP Meta liberar BM oficial
- Audit Audience quando MCP Meta liberar
- Limpar 3 páginas Facebook duplicadas no BM (`dr.julianomachado_` IDs 111630064087696, 106458758020491, 102950325048710)
- Mover negócio "Milestotalpro" pra BM separada (risco de banimento generalizado)

---

## 📅 Cronograma sugerido

| Quando | Item | Tempo |
|---|---|---|
| **HOJE** | Critical #1 (dupla conversão) | 5 min |
| **AMANHÃ** | Critical #2 (Consent Mode bug) | 15 min |
| **Esta semana** | High #3, #4, #5 (Enhanced Conversions, dedup modal, trackLeadMeta) | ~45 min |
| **Próximas 2 semanas** | Medium #6, #9 (docs + lembrete) | ~10 min |
| **Mês corrente** | Medium #7, #8 (offline conv + CAPI Gateway) | 2 dias trabalho |
| **2026-05-10** | Soak metrics review (já agendado em memória) | 30 min |
| **2026-08-02** | Rotação token (já agendada em memória) | 5 min |

---

## ⚠️ NÃO escalar Google Ads até resolver Critical #1

Cada R$ adicional gasto hoje treina o Smart Bidding com dados de conversão 2× inflados. Isso causa over-bidding sistemático difícil de reverter depois. **Resolva o item #1 antes de qualquer aumento de budget.**

---

## 🎯 Resultado projetado pós-fixes Critical+High

- Health Score Meta: 80.8 → ~92 (corrige F-01, F-02, F-03)
- Health Score Google: 70.4 → ~88 (corrige CT-09, CT-08, CT-07)
- Aggregate: 75.6 → **~90 (Grade A-)**
- CPA Google reportado: ÷2 (corrige inflação artificial)
- Conversões iOS recuperadas: +10-30% (Enhanced Conversions)
- Dedup contract: 100% (atualmente parcial só na rota /agendamento)
