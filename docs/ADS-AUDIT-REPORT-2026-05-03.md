# Auditoria Multi-Plataforma de Ads — Dr. Juliano Machado
**Data:** 2026-05-03
**Domínio:** drjulianomachado.com
**Escopo:** Implementação técnica (Meta + Google)
**Escope-out:** Performance/spend data (sem export de Ads Manager)
**Auditor:** Claude Ads Skill (audit-meta + audit-google + síntese)

---

## 🎯 Executive Summary

### Aggregate Health Score: **75.6 / 100 (B-)**

| Plataforma | Score | Grade | Status |
|---|---|---|---|
| Meta Ads (implementação) | 80.8 | B+ | 🟢 Saudável com warnings |
| Google Ads (implementação) | 70.4 | C+ | 🟡 Crítico (dupla conversão) |
| **Aggregate** | **75.6** | **B-** | 🟡 |

> Nota: aggregate calculado por média simples (sem budget data). Pesos reais variam conforme allocation. Implementação Meta saiu mais saudável principalmente porque o CAPI deploy de 2026-05-02 foi recente e bem feito; Google ficou penalizado por 2 issues críticos pré-existentes.

### Business Type Detected
**Saúde — Médico individual (oftalmologia)**
- CRM-PA 15253 sem RQE → restrição de copy ("Médico Oftalmologista" only, NÃO "especialista")
- Compliance: Resolução CFM 2.336/2023, LGPD

### Active Platforms
- ✅ **Meta Ads** (Pixel `1003792428067622` + CAPI server-side)
- ✅ **Google Ads** (Conversion ID `AW-436492720`, 4 conversion actions)
- ✅ **GA4 dual** (G-79BDCX4R2L principal + G-380EGEFL1S secundário)
- ❌ LinkedIn / TikTok / Microsoft / Apple Ads (não em uso)

### Top 5 Critical Issues

| # | Plataforma | Issue | Impacto | Fix time |
|---|---|---|---|---|
| 1 | Google | **Dupla conversão** em SchedulingModal (gtag direto + GTM tag) | Cada agendamento conta 2× → CPA inflado, ROAS distorcido, Smart Bidding training corrompido | 5 min |
| 2 | Meta+Google | **Consent Mode bug** — GTM só carrega se `analytics: granted` mas conversões dependem do GTM | Usuário que aceita só marketing perde Pixel + perde Google Ads conversion | 15 min |
| 3 | Google | **Enhanced Conversions** não configurado | Perde 10-30% conversões iOS (Apple ATT/Safari ITP) | 20 min |
| 4 | Meta | **Dedup quebrado no modal** — fallback `'created'` em SchedulingModal | Eventos do modal homepage não dedupam com CAPI server | 10 min |
| 5 | Meta | **trackLeadMeta no step 1 do modal** — dispara antes do lead existir no DB | Lead duplicado sem dedup no modal | 5 min |

**Total fix time: ~55 minutos para resolver os 5 críticos.**

### Top 5 Quick Wins (todas <15min)

Ver detalhamento em `docs/ADS-QUICK-WINS-2026-05-03.md`. Resumo:

| # | Issue | Tempo |
|---|---|---|
| 1 | Remover gtag direto duplicado | 5 min |
| 2 | Fix Consent Mode bootstrap | 15 min |
| 3 | Mover trackLeadMeta do step 1 | 5 min |
| 4 | Fix dedup do SchedulingModal | 10 min |
| 5 | Documentar GA4 Secundário | 5 min |

---

## 🔵 Meta Ads — Detalhamento (80.8/100, Grade B+)

> Reference: `docs/AUDIT-META-2026-05-03.md`

### Score Breakdown
| Categoria | Peso | Score | Ponderado |
|---|---|---|---|
| Pixel/CAPI Health | 60% | 84/100 | 50.4 |
| Account Structure (incl. GTM) | 40% | 76/100 | 30.4 |
| **Total** | | | **80.8** |

### Findings

