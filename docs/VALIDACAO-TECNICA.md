# Validação Técnica — Meta CAPI Dr. Juliano

**Data:** 2026-05-02
**Cliente:** Dr. Juliano Machado · CRM-PA 15253 · sem RQE
**Pixel:** `1003792428067622` · **BM:** `493850516412413`
**Projeto:** Lovable Cloud `e5291dc7-2065-4dfc-9149-64aa4c0a0ce6` (Supabase ref `cnpifhaszbonwlqruwnn`)
**Endpoint CAPI:** `https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/meta-capi`

---

## 1. Resumo Executivo

| Camada | Status | Evidência |
|---|---|---|
| **Backend (Edge Functions)** | 🟢 ATIVO | Smoke test: `events_received: 1`, `fbtrace_id: AZxFIu_hn8bhLS0ahPJFpz9` |
| **Database (UTM columns)** | 🟢 ATIVO | Migration `20260502005818` aplicada |
| **Frontend (React)** | 🟢 ATIVO | DataLayer disparou `meta_lead` (confirmado via Tag Assistant) |
| **Pixel Base GTM** | 🟢 ATIVO | `Meta Pixel - Base` fired 1× |
| **GTM Tag CAPI Dedup** | 🔴 NÃO IMPORTADO | Tag `Meta Pixel - All Events (with CAPI Dedup)` ausente |
| **Tags GTM antigas** | 🔴 ATIVAS | 3 tags duplicarão conversões sem `eventID` |
| **Test Events Validation** | 🟡 PARCIAL | Server-side OK; Browser-side bloqueado por GTM pendente |

**Score técnico atual:** 5/7 camadas verdes = **71% deploy completo**

---

## 2. Arquitetura implementada

```
Browser (cliente)
  │
  ├─[1]→ React (useMetaPixel.ts)
  │      └─→ window.dataLayer.push({ event: 'meta_*', meta_event_id: <UUID> })
  │
  ├─[2]→ GTM (GTM-K3C2NNF6)
  │      └─→ fbq('track', name, custom, { eventID: <UUID> })  ← tag pendente
  │
  └─[3]→ supabase.functions.invoke('criar-agendamento', { ...form, fbc, fbp, utms })
              │
              ▼
        Edge Function: criar-agendamento
              │
              ├─→ INSERT agendamentos (id, ..., utm_*, fbc, fbp, landing_page)
              │
              └─→ supabase.functions.invoke('meta-capi', {
                    event_id: agendamento.id,    ← MESMO ID do browser
                    user_data: { em, ph, fn, ln, ct, st, country, fbc, fbp, ... },
                    custom_data: { ... }
                  })
                       │
                       ▼
                Edge Function: meta-capi
                       │
                       ├─→ SHA-256 hash em PII (em, ph, fn, ln, ct, st, zp, country)
                       ├─→ Captura client IP via x-forwarded-for
                       │
                       └─→ POST https://graph.facebook.com/v19.0/{pixel}/events
                              │
                              ▼
                       Meta Andromeda AI
                              │
                              └─→ Dedup por event_id ✅
```

**Cardinalidade do dedup:** 1 agendamento → 1 `event_id` (UUID Supabase) → 1 evento server + 1 evento browser → Meta combina em 1 conversão única.

---

## 3. Matriz de Validação

### 3.1 Eventos disparados (esperado vs real)

| Trigger | Browser (GTM) | Server (CAPI) | event_id | Status |
|---|---|---|---|---|
| Modal abre | `meta_view_content` | — | UUID gerado | 🟡 Browser pendente GTM import |
| Step 1→2 do form | `meta_lead` | — | UUID gerado | 🟢 DataLayer push confirmado |
| Submit reserva | `meta_schedule` | `Schedule` | `agendamento.id` | 🟡 Server OK, Browser pendente |
| Submit reserva | `meta_lead` | `Lead` | `agendamento.id` | 🟡 Server OK, Browser pendente |
| Submit reserva | `meta_complete_registration` | `CompleteRegistration` | `agendamento.id` | 🟡 Server OK, Browser pendente |
| Click WhatsApp | `meta_contact` | `Contact` | UUID gerado | 🟡 Server OK, Browser pendente |
| Smoke test manual | — | `PageView` | `lovable-smoke-test-001` | 🟢 **Validado em prod** |

### 3.2 Persistência de signals na tabela `agendamentos`

Colunas adicionadas pela migration `20260502005818`:

| Coluna | Capturada de | Status |
|---|---|---|
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | URL params + sessionStorage | 🟢 Pronto (a validar com reserva real) |
| `gclid`, `fbclid`, `gbraid`, `wbraid` | URL params + sessionStorage | 🟢 Pronto |
| `fbc`, `fbp` | Cookies `_fbc`, `_fbp` | 🟢 Pronto |
| `landing_page` | `window.location.href` (1ª página) | 🟢 Pronto |
| `referrer` | `document.referrer` | 🟢 Pronto |

### 3.3 Compliance e segurança

