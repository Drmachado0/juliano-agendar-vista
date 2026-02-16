

# Atualizar N8N_WEBHOOK_URL

## O que sera feito

Atualizar o secret `N8N_WEBHOOK_URL` para apontar para o novo webhook:

| Secret | Valor Atual | Novo Valor |
|--------|------------|------------|
| `N8N_WEBHOOK_URL` | (valor antigo em juliano-n8n) | `https://drmachado-n8n.cloudfy.live/webhook/agendamento-notificacao` |

## Passos

1. Atualizar o secret `N8N_WEBHOOK_URL` usando a ferramenta de secrets
2. Testar chamando a edge function `notificar-n8n` para confirmar que o novo endpoint responde

## Detalhes tecnicos

- Apenas 1 secret precisa ser atualizado
- Nenhuma alteracao de codigo -- a edge function `notificar-n8n` ja le o valor dinamicamente via `Deno.env.get("N8N_WEBHOOK_URL")`
- As URLs hardcoded no frontend (`/webhook/confirmacao` e `/webhook/avaliacao-google-lovable`) nao serao alteradas conforme solicitado