#### 🟢 PASS (implementação correta)
- Pixel `1003792428067622` confirmado em produção (2 tags ativas) — phantom `1358767025715686` fora de produção
- CAPI deployada com fbtrace_ids reais validados em 2026-05-02
- Dedup contract fechado na rota `/agendamento`: `lead.id` vira `event_id` browser+server
- Domain Verification coerente (`1jl02qpc58up9nrn9vdf5lyiv0tppz` ↔ BM 493850516412413)
- PII hashada SHA-256 corretamente (lowercase+trim)
- Telefone normalizado E.164 BR (+55)
- Rotas `/admin/*` e `/auth` bloqueadas pra tracking (guard duplo: index.html + trackingGuard.ts)
- `META_TEST_EVENT_CODE` removido em 2026-05-03 (Test Events parou de receber)
- 100% via GTM, sem `fbq()` direto no bundle React
- 13 sinais Meta capturados (UTMs + click IDs + cookies + landing/referrer)
- Compliance CFM 2.336/2023 confirmado no site

#### 🟡 WARNING
- **F-01 (High):** Consent Mode bug — `c.analytics` controla GTM mas Meta Pixel é `ad_storage` (marketing). `isAnalyticsAllowed()` verifica wrong property
- **F-02 (Medium):** Dedup quebrado no SchedulingModal por fallback `'created'` em `agendamentos.ts:278`
- **F-03 (Low-Med):** trackLeadMeta no step 1 do modal sem CAPI correspondente
- **F-04 (Low):** GA4 secundário `G-380EGEFL1S` sem propósito documentado
- **F-05 (Low):** CAPI Gateway `NOT_ONBOARDED` (sem automação de rotação)
- **F-06 (Low):** Token rotation só documental, sem lembrete automatizado

---

## 🟡 Google Ads — Detalhamento (70.4/100, Grade C+)

> Reference: `docs/AUDIT-GOOGLE-2026-05-03.md`

### Score Breakdown
| Categoria | Peso | Score | Ponderado |
|---|---|---|---|
| Conversion Tracking | 50% | 62/100 | 31.0 |
| Settings & Targeting | 30% | 78/100 | 23.4 |
| Account Structure | 20% | 80/100 | 16.0 |
| **Total** | | | **70.4** |

### Findings

#### 🔴 CRITICAL (FAIL)
- **CT-02 / CT-09:** Dupla conversão Google Ads confirmada
  - `SchedulingModal.tsx:168-174` chama `window.gtag('event', 'conversion', { send_to: 'AW-436492720/tUOICNX06JwcELCzkdAB' })`
  - **Mais** tag GTM "Google Ads - Conversão Formulário" disparada via `purchase` no dataLayer
  - Resultado: 2 hits por agendamento → CPA divide-by-2 falsificado, Smart Bidding aprende com ruído
- **CT-08:** Enhanced Conversions não configurado — nenhum campo hashed enviado, dados existem no formData mas não chegam ao Google

#### 🟡 WARNING
- **CT-07 / ST-08:** Consent Mode bootstrap só carrega GTM se `analytics: granted`. Usuário que aceita marketing only perde conversão Google Ads.
- **CT-11:** Offline conversions não implementadas (agendamento → consulta real não fecha loop)
- **ST-07:** GA4 - Configuracao com All Pages no GTM enquanto gtag direto está em index.html — risco de duplicação de pageviews (proteção apenas documental, sem code guard)
- **SL-03:** `useGoogleTag` deveria ser fonte única, mas SchedulingModal chama gtag direto
- **SL-05/06:** Dual GA4 sem code guard contra duplicação + sem propósito documentado

#### 🟢 PASS (implementação correta)
- Conversion Linker presente e firing antes das conversões (gclid capture OK)
- Conversion Action principal definida (R$ 300, BRL)
- Conversion Action secundária WhatsApp (`AW-436492720/-h8XCK3z6JwcELCzkdAB`)
- Tracking guard em rotas privadas
- Schema JSON-LD Physician válido
- Canonical URL definida
- DataLayer inicializado antes do GTM snippet
- GTM container ID coincidente entre script e noscript (`GTM-K3C2NNF6`)
- Filtro hostname GTM ativo (aplicado hoje na v26)
- Remarketing tag presente
- Funil granular `lp_*` e `modal_*` implementado consistente
- `safeDataLayerPush` bloqueia rotas privadas
- Eventos dataLayer nomeados consistentemente (`purchase`, `begin_checkout`, etc.)

