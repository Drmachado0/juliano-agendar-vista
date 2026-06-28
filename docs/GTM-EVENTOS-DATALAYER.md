# Documentação de Eventos do DataLayer - Google Tag Manager

**Container GTM:** `GTM-K3C2NNF6`
**Última atualização:** revisado 2026-06-28 (sincronizado com o código)

---

## IDs de Referência

| Plataforma | ID | Descrição | Status |
|------------|-----|-----------|--------|
| GTM Container | GTM-K3C2NNF6 | Google Tag Manager (único loader no `index.html`) | ✅ Ativo |
| GA4 Principal | G-79BDCX4R2L | drjulianomachado.com | ✅ Disparando em runtime (via GTM) |
| GA4 Secundário | G-380EGEFL1S | Site Dr Juliano Machado | ✅ Disparando em runtime (via GTM) |
| GA4 Terceiro | G-T9ERC72SJE | ⚠️ Origem não documentada — investigar e consolidar (3 propriedades GA4 fragmentam os dados) | ⚠️ Disparando em runtime |
| Google Ads | AW-436492720 | Conta de Ads | Via GTM |
| Meta Pixel | 1003792428067622 | Pixel site Dr Juliano (BM 493850516412413) | ✅ CAPI dedup ativo |

> Nenhum `G-…` aparece hard-coded no código do site. As três propriedades GA4 estão configuradas dentro do GTM `GTM-K3C2NNF6` (verificável em `/admin/auditoria-tracking`). O `index.html` só carrega o GTM via `src/lib/loadTrackingScripts.ts` após consent.

---

## GA4 — Estratégia de propriedades múltiplas

- **GA4 Principal `G-79BDCX4R2L`** — propriedade canônica para drjulianomachado.com, alimenta Looker Studio.
- **GA4 Secundário `G-380EGEFL1S`** — propriedade paralela ativa. `[TODO PREENCHER MOTIVO]` (backup, analytics terceirizado, agência?). Investigar com stakeholder antes de remover.
- **GA4 Terceiro `G-T9ERC72SJE`** — ⚠️ **não documentada**. Foi detectada em runtime mas não há referência no código nem motivo registrado. **Investigar origem (tag órfã no GTM? script de terceiro?) e consolidar — três propriedades simultâneas fragmentam métricas, inflacionam usuários únicos e dificultam atribuição.**

Decisão arquitetural: todas as propriedades GA4 são gerenciadas exclusivamente via GTM. **NÃO criar** tag `GA4 Configuration` com trigger `All Pages` adicional — causa duplicação de pageviews.

---

