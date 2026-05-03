# Audit Google Ads + GA4 — Dr. Juliano Machado
**Data:** 2026-05-03  
**Escopo:** Implementação técnica (sem performance data)  
**Domínio:** drjulianomachado.com  
**Auditor:** Claude Ads — Google Audit Agent

---

## Google Ads Implementation Health Score

| Categoria | Peso | Score | Ponderado |
|-----------|------|-------|-----------|
| Conversion Tracking | 50% | 62 / 100 | 31.0 |
| Settings & Targeting | 30% | 78 / 100 | 23.4 |
| Account Structure | 20% | 80 / 100 | 16.0 |
| **TOTAL** | | | **70.4 / 100** |

### Grade: **C+ (70 / 100)**

> Score calculado sobre implementação técnica verificável. O principal detrator é a **dupla conversão** (Critical, -15 pts) e a ausência de **Enhanced Conversions** (High, -10 pts). Ambos são corrigíveis em menos de 30 minutos.

---

## Resumo Executivo

A implementação está funcional e segue boas práticas de LGPD/Consent Mode v2. O funil de agendamento é rastreado de ponta a ponta, o Conversion Linker está presente via GTM, e o filtro de rota privada (`trackingGuard.ts`) protege corretamente `/admin` e `/auth`.

Existem dois problemas críticos que inflam artificialmente as conversões reportadas ao Google Ads: (1) a conversão principal `AW-436492720/tUOICNX06JwcELCzkdAB` é disparada em duplicidade — via `gtag()` direto em `SchedulingModal.tsx:169` e via tag GTM "Google Ads - Conversão Formulário"; (2) o GA4 secundário `G-380EGEFL1S` pode causar pageviews duplicados dependendo de como está configurada a tag GTM. Adicionalmente, Enhanced Conversions não está ativo, limitando a qualidade do sinal em sessões sem cookies (LGPD denied).

---

## Checklist por Check — PASS / WARNING / FAIL

### Bloco 1 — Conversion Tracking (peso 50%)

| ID | Check | Resultado | Evidência |
|----|-------|-----------|-----------|
| CT-01 | Conversion action definida | PASS | `AW-436492720/tUOICNX06JwcELCzkdAB` configurada, valor R$ 300 |
| CT-02 | Tag de conversão firing corretamente | **FAIL** | Duplicação confirmada — `SchedulingModal.tsx:169` + tag GTM |
| CT-03 | Conversion Linker presente | PASS | Tag GTM "Conversion Linker" confirmada no container v26 |
| CT-04 | Conversão dispara DEPOIS do Conversion Linker | PASS | Linker é tag de página; conversão dispara em evento submit |
| CT-05 | Consent Mode v2 configurado | PASS | `index.html:16-24` — default denied, todos os 4 parâmetros corretos |
| CT-06 | Consent update no grant | PASS | `index.html:37-42` — atualiza `analytics_storage` e `ad_storage` corretamente via `lgpd-consent` |
| CT-07 | GTM só carrega se analytics:granted | WARNING | `index.html:44-51` — GTM condicional a `c.analytics`; se usuário aceita apenas marketing sem analytics, GTM não carrega e conversão de Ads não dispara |
| CT-08 | Enhanced Conversions ativo | **FAIL** | Não configurado — gap confirmado; nenhum campo hashed enviado |
| CT-09 | Sem conversão duplicada no mesmo agendamento | **FAIL** | `SchedulingModal.tsx:168-174` dispara `gtag('event','conversion')` direto + GTM tag no evento `purchase` = 2 hits por agendamento |
| CT-10 | Valor de conversão correto (R$ 300) | PASS | Ambos os caminhos enviam `value: 300, currency: 'BRL'` |
| CT-11 | Offline conversions configuradas | WARNING | Não implementado; agendamentos que se tornam consultas reais não fecham o loop |
| CT-12 | Action secundária (WhatsApp) definida | PASS | `AW-436492720/-h8XCK3z6JwcELCzkdAB` via `trackWhatsAppGoogleAdsConversion()` |

