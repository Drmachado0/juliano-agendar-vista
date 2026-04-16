

## Plano: Corrigir envio de e-mail e WhatsApp de confirmação

### Diagnóstico

Investiguei o banco de dados e os logs das edge functions. O agendamento de teste mais recente (16/04 23:06, "Teste") foi convertido com sucesso, mas:

1. **Não há nenhuma mensagem WhatsApp gravada** para esse `agendamento_id` na tabela `mensagens_whatsapp`.
2. **Não há logs** das funções `confirmar-agendamento-whatsapp` nem `notificar-agendamento-email` nesse horário — só do `notificar-n8n` e do `converter-lead-agendamento`.

Isso significa que essas duas edge functions **nem chegam a ser invocadas**.

### Causa raiz

No `src/pages/Agendar.tsx` (linhas 162–223), o fluxo é:
```
Promise.allSettled([invoke(whatsapp), invoke(email)])  // sem await
...
window.location.href = '/obrigado'  // navega na hora
```

Como o `Promise.allSettled` não tem `await`, os dois `fetch` ficam pendentes. Quando `window.location.href` muda a página logo em seguida, o navegador **cancela todos os fetches em vôo** — por isso as edge functions nunca recebem a chamada.

A função `criar-agendamento` (usada pelo modal antigo) também tem o mesmo padrão fire-and-forget, mas como roda **dentro da edge function** (server-to-server), funciona. No `/agendar` o disparo é do navegador, então é cancelado.

### Correção

**Arquivo: `src/pages/Agendar.tsx`** (linhas 152–223)

1. Mover o disparo das notificações (WhatsApp + e-mail + n8n) para **dentro de uma edge function**, ou
2. **Aguardar** as notificações terminarem antes de navegar para `/obrigado`.

Vou usar a opção 2 (mais simples e segura), com timeout de segurança:

- Usar `await Promise.allSettled([...])` antes do redirect.
- Adicionar um `Promise.race` com timeout de 8s para não travar a UX caso a Evolution API esteja lenta.
- Mostrar um toast "Agendamento confirmado!" antes do redirect.
- Logar no console o resultado de cada notificação para debug futuro.

**Arquivo: `supabase/functions/notificar-agendamento-email/index.ts`** — Verificar comportamento

- O `from` está como `onboarding@resend.dev` (sandbox do Resend). Esse remetente só consegue entregar para o e-mail dono da conta Resend. Como o destino é `julianosmachado@gmail.com`, deve funcionar **se for o mesmo e-mail registrado na conta Resend**. Vou adicionar um log claro do `emailResponse.id` para confirmar entrega.
- Sem mudanças funcionais aqui — só log adicional se necessário.

### Resultado esperado

Após o fix:
- Ao confirmar agendamento em `/agendar`, o frontend aguarda o WhatsApp + e-mail serem disparados (até 8s).
- A mensagem WhatsApp chega no telefone do paciente.
- O e-mail chega em `julianosmachado@gmail.com`.
- Só depois o usuário é redirecionado para `/obrigado`.
- Se algo falhar, o erro aparece no console mas o agendamento (já salvo) não é perdido.

