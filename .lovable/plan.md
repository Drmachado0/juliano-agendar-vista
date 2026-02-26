
# Corrigir Notificações de Email/WhatsApp via MCP/n8n

## Problema
A edge function `criar-agendamento` usa `(globalThis as any).EdgeRuntime?.waitUntil?.(...)` para disparar notificações em background. Esse objeto nao existe em Supabase Edge Functions (Deno), entao as notificações de email e WhatsApp **nunca sao executadas** quando o agendamento vem via MCP ou n8n.

Pelo site funciona porque o frontend (`/agendar`) dispara as notificações diretamente apos a criaçao.

## Soluçao
Substituir o padrao `EdgeRuntime.waitUntil` por execuçao direta das notificações (fire-and-forget com `.catch()` para nao bloquear a resposta ao cliente).

## Alteraçao

### Arquivo: `supabase/functions/criar-agendamento/index.ts`

Substituir o bloco de notificações (linhas ~168-210) que usa `EdgeRuntime.waitUntil` por:

```typescript
// Fire-and-forget: dispara notificações sem bloquear a resposta
const notifyWhatsApp = supabase.functions.invoke('confirmar-agendamento-whatsapp', {
  body: {
    agendamento_data: {
      nome_completo: sanitizedData.nome_completo,
      telefone_whatsapp: sanitizedData.telefone_whatsapp,
      tipo_atendimento: sanitizedData.tipo_atendimento,
      local_atendimento: sanitizedData.local_atendimento,
      data_agendamento: sanitizedData.data_agendamento,
      hora_agendamento: sanitizedData.hora_agendamento,
      convenio: sanitizedData.convenio,
    }
  },
}).then(() => console.log('[criar-agendamento] WhatsApp notification sent'))
  .catch((err) => console.error('[criar-agendamento] WhatsApp notification failed:', err));

const notifyEmail = supabase.functions.invoke('notificar-agendamento-email', {
  body: {
    nome_completo: sanitizedData.nome_completo,
    telefone_whatsapp: sanitizedData.telefone_whatsapp,
    email_paciente: sanitizedData.email,
    data_nascimento: sanitizedData.data_nascimento,
    tipo_atendimento: sanitizedData.tipo_atendimento,
    detalhe_exame_ou_cirurgia: sanitizedData.detalhe_exame_ou_cirurgia,
    local_atendimento: sanitizedData.local_atendimento,
    convenio: sanitizedData.convenio,
    convenio_outro: sanitizedData.convenio_outro,
    data_agendamento: sanitizedData.data_agendamento,
    hora_agendamento: sanitizedData.hora_agendamento,
  },
}).then(() => console.log('[criar-agendamento] Email notification sent'))
  .catch((err) => console.error('[criar-agendamento] Email notification failed:', err));

// Aguarda ambas sem bloquear o retorno (best-effort)
Promise.allSettled([notifyWhatsApp, notifyEmail]);
```

## Impacto
- Agendamentos criados via MCP (n8n) passarao a enviar email e WhatsApp corretamente
- Agendamentos via site continuam funcionando (frontend ja dispara independentemente)
- Nenhuma alteraçao de schema ou migraçao necessaria
- Apenas 1 arquivo editado
