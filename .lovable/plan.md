## Objetivo

Na página `/obrigado`, manter o `thank_you_page_view` atual e também empurrar os 3 eventos legados que o GTM (GTM-K3C2NNF6) ainda espera, para a conversão de agendamento voltar a disparar.

## ⚠️ Conflito importante a decidir antes

O código atual em `src/pages/Obrigado.tsx` (linhas 13-24) tem um comentário explícito dizendo para **NÃO** disparar conversões aqui, porque `/agendamento` já dispara `Lead/Schedule/CompleteRegistration/google_ads_conversion` no submit, com `event_id = leadId` para deduplicar com Meta CAPI server-side. Disparar de novo em `/obrigado` causaria **double-count** em Google Ads e Meta Ads Manager.

O documento enviado pede para adicionar `google_ads_conversion`, `meta_lead` e `meta_complete_registration` em `/obrigado` mesmo assim, com `event_id` novo gerado por `crypto.randomUUID()` (não vinculado ao `leadId`, então sem dedup com CAPI).

**Possíveis caminhos:**

1. **Aplicar exatamente como o documento pede** (risco de double-count, mas é literalmente o que está escrito).
2. **Aplicar só em `/obrigado` e remover o disparo equivalente do submit em `/agendamento`** para evitar duplicação.
3. **Ajustar o GTM no lado do GTM** (não no código) para escutar os eventos novos que o site já envia, sem mexer no código.

## Plano (assumindo opção 1 — aplicar como o documento pede)

### Arquivo a alterar
- `src/pages/Obrigado.tsx`

### Mudanças
- Adicionar `useRef` para guard de execução única (`trackingFiredRef`).
- Manter o `safeDataLayerPush({ event: 'thank_you_page_view', ... })` existente, mas estender o payload com `conversion_value: 300`, `currency: 'BRL'` e `event_id` (UUID gerado uma vez).
- Empurrar diretamente em `window.dataLayer` (sem passar pelo consent guard, conforme o documento) os eventos:
  - `google_ads_conversion` com `send_to: "AW-436492720/tUOICNX06JwcELCzkdAB"`, `value: 300`, `currency: "BRL"`, `event_id`.
  - `meta_lead` com `meta_event_name: "Lead"`, `value: 300`, `currency: "BRL"`, `event_id`.
  - `meta_complete_registration` com `meta_event_name: "CompleteRegistration"`, `value: 300`, `currency: "BRL"`, `event_id`.
- Mesmo `event_id` nos 3 eventos Meta (para futura dedup com CAPI).
- Guard com `useRef` impede duplicação em re-render / StrictMode.
- **Não alterar** layout, JSX, textos, handler do botão WhatsApp, nem o restante da página.
- **Não tocar** em CRM, formulário, edge functions, GTM no `index.html`, Pixel ou GA4.

### Validação após deploy
- Abrir `/obrigado` no preview e inspecionar `window.dataLayer` — confirmar presença dos 4 eventos com os campos descritos no documento e `event_id` igual entre os 3 eventos Meta.

---

**Confirma qual opção seguir? (1, 2 ou 3).** Se não responder, sigo com a opção 1 — aplicar exatamente como o documento descreve.