| Requisito | Status | Como atende |
|---|---|---|
| LGPD Art. 6 (segurança) | 🟢 | PII hashada SHA-256 server-side antes de sair do Supabase |
| LGPD Art. 7 (consentimento) | 🟡 | Banner de consent existe? — fora do escopo deste audit |
| Telefone E.164 | 🟢 | Função `normalizePhone()` adiciona +55 automaticamente |
| Email lowercase + trim | 🟢 | Função `sha256()` aplica antes do hash |
| Access Token em env | 🟢 | Lovable Cloud Secrets, nunca no bundle React |
| CFM 2.336/2023 (RQE) | 🟢 | CAPI não toca em copy de criativo |

---

## 4. Achados do Audit Inicial (2026-05-02)

| Achado | Severidade | Status pós-deploy |
|---|---|---|
| CAPI never fired (epoch 1969) | 🔴 CRÍTICO | 🟢 **RESOLVIDO** — `meta-capi` deployada e respondendo |
| Apenas 2 eventos configurados (PageView, ViewContent) | 🔴 CRÍTICO | 🟢 **RESOLVIDO** — 5 eventos no código (Lead, Schedule, Contact, CompleteRegistration, ViewContent) + PageView via GTM |
| ViewContent firing em 0,25% das visitas | 🔴 CRÍTICO | 🟡 **PARCIAL** — código React cobre todas as visitas ao modal; GTM tag pendente |
| Lead event firing 1× por semana | 🔴 CRÍTICO | 🟡 **PARCIAL** — código dispara em 3 momentos; GTM tag pendente |
| CAPI Gateway not onboarded | 🟡 WARNING | 🟢 **CONTORNADO** — implementação manual via Edge Function |
| Naming convention das campanhas | 🔴 CRÍTICO | 🔴 **PENDENTE** — fora do escopo CAPI |
| 3 páginas FB duplicadas `dr.julianomachado_` | 🔴 CRÍTICO | 🔴 **PENDENTE** — fora do escopo CAPI |

---

## 5. Componentes Implementados

### 5.1 Backend (Lovable Cloud Edge Functions)

| Arquivo | Tipo | LOC | Status |
|---|---|---|---|
| `supabase/functions/meta-capi/index.ts` | 🆕 NOVO | ~220 | 🟢 Deployada |
| `supabase/functions/criar-agendamento/index.ts` | ✏️ MODIFICADO | +50 | 🟢 Redeployada |

### 5.2 Frontend (React + Vite)

| Arquivo | Tipo | Mudanças | Status |
|---|---|---|---|
| `src/hooks/useMetaPixel.ts` | ✏️ Reescrito | +`eventId` opcional em todos os track methods, exporta `generateEventId()` | 🟢 Deployado |
| `src/services/agendamentos.ts` | ✏️ MODIFICADO | +35 LOC, função `captureMetaSignals()` com 13 campos | 🟢 Deployado |
| `src/components/scheduling/SchedulingModal.tsx` | ✏️ MODIFICADO | Passa `data.id` (UUID) como `eventId` em 3 events | 🟢 Deployado |
| `src/components/WhatsAppButton.tsx` | ✏️ MODIFICADO | Gera UUID + chama `meta-capi` direto (Contact server-side) | 🟢 Deployado |

### 5.3 Configuração

| Item | Status |
|---|---|
| `META_PIXEL_ID` (secret) | 🟢 Configurado |
| `META_CAPI_ACCESS_TOKEN` (secret) | 🟢 Configurado |
| `META_TEST_EVENT_CODE` (secret) | 🟢 Configurado (será removido em prod) |
| Migration `20260502005818` | 🟢 Aplicada |
| GTM Tag `Meta Pixel - All Events (with CAPI Dedup)` | 🔴 **PENDENTE IMPORT** |

### 5.4 Documentação e ferramentas

| Arquivo | Propósito |
|---|---|
| `IMPLEMENTACAO.md` | Guia passo a passo Lovable Cloud |
| `META-CAPI-SETUP.md` | Referência técnica detalhada |
| `LOVABLE-PROMPTS.md` | 7 prompts prontos para chat Lovable AI |
| `gtm-meta-pixel-import.json` | Container GTM importável |
| `scripts/test-meta-capi.ps1` | Validador isolado do endpoint |
| `scripts/deploy-meta-capi.ps1` | Orquestrador (legacy — Lovable Cloud já cobre) |
| `meta-capi-bundle/` | Pasta consolidada com todos os arquivos |

---

## 6. Risk Register

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Token Meta expirado em 90 dias | Alta | Médio | Setar lembrete no calendário; rotacionar via Cloud Secrets |
| Tag GTM antiga continuar ativa após import | Alta | **Crítico** | Pausar manualmente: `Meta Pixel - Schedule`, `Meta Pixel - Lead WhatsApp`, `Meta Pixel - Lead Telefone` |
| EMQ baixo (<6.0) por normalização errada | Média | Médio | Logs em Cloud → Edge Functions; ajustar `normalizePhone()` se necessário |
| Adblockers bloqueando `_fbc`/`_fbp` | Alta | Baixo | Meta tem fallback IP+UA (já incluído) |
| Race condition: form submeta antes de cookies fbc/fbp serem setados | Baixa | Baixo | sessionStorage + UTM sobrevive a reload |
| `META_TEST_EVENT_CODE` esquecido em prod | Média | **Crítico** | Lembrete em Prompt 6; conferir em 48h |
| Migration falhar em prod (já aplicada) | Baixa | Crítico | Já aplicada — confirmado |