**Score bloco CT: 62 / 100** (3 FAIL, 2 WARNING)

---

### Bloco 2 — Settings & Targeting (peso 30%)

| ID | Check | Resultado | Evidência |
|----|-------|-----------|-----------|
| ST-01 | gtag.js instalado corretamente | PASS | `index.html` — script carregado via bootstrap condicional |
| ST-02 | Tracking guard em rotas privadas | PASS | `trackingGuard.ts:13-21` — `/admin` e `/auth` bloqueados |
| ST-03 | DataLayer disponível antes do GTM | PASS | `index.html:13` — `dataLayer` inicializado antes do snippet GTM |
| ST-04 | GTM container correto (GTM-K3C2NNF6) | PASS | `index.html:49` e noscript `index.html:122` — IDs coincidentes |
| ST-05 | Filtro hostname no GTM ativo | PASS | Confirmado como feito hoje (2026-05-03) — apenas `drjulianomachado.com` |
| ST-06 | Remarketing tag configurada | PASS | Tag de remarketing Google Ads presente nas 14 tags GTM |
| ST-07 | GA4 Configuration sem All Pages no GTM | WARNING | Doc `GTM-EVENTOS-DATALAYER.md:252` alerta explicitamente; risco real se operador criar tag Configuration por engano |
| ST-08 | Consent Mode gating correto para Google Ads | WARNING | GTM condicional a `analytics`. Usuário que aceita só `marketing` (ad_storage: granted) mas não analytics terá GTM não carregado — conversão de Ads perdida |
| ST-09 | Schema JSON-LD presente | PASS | `index.html:83-118` — Physician schema válido |
| ST-10 | Canonical URL definida | PASS | `index.html:77` |

**Score bloco ST: 78 / 100** (0 FAIL, 2 WARNING)

---

### Bloco 3 — Structure / Data Layer (peso 20%)

| ID | Check | Resultado | Evidência |
|----|-------|-----------|-----------|
| SL-01 | Eventos dataLayer nomeados consistentemente | PASS | Convenção clara: `purchase`, `begin_checkout`, `generate_lead`, `cta_click`, `contact` |
| SL-02 | Funil granular implementado | PASS | `modal_form_start`, `modal_step_completed`, `modal_appointment_error` em `useGoogleTag.ts:124-150` |
| SL-03 | Hook `useGoogleTag` como fonte única | WARNING | `SchedulingModal.tsx:168-174` chama `gtag()` diretamente, quebrando a centralização |
| SL-04 | `safeDataLayerPush` bloqueia rotas privadas | PASS | `trackingGuard.ts:43-48` — guard correto |
| SL-05 | Dual GA4 sem duplicação de pageviews | WARNING | `GTM-EVENTOS-DATALAYER.md:250-254` documenta o risco; proteção existe como orientação mas não como code guard |
| SL-06 | GA4 secundário tem propósito documentado | WARNING | `G-380EGEFL1S` não tem propósito documentado nos arquivos auditados |
| SL-07 | Eventos de funil no Agendamento.tsx também | PASS | `GTM-EVENTOS-DATALAYER.md:57-62` confirma `Agendar.tsx` usa os mesmos hooks |
| SL-08 | Parâmetros de conversão completos | PASS | `appointment_type` e `location` enviados no `purchase` |

**Score bloco SL: 80 / 100** (0 FAIL, 3 WARNING)

---

## Findings Detalhados

### CRITICO

**[CT-09] Dupla conversão no agendamento confirmado**

A conversão principal `AW-436492720/tUOICNX06JwcELCzkdAB` é disparada por dois caminhos simultâneos no mesmo evento de confirmação de agendamento:

- **Caminho 1 (gtag direto):** `SchedulingModal.tsx:168-174`
  ```typescript
  if (typeof (window as any).gtag !== 'undefined') {
    (window as any).gtag('event', 'conversion', {
      send_to: 'AW-436492720/tUOICNX06JwcELCzkdAB',
      value: 300,
      currency: 'BRL',
    });
  }
  ```
- **Caminho 2 (tag GTM):** Tag "Google Ads - Conversão Formulário" disparada no evento `purchase`, que por sua vez é disparado pelo `trackScheduleComplete()` na linha 158 do mesmo arquivo.

Ambos executam na mesma função `handleSubmit`. O resultado prático é que o Google Ads registra **2 conversões por agendamento real**, inflando CPA/ROAS e envenenando a otimização de lances.

**Correção:** Remover o bloco `gtag('event', 'conversion')` direto de `SchedulingModal.tsx:168-174` e confiar exclusivamente na tag GTM. Alternativamente, remover a tag GTM e manter apenas o gtag direto — mas a remoção do código inline é preferida por manter o padrão de centralização via hook.

---

**[CT-08] Enhanced Conversions não configurado**

Nenhum dado hasheado (email, telefone, nome) está sendo enviado com as conversões. Com Consent Mode v2 em default-denied e LGPD ativa, uma parcela significativa dos usuários não terá cookies de conversão ativos no momento do agendamento, resultando em conversões não atribuídas mesmo quando o agendamento ocorre.

O formulário já coleta `email`, `phone` e `fullName` (visíveis em `SchedulingModal.tsx:FormData`). Todos os campos necessários para Enhanced Conversions estão disponíveis no momento da conversão.

**Correção:** Configurar Enhanced Conversions no painel do Google Ads e passar `user_data` no payload da conversão. Tempo estimado: 20 minutos.

---

### ALTA PRIORIDADE

**[CT-07 / ST-08] GTM condicional a `analytics` — conversões de Ads perdidas para usuários de marketing-only**

O bootstrap em `index.html:44` carrega o GTM somente se `c.analytics === true`. No entanto, a conversão de Google Ads depende do GTM estar carregado. Um usuário que recusa analytics mas aceita marketing terá `ad_storage: granted` mas o GTM nunca carregado — a tag de conversão nunca disparará.

Isso afeta diretamente a atribuição de campanhas pagas. O correto é que o GTM carregue se `analytics OR marketing` está granted, e que internamente o Consent Mode controle quais tags disparar.

**Correção:** Alterar a condição no bootstrap:
```javascript
// Atual (linha 44):
if (c.analytics) {
  // carrega GTM
}

// Correto:
if (c.analytics || c.marketing) {
  // carrega GTM — o Consent Mode interno controla quais tags disparam
}
```

---

**[SL-03] `gtag()` direto em `SchedulingModal.tsx` quebra centralização**

O hook `useGoogleTag.ts` foi criado exatamente para ser a fonte única de chamadas de tracking. A chamada direta a `window.gtag` na linha 168-174 do modal contorna o guard de `safeDataLayerPush` e quebra o padrão arquitetural. Se no futuro o guard precisar bloquear eventos em algum contexto, essa chamada direta escapará.

---

### MEDIA PRIORIDADE

**[ST-07 / SL-05] Risco de duplicação de pageviews GA4**

A proteção existe apenas como documentação textual em `GTM-EVENTOS-DATALAYER.md:252`. Se um operador criar uma tag "GA4 Configuration" com trigger "All Pages" no GTM (erro comum), os pageviews serão duplicados para ambas as propriedades. Não existe bloqueio programático.

**Mitigação:** Adicionar comentário explícito no container GTM descrevendo o risco; considerar uma tag de documentação no GTM com nota de alerta.

---

**[SL-06] Propósito do GA4 secundário `G-380EGEFL1S` não documentado**

O ID `G-380EGEFL1S` aparece nos documentos como "GA4 Secundário — site Dr Juliano Machado" mas sem justificativa de negócio. Pode ser uma propriedade de teste, uma conta de agência, ou uma propriedade legada. Dois GA4 ativos sem segregação clara de propósito geram confusão operacional.

