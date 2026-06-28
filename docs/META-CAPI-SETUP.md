# Meta CAPI — Setup do Dr. Juliano

**Pixel:** `1003792428067622` · **BM:** `493850516412413 (DrJulianomachado)`
**Última atualização:** revisado 2026-06-28 (sincronizado com o código)

Integração server-side já está plugada no código. Faltam só 3 passos de config para entrar em produção.

---

## Mudanças aplicadas no código (estado atual)

| Arquivo | Papel atual |
|---|---|
| `supabase/functions/meta-capi/index.ts` | Edge Function que recebe payload, hashea PII (SHA-256), captura IP/UA e envia ao Meta Graph API |
| `supabase/functions/converter-lead-agendamento/index.ts` | **Origem real dos eventos CAPI** — após converter o lead em agendamento, dispara `fireMetaCapiSchedule` **e** `fireMetaCapiCompleteRegistration` (helpers locais sobre `fireMetaCapi`), fire-and-forget, com `event_id = agendamento.id` (= `lead_id` atualizado), propagando IP/UA do request original e `fbc/fbp/utm_*/landing_page` lidos da linha atualizada |
| `supabase/functions/criar-lead/index.ts` | Cria a linha de lead inicial (captura `_fbc`, `_fbp`, UTMs, `landing_page`, IP, UA). **Não chama CAPI** diretamente — quem dispara é o `converter-lead-agendamento` no fechamento do funil |
| `src/services/agendamentos.ts` / `src/services/leads.ts` | Captura cookies `_fbc`, `_fbp`, UTMs e User Agent no browser e envia ao backend |
| `src/hooks/useMetaPixel.ts` | Aceita `eventId` opcional em todos os track methods + expõe `generateEventId()`. Empurra `meta_event_id` no dataLayer |
| `src/pages/Agendamento.tsx` | **Lado browser do funil**. Após `criarLead` (fim do step 2) chama `trackLead(..., lead_id)`; no submit final chama `trackSchedule(..., leadId)` e `trackCompleteRegistration(..., leadId)`. Como o `lead_id` é o mesmo `id` que o `converter-lead-agendamento` retorna como `agendamento.id`, **`meta_event_id` browser == `event_id` server** → dedup garantida |
| `src/components/WhatsAppButton.tsx` | Dispara `Contact` via dataLayer (GTM) com `event_id` (UUID) |

---

## Passo 1 — Gerar CAPI Access Token

1. Abre **Events Manager** → seu pixel `Pixel site Dr Juliano`
2. **Settings** → role até **Conversions API**
3. Clique **Generate Access Token**
4. Copia e guarda — só aparece UMA vez

---

## Passo 2 — Configurar secrets no Supabase

Dashboard → Edge Functions → Manage Secrets:

```
META_PIXEL_ID            = 1003792428067622
META_CAPI_ACCESS_TOKEN   = <token gerado no Passo 1>
META_TEST_EVENT_CODE     = (deixa vazio em prod)
```

---

## Passo 3 — Deploy

```bash
# Ainda em modo teste:
supabase secrets set META_TEST_EVENT_CODE=TEST12345
supabase functions deploy meta-capi --no-verify-jwt
supabase functions deploy criar-agendamento

# Faz uma reserva real no site, valida em Events Manager → Test Events
# Depois de validar (browser + server + dedup ✅):
supabase secrets unset META_TEST_EVENT_CODE
supabase functions deploy meta-capi --no-verify-jwt
```

---

## Passo 4 — Configurar tag GTM com event_id

Sem isso o pixel browser e o CAPI server não deduplicam.

### Variáveis Data Layer (criar no GTM)
```
DLV - meta_event_name      → meta_event_name
DLV - meta_event_id        → meta_event_id
DLV - content_name         → content_name
DLV - content_category     → content_category
DLV - value                → value
DLV - currency             → currency
```

### Trigger
Tipo: Custom Event
Event name (regex): `^meta_(lead|contact|view_content|schedule|complete_registration)$`

### Tag (Custom HTML)
```html
<script>
  (function() {
    var name = {{DLV - meta_event_name}};
    var id = {{DLV - meta_event_id}};
    if (!name || !id) return;
    fbq('track', name, {
      content_name: {{DLV - content_name}} || undefined,
      content_category: {{DLV - content_category}} || undefined,
      value: {{DLV - value}} || undefined,
      currency: {{DLV - currency}} || 'BRL'
    }, { eventID: id });
  })();
</script>
```

> **Crítico:** o `eventID` no `fbq()` deve ser idêntico ao `event_id` enviado pela Edge Function. Sem isso Meta conta cada conversão duas vezes.

---

## Eventos que vão disparar (browser + server)

| Evento | Trigger | event_id |
|---|---|---|
| **Lead** | Step 1 do modal de agendamento + submit final | UUID (step 1) / `agendamento.id` (final) |
| **Schedule** | Após criação bem-sucedida do agendamento | `agendamento.id` |
| **CompleteRegistration** | Após criação bem-sucedida | `agendamento.id` |
| **Contact** | Clique no botão WhatsApp flutuante | UUID gerado no momento |
| **ViewContent** | Abertura do modal de agendamento | UUID gerado no momento |

---

## Validação em Test Events

Com `META_TEST_EVENT_CODE` setado, faz uma reserva. Em **Events Manager → Test Events** você deve ver:

```
Schedule    [Browser] event_id=abc-123    ✅
Schedule    [Server]  event_id=abc-123    ✅
Deduplicação: Yes (event_id match)        ✅
```

Se ver dois Schedule **sem dedup**, o `eventID` não está sendo passado no `fbq()` do GTM (Passo 4).

---

## Métricas esperadas em 48-72h

| Métrica | Antes (medido em 2026-05-02) | Esperado |
|---|---|---|
| Lead/sem | 1 evento | 5–15 eventos |
| ViewContent rate | 0,25% | 20–40% |
| Server events | 0 | 100% paridade com browser |
| EMQ Schedule | sem dado | 7.0–9.0 |
| Dedup rate | N/A | ≥90% |

---

## Compliance

- **PII hashada server-side** (SHA-256, lowercase, trim) → atende LGPD
- **CRM-PA 15253 (Dr. Juliano)** → CAPI não toca em copy de criativo
- **Access Token** fica em env do Supabase, nunca no bundle do React
- **Telefone** normalizado para E.164 BR (prefixo +55)

---

## Falhas conhecidas (não bloqueiam)

- Se a Edge Function `meta-capi` cair → log warning no console, agendamento é criado normal
- Se cookies `_fbc`/`_fbp` ausentes (adblocker) → Meta usa fallback de IP+UA
- Se Supabase secrets não configurados → função retorna 500, mas agendamento prossegue

---

## Próximo passo após validação

Quando EMQ ≥7.0 e dedup ≥90% por 48h:
- Voltar ao audit Meta com print do Events Manager
- Rodar análise de Creative + Audience (50% restante do audit) assim que MCP for liberado na BM principal ou você der acesso Admin numa conta não-read-only