## Arquitetura de Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA DE TRACKING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  index.html (sob LGPD Consent Mode v2 default-denied)            │
│  └── GTM (GTM-K3C2NNF6) — carregado por loadTrackingScripts.ts   │
│        ├── GA4 G-79BDCX4R2L (principal)                          │
│        ├── GA4 G-380EGEFL1S (secundária)                         │
│        ├── GA4 G-T9ERC72SJE  (⚠️ investigar)                     │
│        ├── Meta Pixel 1003792428067622 + CAPI dedup              │
│        └── Google Ads AW-436492720                               │
│                                                                  │
│  useGoogleTag.ts (DataLayer push) — funil + CTAs + WhatsApp      │
│  useMetaPixel.ts (DataLayer push) — meta_event_id p/ CAPI dedup  │
│                                                                  │
│  Bloqueado em /admin/* e /auth (trackingGuard)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mapeamento de Arquivos → Eventos (estado real do código)

| Arquivo | Evento(s) | Helper |
|---------|-----------|--------|
| `src/pages/Agendamento.tsx` *(funil público canônico)* | `view_scheduling_page`, `lp_form_start`, `lp_step_view`, `lp_step_completed`, `lead_created`, `lp_appointment_scheduled`, `lp_appointment_error`, `lp_appointment_success` + `google_ads_conversion`, `purchase`, `generate_lead`, `meta_lead`, `meta_schedule`, `meta_complete_registration` | `pushDL` direto + `useGoogleTag` + `useMetaPixel` |
| `src/components/scheduling/SchedulingModal.tsx` *(modal — fluxo legado homepage)* | versão `modal_*` dos eventos do funil + `modal_appointment_success` | `useGoogleTag` |
| `src/components/HeroSection.tsx` | `cta_click` (cta_name=`agendar_consulta`, cta_location=`hero`; cta_name=`saiba_mais`, cta_location=`hero`), `whatsapp_click` (`button_id=whatsapp_hero`, `button_location=hero`) | `trackCTAClick`, `trackWhatsAppClick` |
| `src/components/AgendarSimplesSection.tsx` | `cta_click` (cta_name=`agendar_consulta`, cta_location=`agendar_simples`), `whatsapp_click` (`button_id=whatsapp_agendar_simples`, `button_location=agendar_simples`) | `trackCTAClick`, `trackWhatsAppClick` |
| `src/components/MobileStickyCTA.tsx` | `cta_click` (cta_name=`agendar_consulta`, cta_location=`sticky_mobile`), `whatsapp_click` (`button_id=whatsapp_sticky_mobile`, `button_location=sticky_mobile`) | `trackCTAClick`, `trackWhatsAppClick` |
| `src/components/InsuranceSection.tsx` | `cta_click` | `trackCTAClick` |
| `src/components/WhatsAppButton.tsx` | `whatsapp_click`, `meta_contact` (com `event_id` p/ CAPI) | `trackWhatsAppClick`, `useMetaPixel.trackContact` |

> Não existe mais `src/pages/Agendar.tsx`. O funil público é `Agendamento.tsx`.

---

## Eventos Disponíveis

### 1. `view_scheduling_page` — abertura da landing `/agendamento`
```javascript
{ event: 'view_scheduling_page', page_path: '/agendamento', page_type: 'landing_agendamento' }
```

### 2. `lp_form_start` / `modal_form_start` — primeiro keystroke real
```javascript
{ event: 'lp_form_start' | 'modal_form_start', page_type: 'landing_agendamento' | 'modal' }
```

### 3. `lp_step_view` — montagem de cada step (somente landing)
```javascript
{ event: 'lp_step_view', page_type: 'landing_agendamento', step: 1|2|3|4 }
```

### 4. `lp_step_completed` / `modal_step_completed` — usuário avança
```javascript
{ event: 'lp_step_completed' | 'modal_step_completed', step: 1|2|3, page_type: ... }
```

### 5. `lead_created` — após criar o lead no Supabase (fim do step 2)
```javascript
{
  event: 'lead_created',
  lead_id: '<uuid>',
  event_id: 'lead_<uuid>',
  content_name: 'Agendamento Formulario - Site',
  content_category: 'Consulta Oftalmológica',
  value: 300, currency: 'BRL',
  tipo_atendimento: '...'
}
```
Disparado em paralelo com `meta_lead` (`useMetaPixel.trackLead`) usando o **mesmo `lead_id` como `meta_event_id`** — garante dedup com o CAPI server-side (que usa o `id` do agendamento, idêntico ao `lead_id`).

### 6. `lp_appointment_scheduled` — submit final bem-sucedido
```javascript
{
  event: 'lp_appointment_scheduled',
  page_type: 'landing_agendamento',
  tipo_atendimento: '...', local: '...',
  value: 300, currency: 'BRL'
}
```

### 7. `lp_appointment_error` / `modal_appointment_error`
```javascript
{
  event: 'lp_appointment_error' | 'modal_appointment_error',
  page_type: ...,
  error_type: 'availability' | 'other' | 'unexpected',
  error_message: '...'
}
```

### 8. `lp_appointment_success` / `modal_appointment_success` + `google_ads_conversion` (CONVERSÃO REAL)

Disparado uma única vez por `trackAppointmentSuccess` (guard `successFiredRef`). É o **evento de conversão real do agendamento** e empurra **dois** eventos ao dataLayer:

```javascript
// 1) Funil GA4
{
  event: 'lp_appointment_success' | 'modal_appointment_success',
  step: 'appointment_success',
  page_type: 'landing_agendamento' | 'modal',
  appointment_id: '<uuid>',
  appointment_type: '...', location: '...',
  appointment_value: 300, value: 300, currency: 'BRL'
}

// 2) Conversão Google Ads
{
  event: 'google_ads_conversion',
  conversion_label: 'agendamento_confirmado',
  value: 300, currency: 'BRL'
}
```

> ⚠️ **Atenção (diferente de `trackPhoneClick` e `trackWhatsAppGoogleAdsConversion`):** este evento **NÃO traz `send_to`**. Ele depende de **uma tag no GTM** com trigger `Custom Event = google_ads_conversion` (e opcionalmente filtrando `conversion_label = agendamento_confirmado`) que mapeie para a conversão real `AW-436492720/<label>` no Google Ads. Sem essa tag a conversão **não é registrada**. Os outros dois helpers (`trackPhoneClick`, `trackWhatsAppGoogleAdsConversion`) já enviam `send_to` direto e funcionam mesmo sem tag dedicada — esta não.

### 9. `purchase` — `trackScheduleComplete` (legado, mantido para compat)
```javascript
{
  event: 'purchase', event_category: 'agendamento', event_label: 'agendamento_confirmado',
  appointment_type: '...', location: '...'
}
```

### 10. `generate_lead` — `trackLead`
```javascript
{ event: 'generate_lead', event_category: 'lead', event_label: 'formulario' }
```

### 11. `cta_click` — `trackCTAClick(name, location, text)`
```javascript
{
  event: 'cta_click',
  cta_name: 'agendar_consulta' | 'saiba_mais',
  cta_location: 'hero' | 'agendar_simples' | 'sticky_mobile' | 'convenios' | 'about' | 'procedures' | 'footer' | 'header_desktop' | 'header_mobile',
  cta_text: '...'
}
```

### 12. `whatsapp_click` — `trackWhatsAppClick(url, text, button_id, button_location)`
```javascript
{
  event: 'whatsapp_click',
  button_id: 'whatsapp_hero' | 'whatsapp_agendar_simples' | 'whatsapp_sticky_mobile' | 'whatsapp_generic' | ...,
  button_location: 'hero' | 'agendar_simples' | 'sticky_mobile' | ...,
  button_text: '...',
  destination_url: 'https://wa.me/...',
  // legados (compat)
  link_url: '...', link_text: '...'
}
```

Pontos de disparo confirmados no código:
- **HeroSection** → `button_id=whatsapp_hero`, `button_location=hero`
- **AgendarSimplesSection** → `button_id=whatsapp_agendar_simples`, `button_location=agendar_simples`
- **MobileStickyCTA** → `button_id=whatsapp_sticky_mobile`, `button_location=sticky_mobile`

### 13. `phone_click` — `trackPhoneClick` (já com `send_to` direto)
```javascript
{ event: 'phone_click', link_url: 'tel:+55...' }
{ event: 'google_ads_conversion', send_to: 'AW-436492720/R5yuCJjn7ZwcELCzkdAB', value: 300, currency: 'BRL' }
```

### 14. `google_ads_conversion` (WhatsApp) — `trackWhatsAppGoogleAdsConversion`
```javascript
{ event: 'google_ads_conversion', send_to: 'AW-436492720/-h8XCK3z6JwcELCzkdAB', value: 300, currency: 'BRL' }
```

### 15. `contact` — `trackContact(method)`
```javascript
{ event: 'contact', event_category: 'contato', event_label: 'whatsapp', method: 'whatsapp' }
```

---

## Funil completo (landing `/agendamento`)

```
view_scheduling_page
   → lp_form_start
   → lp_step_view (×4)
   → lp_step_completed (×3)
   → lead_created (+ meta_lead com event_id = lead_id)
   → lp_appointment_scheduled
       + lp_appointment_success + google_ads_conversion (conversion_label=agendamento_confirmado)
       + meta_schedule + meta_complete_registration (event_id = lead_id, dedup CAPI)
   OU lp_appointment_error
```

### Métricas

| Métrica | Fórmula |
|---|---|
| Taxa global | `count(lp_appointment_success) / count(view_scheduling_page)` |
| Taxa de início | `count(lp_form_start) / count(view_scheduling_page)` |
| Taxa por step | `count(lp_step_completed step=N) / count(lp_step_view step=N)` |
| Taxa de erro | `count(lp_appointment_error) / count(lp_step_completed step=3)` |

---

## Configuração no GTM

### Tag obrigatória — Conversão de agendamento

```
Tipo: Google Ads — Conversion Tracking
Conversion ID: AW-436492720
Conversion Label: <label criado no Google Ads p/ "Agendamento Confirmado">
Value: {{DLV - value}}    Currency: {{DLV - currency}}
Trigger: Custom Event = google_ads_conversion
         (opcional: filtrar conversion_label = agendamento_confirmado)
```

### Variáveis Data Layer recomendadas

| Variável | DL key |
|---|---|
| DLV - value | value |
| DLV - currency | currency |
| DLV - conversion_label | conversion_label |
| DLV - appointment_type | appointment_type |
| DLV - location | location |
| DLV - cta_name | cta_name |
| DLV - cta_location | cta_location |
| DLV - cta_text | cta_text |
| DLV - button_id | button_id |
| DLV - button_location | button_location |
| DLV - meta_event_id | meta_event_id |

### Tag Meta Pixel (com dedup CAPI)

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
Trigger: `Custom Event` regex `^meta_(lead|contact|view_content|schedule|complete_registration)$`.

---

## Suporte

Hook principal: `src/hooks/useGoogleTag.ts`
Pixel Meta (via dataLayer + CAPI dedup): `src/hooks/useMetaPixel.ts`
Loader GTM: `src/lib/loadTrackingScripts.ts`
Auditoria runtime: `/admin/auditoria-tracking`
