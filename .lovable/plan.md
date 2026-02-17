
# Corrigir configuracao do Webhook Evolution API (erro 404)

## Problema
O botao "Configurar Webhook Agora" falha com erro 404: `Cannot PUT /webhook/set/n8n`. A Evolution API v2 usa o metodo **POST** para configurar webhooks, nao PUT.

Alem disso, o endpoint de verificacao (`GET /webhook/find/n8n`) retorna `null`, indicando que tambem pode precisar de ajuste.

## Solucao

### Alterar `supabase/functions/configurar-webhook-evolution/index.ts`

1. **Acao "set"**: Trocar o metodo HTTP de `PUT` para `POST` na chamada para `/webhook/set/{instance}`
2. **Adicionar campo `enabled: true`** no body da requisicao (exigido pela Evolution API v2)
3. **Acao "status"**: Ajustar o endpoint de busca para tambem tentar `POST /webhook/find/{instance}` caso o GET falhe, e melhorar o parsing da resposta

### Detalhes tecnicos

Antes (com erro):
```
PUT /webhook/set/n8n  -> 404 Not Found
```

Depois (corrigido):
```
POST /webhook/set/n8n  -> 200 OK
```

Body atualizado:
```json
{
  "enabled": true,
  "url": "https://...supabase.co/functions/v1/receber-whatsapp",
  "webhook_by_events": false,
  "webhook_base64": false,
  "events": ["MESSAGES_UPSERT"]
}
```

### Arquivo afetado
- `supabase/functions/configurar-webhook-evolution/index.ts` (unica alteracao)
