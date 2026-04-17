

The user wants a NEW simplified landing page at `/agendamento` (different from existing `/agendar` and `/agendar-consulta`). Just 3 fields, redirect to WhatsApp after submit. This is a high-converting "quick lead" page for paid traffic.

Key differences from existing pages:
- Only 3 fields (nome, whatsapp, tipo) — no multi-step
- Submits to existing `criar-lead` edge function (already supports these fields)
- Redirects to WhatsApp instead of completing booking flow
- Standalone landing — minimal navigation

GTM is already in `index.html` (GTM-K3C2NNF6 per memory) and Meta Pixel is already loaded globally. I should NOT duplicate pixel init in head — just fire events from the page. Memory rule: "GTM handles all tracking scripts. No direct GA4/Meta Pixel tags."

I'll respect that: use existing GTM/Pixel infrastructure, fire events via dataLayer + fbq.

## Plano: Landing rápida `/agendamento` (3 campos → WhatsApp)

### Objetivo
Landing ultra-otimizada para conversão de tráfego pago. Captura mínima (nome, WhatsApp, tipo de atendimento), salva o lead no banco e redireciona direto para o WhatsApp pré-preenchido.

### Arquivos

**1. `src/pages/Agendamento.tsx`** (novo)
- Hero compacto: "Agende sua Consulta" + "Oftalmologia em Paragominas — Dr. Juliano Machado"
- Formulário com 3 campos:
  1. Nome completo (mín. 3 caracteres)
  2. WhatsApp com máscara `(91) 99999-9999` (mín. 10 dígitos)
  3. Select: Consulta / Retorno / Exame / Cirurgia
- Botão verde grande "Agendar via WhatsApp"
- Validação client-side com mensagens claras
- Ao submeter:
  - `supabase.functions.invoke('criar-lead', { body: { nome_completo, telefone_whatsapp, tipo_atendimento, origem: 'landing_agendamento', local_atendimento: 'A definir', convenio: 'A definir' } })`
  - Dispara eventos via `window.dataLayer.push` (GTM) + `fbq` (Meta Pixel já carregado): `Lead`, `SubmitApplication`, `generate_lead`
  - Redireciona: `https://wa.me/5591936180476?text=...` (com mensagem personalizada)
- 3 cards abaixo: "Atendimento Humanizado", "Convênios Aceitos", "Localização Paragominas"
- Depoimentos estáticos (3 placeholders)
- Footer mínimo: telefone + endereço Clinicor
- `ViewContent` disparado no mount via `useEffect`

**2. `src/App.tsx`** (editar)
- Adicionar rota `<Route path="/agendamento" element={<Agendamento />} />`

### Decisões importantes

- **Não duplicar pixels no `<head>`**: GTM (`GTM-K3C2NNF6`) e Meta Pixel já estão no `index.html`. Vou apenas disparar eventos via `fbq` e `dataLayer` da página — respeitando a regra do projeto de tracking centralizado.
- **`criar-lead` exige `local_atendimento` e `convenio`**: como a landing não pede esses campos, vou enviar `'A definir'` para ambos. A equipe coleta no WhatsApp.
- **Design**: usa as cores do projeto (Navy/Gold dark theme) com accent verde (`#38a169`) apenas no botão principal, conforme pedido do usuário, mantendo consistência visual.
- **Mobile-first**: layout em coluna única, formulário centralizado, max-width estreito.
- **Standalone**: sem `Header`/`Footer` do site principal — apenas logo simples no topo + WhatsApp.

### Layout

```text
┌───────────────────────────────┐
│ Dr. Juliano Machado           │
├───────────────────────────────┤
│  Agende sua Consulta          │
│  Oftalmologia em Paragominas  │
│                               │
│  [Nome completo            ]  │
│  [(91) 99999-9999          ]  │
│  [Tipo: Consulta        ▼ ]  │
│                               │
│  [ AGENDAR VIA WHATSAPP ]     │
├───────────────────────────────┤
│ [Card1] [Card2] [Card3]       │
│ Depoimentos                   │
│ Footer                        │
└───────────────────────────────┘
```

### Resultado
- URL limpa: `/agendamento` para campanhas
- Conversão maximizada (3 campos vs 4 etapas)
- Lead salvo no CRM como "NOVO LEAD" com origem `landing_agendamento`
- Equipe finaliza agendamento via WhatsApp

