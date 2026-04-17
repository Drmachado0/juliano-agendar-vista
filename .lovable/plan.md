
The user wants a dedicated page for appointment scheduling to improve tracking and conversions. Looking at the codebase, I can see there's already a `/agendar` route with `Agendar.tsx` that uses the same form structure. Let me check if this is what they want or if they want a NEW separate page.

Looking again: `src/pages/Agendar.tsx` already exists at `/agendar` with the full multi-step form. The user might want either:
1. A new landing page variant optimized for ads (e.g. `/agendar-consulta` with stronger conversion elements)
2. Improvements to the existing page

Given the request "criar uma pagina dedicada" (create a dedicated page), they likely want a new conversion-optimized variant separate from the existing one — typically used for paid traffic (Google Ads, Meta Ads) where you want a clean landing page without the main site header/distractions, plus enhanced tracking.

I'll propose creating a new `/agendar-consulta` landing page variant optimized for paid traffic conversion.

## Plano: Landing page dedicada de agendamento para tracking e conversão

### Nova rota: `/agendar-consulta`

Página otimizada para tráfego pago (Google Ads / Meta Ads) e conversão, mantendo o mesmo formulário multi-step de 4 etapas do `/agendar` atual.

### Diferenças vs `/agendar` atual

| Aspecto | `/agendar` (atual) | `/agendar-consulta` (novo) |
|---|---|---|
| Header | Link "Voltar ao site" | Sem header de navegação (sem escape) |
| Hero | Título simples | Hero com proof points (13+ anos, 6.000+ pacientes, ⭐ 4.9) |
| Trust signals | Nenhum | Selos de convênios, foto do Dr., depoimento curto |
| Tracking | Eventos básicos | Eventos granulares por etapa + UTM capture |
| Footer | Texto curto | Garantias + WhatsApp direto |

### Arquivos a criar/editar

**1. `src/pages/AgendarConsulta.tsx`** (novo)
- Reutiliza `PersonalDataStep`, `ConsultationDetailsStep`, `DateTimeStep`, `ConfirmationStep`, `SuccessStep`, `StepIndicator`
- Mesma lógica de submissão do `Agendar.tsx` (criar lead → converter agendamento → notificar WhatsApp/email)
- Layout em 2 colunas no desktop: formulário à esquerda, prova social à direita
- Mobile: prova social vira banner superior compacto
- Captura de UTM (`utm_source`, `utm_medium`, `utm_campaign`, `gclid`, `fbclid`) via URLSearchParams e armazena em sessionStorage para enviar com o lead

**2. `src/App.tsx`** (editar)
- Adicionar rota `<Route path="/agendar-consulta" element={<AgendarConsulta />} />`

**3. Tracking aprimorado** (dentro do novo arquivo)
- `page_view` customizado com `page_type: 'landing_conversao'`
- `step_view` ao entrar em cada etapa (1, 2, 3, 4)
- `step_complete` ao avançar
- `form_abandon` via `beforeunload` se não chegou no step 4
- `lead_generated` ao criar lead (step 2 → 3)
- `appointment_scheduled` ao confirmar (step 4)
- Todos os eventos enviados via dataLayer (GTM-K3C2NNF6) + Meta Pixel + Google Ads conversion

### Layout visual

```text
┌──────────────────────────────────────────────────┐
│ [Logo Dr. Juliano]            [📱 WhatsApp]      │
├─────────────────────────┬────────────────────────┤
│  AGENDE SUA CONSULTA    │  ⭐ 4.9 (200+ avaliações)│
│  Oftalmologista         │  ✓ 13+ anos experiência │
│  Paragominas e Belém    │  ✓ 6.000+ pacientes     │
│                         │  ✓ Convênios aceitos    │
│  [Form multi-step]      │                         │
│  [Step indicator]       │  [Foto Dr. Juliano]     │
│  [Etapa atual]          │                         │
│                         │  "Atendimento excelente"│
│                         │  — Maria S.             │
└─────────────────────────┴────────────────────────┘
│      Atendimento humanizado · Resposta em até 1h │
└──────────────────────────────────────────────────┘
```

### Resultado
- URL limpa para campanhas: `drjulianomachado.com/agendar-consulta?utm_source=google`
- Sem distrações de navegação → maior taxa de conversão
- Tracking granular por etapa para otimizar funil
- Prova social visível durante todo o preenchimento
- UTMs preservadas até a submissão final