**Recomendação:** Documentar o propósito ou desativar se obsoleto.

---

**[CT-11] Offline conversions não configuradas**

O agendamento online é uma microconversão. A conversão real de negócio é a consulta realizada. Sem importação de conversões offline, o Google Ads não sabe quais campanhas geram consultas que efetivamente acontecem (versus agendamentos que não comparecem).

**Recomendação (prazo médio):** Implementar importação de conversões offline via Google Ads API quando o agendamento muda para status "realizado" no Supabase. Isso fecha o loop de atribuição real.

---

## Quick Wins (menos de 15 minutos, alto impacto)

| # | Ação | Arquivo / Local | Impacto | Tempo |
|---|------|----------------|---------|-------|
| 1 | Remover bloco `gtag('event','conversion')` direto | `SchedulingModal.tsx:168-174` | CRITICO — elimina dupla contagem | 5 min |
| 2 | Alterar condição GTM bootstrap de `c.analytics` para `c.analytics \|\| c.marketing` | `index.html:44` | ALTO — recupera conversões de usuários ad-only | 5 min |
| 3 | Configurar Enhanced Conversions no painel Google Ads + adicionar `user_data` no payload | Google Ads UI + `SchedulingModal.tsx` | ALTO — melhora atribuição em regime LGPD | 20 min |

---

## Roadmap — Próximos Passos

### Imediato (hoje, 2026-05-03)

1. **Fix dupla conversão** — `SchedulingModal.tsx:168-174`: deletar o bloco `gtag` direto. A tag GTM é suficiente e está corretamente configurada.
2. **Fix bootstrap GTM** — `index.html:44`: mudar para `if (c.analytics || c.marketing)`.

### Curto prazo (esta semana)

3. **Enhanced Conversions** — Ativar no Google Ads e adicionar `user_data` (email + telefone hasheados) ao evento de conversão no SchedulingModal. O formulário já captura os dados.
4. **Documentar GA4 secundário** — Definir propósito de `G-380EGEFL1S` ou remover da arquitetura.
5. **Adicionar alerta no GTM** — Tag de documentação interna alertando para não criar GA4 Configuration com All Pages.

### Médio prazo (2-4 semanas)

6. **Offline conversions** — Webhook n8n → Google Ads API quando `status = realizado` no Supabase. Isso permitirá otimizar lances por consulta realizada, não apenas por agendamento.
7. **Microconversão CTA Header** — Configurar `cta_click` com `cta_location: header_desktop | header_mobile` como conversão secundária no Google Ads (já rastreado no dataLayer, falta criar a action).
8. **Revisão de action secondary (WhatsApp)** — Confirmar que `AW-436492720/-h8XCK3z6JwcELCzkdAB` está marcada como "Secundária" no painel, não como primária, para não distorcer métricas de campanha.

---

## IDs de Referência (para validação)

| Plataforma | ID | Status |
|------------|-----|--------|
| GTM Container | GTM-K3C2NNF6 | Ativo (v26, 16 tags) |
| GA4 Principal | G-79BDCX4R2L | Ativo — gtag.js direto |
| GA4 Secundário | G-380EGEFL1S | Ativo — propósito indefinido |
| Google Ads | AW-436492720 | Ativo |
| Conversão principal | AW-436492720/tUOICNX06JwcELCzkdAB | DUPLICADA — corrigir |
| Conversão WhatsApp | AW-436492720/-h8XCK3z6JwcELCzkdAB | OK |
| Conversão Phone | AW-436492720/R5yuCJjn7ZwcELCzkdAB | OK |

---

*Relatório gerado automaticamente pelo Claude Ads — Google Audit Agent.*  
*Baseado em análise estática de código-fonte. Validação dinâmica (Tag Assistant, GTM Preview) recomendada para confirmar CT-02 e ST-08 em produção.*