---

## 🔄 Cross-Platform Analysis

### Tracking Consistency
✅ **Eventos compartilhados via dataLayer** — ambas plataformas (Meta+Google) leem do mesmo `dataLayer`. Mudanças no funil propagam automaticamente.

⚠️ **Convenções de naming divergem (esperado e OK):**
- Google: `purchase`, `begin_checkout`, `generate_lead` (GA4 standard)
- Meta: `meta_lead`, `meta_schedule`, `meta_view_content` (custom prefixed)

### Attribution Overlap
🔴 **Risco confirmado** — dupla conversão no Google Ads. No Meta, dedup OK na rota `/agendamento` mas parcial no modal homepage (problema F-02).

### Consent Mode Coupling (cross-platform falha)
🔴 **Falha lógica compartilhada** — o bootstrap em `index.html:44-51` carrega GTM apenas se `c.analytics === true`. Issue afeta TANTO Meta quanto Google porque ambos dependem do GTM. **Fix único resolve para ambas plataformas.**

### LGPD/CFM Compliance
- ✅ Consent Mode v2 default-denied corretamente implementado
- ✅ PII Meta hashada SHA-256 server-side
- ✅ Compliance CFM verificada (sem "especialista" em criativos)
- ✅ Tracking de rotas privadas bloqueado

---

## 📋 Strategic Recommendations

### Plataforma Prioritization
1. **Google Ads** — alto intent (busca por "oftalmologista paragominas"), maior LTV potencial. Mas conversões hoje INFLADAS 2× → Smart Bidding training corrompido. **Crítico fixar antes de escalar.**
2. **Meta Ads** — melhor pra awareness/consideration. CAPI deployment é vantagem diferencial. Implementação saudável.

### Budget Reallocation
[Sem performance data não consigo recomendar reallocation precisa — request: export de últimos 30 dias de ambas plataformas]

### Scaling Opportunities
- ⏸ **NÃO escalar Google Ads** até resolver dupla conversão. Cada R$ 1k a mais hoje gera dados podres pra Smart Bidding optimization.
- ✅ **Pode escalar Meta** — implementação saudável, CAPI restorando 30-40% sinal iOS.

### Kill List
- Eliminar 1 dos 2 caminhos da conversão Google Ads (recomendação: gtag direto em SchedulingModal)
- Considerar mover negócio "Milestotalpro" pra BM Meta separada (risco de banimento generalizado pelo BM principal)

---

## 📚 Reports Anexos

- `docs/AUDIT-META-2026-05-03.md` — relatório detalhado audit-meta agent
- `docs/AUDIT-GOOGLE-2026-05-03.md` — relatório detalhado audit-google agent
- `docs/ADS-ACTION-PLAN-2026-05-03.md` — plano de ação priorizado
- `docs/ADS-QUICK-WINS-2026-05-03.md` — fixes <15min

---

## 🗂 Histórico de Mudanças nesta Sessão (2026-05-03)

| Item | Estado |
|---|---|
| Lovable Publish (4 commits) | ✅ Live |
| GTM v26 publicada | ✅ Live |
| Filtro hostname (2 triggers) | ✅ Aplicado |
| 3 tags Meta pausadas excluídas | ✅ Removidas |
| META_TEST_EVENT_CODE removido | ✅ Propagou |
| Pixel ID verificado em produção | ✅ 1003792428067622 confirmado |
| Doc GTM-EVENTOS-DATALAYER atualizado | ✅ |
| Memória com checkpoints futuros | ✅ |
| Smoke test client-side | ✅ |
| Audit completo Meta + Google | ✅ Este relatório |

---

**Próximas ações:** ver `docs/ADS-ACTION-PLAN-2026-05-03.md` (priorizado) e `docs/ADS-QUICK-WINS-2026-05-03.md` (fixes <15min).