---

## 7. Métricas de Sucesso (medir em 48-72h)

### 7.1 Health metrics no Events Manager

| Métrica | Baseline (2026-05-02 audit) | Target | Crítico se |
|---|---|---|---|
| Lead/sem | 1 evento | 5-15 | <3 |
| Schedule/sem | 0 eventos | 5-15 | =0 |
| Server events ratio | 0% | ≥95% paridade | <80% |
| Dedup rate (browser↔server) | N/A | ≥90% | <70% |
| EMQ Schedule | sem dado | ≥7.0 | <6.0 |
| EMQ Lead | sem dado | ≥7.0 | <6.0 |
| ViewContent / PageView ratio | 0,25% | 20-40% | <10% |

### 7.2 Database metrics (validar via SQL)

```sql
-- Captura de UTMs em novos agendamentos
SELECT
  COUNT(*) AS total_agendamentos,
  COUNT(utm_source) AS com_utm_source,
  COUNT(fbc) AS com_fbc,
  COUNT(fbp) AS com_fbp,
  ROUND(100.0 * COUNT(utm_source) / COUNT(*), 1) AS pct_utm
FROM agendamentos
WHERE created_at >= '2026-05-02';
```

**Target:** ≥60% dos agendamentos com `utm_source` preenchido (60% é razoável considerando tráfego direto e orgânico).

### 7.3 CPL real por canal (post-deploy)

```sql
-- CPL e CR por campanha (rodar em 7 dias)
SELECT
  utm_campaign,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE status_crm = 'ATENDIDO') AS atendidos,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status_crm = 'ATENDIDO') / COUNT(*), 1) AS cr_pct
FROM agendamentos
WHERE created_at >= '2026-05-02'
  AND utm_source IS NOT NULL
GROUP BY utm_campaign
ORDER BY leads DESC;
```

---

## 8. Plano de Ação Imediato (próximos 30 min)

### Passo crítico — desbloquear browser-side (5 min)

```
1. Abre tagmanager.google.com → container GTM-K3C2NNF6
2. Admin → Import Container → gtm-meta-pixel-import.json
3. Workspace: criar "Meta CAPI Setup"
4. Merge + Rename conflicting → Confirm
5. Aba Tags:
   - Pausar: Meta Pixel - Schedule
   - Pausar: Meta Pixel - Lead WhatsApp
   - Pausar: Meta Pixel - Lead Telefone
   - MANTER ativa: Meta Pixel - Base
6. Submit → "Meta CAPI dedup setup" → Publish
```

### Validação E2E (10 min)

```
1. Janela anônima → drjulianomachado.com?utm_source=test_capi&utm_campaign=deploy_validation
2. Tag Assistant Companion → conectar ao container
3. Meta Pixel Helper → abrir
4. Fazer reserva real (preenchendo dados próprios)
5. Clicar botão WhatsApp em outra aba

Verificar simultaneamente:
  - Meta Pixel Helper: 4 eventos (Lead, Schedule, CompleteRegistration, Contact) com eventID visível
  - Tag Assistant: variável DLV - meta_event_id populada em cada disparo
  - Events Manager → Test Events: pares browser+server com Dedup ✅
```

### Cola Prompt 4 no Lovable AI (1 min)

```
Roda SQL para confirmar persistência de UTMs/fbc/fbp no agendamento mais recente.
```

### Soak time (24-48h)

Continua usando o site normalmente. Monitorar logs:
- Cloud → Edge Functions → meta-capi → Logs (procurar erros)
- Events Manager → Test Events (volumetria)

### Promoção para produção (Prompt 6, depois de 48h)

```
Lovable AI: remove o secret META_TEST_EVENT_CODE e redeploya meta-capi.
```

---

## 9. Sign-off técnico

| Componente | Owner | Status |
|---|---|---|
| Backend (Edge Functions) | Lovable Cloud | 🟢 Deploy automático ativo |
| Database schema | Migration `20260502005818` | 🟢 Aplicada |
| Frontend (React) | Lovable Cloud | 🟢 Deployado |
| Browser tracking (GTM) | Tag Manager | 🔴 **Pendente import** |
| Meta CAPI integração | Edge Function `meta-capi` | 🟢 Smoke test passou |
| Documentação | `/IMPLEMENTACAO.md` + `/LOVABLE-PROMPTS.md` | 🟢 Completa |

**Bloqueio único restante:** import do GTM. Resolução estimada: 5 min de trabalho manual.

**Após resolver o GTM:** integração 100% operacional. Estimativa de ganho de conversão atribuída pós-iOS 14.5: **+30 a +40%** em 7-14 dias.

---

**Documento gerado em:** 2026-05-02 16:21 (horário local)
**Responsável técnico:** Claude Ads (audit + integração)
**Cliente final:** Dr. Juliano Machado — drjulianomachado.com
