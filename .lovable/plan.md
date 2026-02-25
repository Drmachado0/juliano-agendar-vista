

## Fix: Email e WhatsApp de confirmacao nao sao enviados no fluxo /agendar

### Causa raiz

O fluxo da pagina `/agendar` usa dois passos:
1. `criar-lead` -- cria o registro no banco SEM data/hora, SEM notificacoes
2. `converterLeadEmAgendamento` -- faz UPDATE no registro com data/hora, mas NAO dispara notificacoes

A edge function `criar-agendamento` (que envia email + WhatsApp) nao e usada neste fluxo. Entao, apos o agendamento ser confirmado, nenhuma notificacao e enviada.

### Solucao

Adicionar chamadas para as edge functions `confirmar-agendamento-whatsapp` e `notificar-agendamento-email` no `handleSubmit` da pagina `Agendar.tsx`, logo apos a conversao bem-sucedida do lead.

### Mudancas

**Arquivo: `src/pages/Agendar.tsx`**

Apos a linha que chama `notificarN8n` (dentro do bloco `if (leadId)` apos a conversao com sucesso), adicionar duas chamadas em paralelo:

1. Chamar `confirmar-agendamento-whatsapp` passando os dados do agendamento
2. Chamar `notificar-agendamento-email` passando os dados do agendamento

Ambas chamadas serao feitas com `Promise.allSettled` para nao bloquear o fluxo caso uma falhe -- o usuario ja vera a tela de sucesso independentemente.

### Detalhe tecnico

No `handleSubmit`, apos `notificarN8n`, adicionar:

```typescript
// Disparar notificacoes em background (nao bloqueia o fluxo)
Promise.allSettled([
  supabase.functions.invoke('confirmar-agendamento-whatsapp', {
    body: {
      agendamento_data: {
        nome_completo: formData.fullName,
        telefone_whatsapp: formData.phone,
        tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
        local_atendimento: localAtendimento,
        data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
        hora_agendamento: formData.selectedTime,
        convenio: formData.insuranceName || formData.insurance,
      }
    },
  }),
  supabase.functions.invoke('notificar-agendamento-email', {
    body: {
      nome_completo: formData.fullName,
      telefone_whatsapp: formData.phone,
      email_paciente: formData.email || null,
      data_nascimento: formData.birthDate || null,
      tipo_atendimento: formData.appointmentTypeName || formData.appointmentType,
      local_atendimento: localAtendimento,
      convenio: formData.insuranceName || formData.insurance,
      convenio_outro: formData.insurance === 'outro' ? formData.otherInsurance : null,
      data_agendamento: formData.selectedDate ? format(formData.selectedDate, 'yyyy-MM-dd') : '',
      hora_agendamento: formData.selectedTime,
    },
  }),
]).then(results => {
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Notificacao ${i} falhou:`, r.reason);
    }
  });
});
```

Tambem sera necessario adicionar o import do `supabase` client no topo do arquivo:
```typescript
import { supabase } from "@/integrations/supabase/client";
```

Nenhuma outra mudanca necessaria. Apenas 1 arquivo modificado.
