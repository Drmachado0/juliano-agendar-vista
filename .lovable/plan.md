
The user wants the `/agendamento` page (the dedicated landing we just created) to use the EXACT same multi-step form shown in the image — which is the 4-step form from `/agendar` (Dados → Consulta → Data → Confirmar with the StepIndicator).

Currently `/agendamento` has only 3 fields + WhatsApp redirect. The user wants to replace that simplified form with the full 4-step booking form, keeping the dedicated landing structure (proof points, no main site nav, optimized for tracking).

## Plano: Substituir formulário simplificado da `/agendamento` pelo multi-step completo

### Mudança
Trocar o formulário de 3 campos por exatamente o mesmo fluxo multi-step de 4 etapas usado em `/agendar` (Dados pessoais → Consulta → Data/Hora → Confirmação → Sucesso).

### Arquivo único editado: `src/pages/Agendamento.tsx`

Reusar os componentes existentes:
- `StepIndicator`
- `PersonalDataStep`
- `ConsultationDetailsStep`
- `DateTimeStep`
- `ConfirmationStep`
- `SuccessStep`

Lógica de submissão idêntica à de `/agendar`:
- Step 2 → 3: cria lead via `criarLead`
- Step 4 (Confirmar): converte lead em agendamento via `converterLeadEmAgendamento`
- Dispara `confirmar-agendamento-whatsapp` + `notificar-agendamento-email` (Promise.allSettled, timeout 8s)
- Notifica n8n
- Redireciona para `/obrigado`

### O que MANTÉM da landing dedicada atual
- Header minimalista (logo Dr. Juliano + WhatsApp, sem nav do site principal)
- Hero "Agende sua Consulta" com proof points (13+ anos, 6.000+ pacientes, ⭐ 4.9)
- Cards de confiança (Atendimento Humanizado, Convênios, Localização)
- Footer mínimo
- Captura de UTMs em sessionStorage no mount
- Tracking aprimorado:
  - `ViewContent` no mount (Meta Pixel)
  - `lp_step_view` ao entrar em cada etapa
  - `lp_lead_generated` ao criar lead
  - `lp_appointment_scheduled` ao confirmar
  - Google Ads conversion no submit final
  - `generate_lead` no dataLayer

### O que REMOVE
- Formulário inline de 3 campos
- Redirecionamento direto para wa.me após submit
- Select de tipo de atendimento isolado

### Layout final

```text
┌──────────────────────────────────────┐
│ Dr. Juliano Machado    [WhatsApp]    │
├──────────────────────────────────────┤
│  Agende sua Consulta                 │
│  Oftalmologia · Paragominas e Belém  │
│  ⭐ 4.9  ✓ 13+ anos  ✓ 6.000+ pac.   │
├──────────────────────────────────────┤
│  [1]──[2]──[3]──[4]                  │
│  Dados Consulta Data Confirmar       │
│                                      │
│  [Etapa atual renderizada aqui]      │
│                                      │
│  [Voltar]            [Avançar]       │
├──────────────────────────────────────┤
│ [Humanizado][Convênios][Localização] │
│ Footer                               │
└──────────────────────────────────────┘
```

### Resultado
- URL `/agendamento` mantém o mesmo formulário completo de 4 etapas que o paciente já conhece
- Visual da landing dedicada preservado (proof points, sem distração de menu)
- Tracking granular por etapa funcionando
- Mesma experiência de booking de `/agendar`, em página otimizada para campanhas
