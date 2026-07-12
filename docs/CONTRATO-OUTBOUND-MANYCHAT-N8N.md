# Contrato — registrar-envio-out-n8n (ManyChat via n8n)

Revisado 2026-07-12.

Endpoint canônico chamado pelo **n8n** logo após o **sucesso** do
`sendFlow` do ManyChat e **antes** de qualquer tracker/analítica.
Substitui o legado `n8n-registrar-envio`, que segue funcionando por
compatibilidade mas deve ser migrado.

## URL
`POST /functions/v1/registrar-envio-out-n8n`

## Autenticação
Header obrigatório `x-n8n-secret: <N8N_SHARED_SECRET>`.
Verificação timing-safe via `requireN8nSecret` (Vault + fallback env).
Também aceita `Authorization: Bearer <secret>`.

## Cabeçalhos recomendados
- `x-request-id: <uuid>` — propagado no response e nos logs.
- `Content-Type: application/json`.

## Body (JSON)

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `telefone` | string | sim | E.164 ou dígitos; normalizado via `normalizar_telefone`. |
| `agendamento_id` | uuid | não | Se ausente, tentamos match único por `telefone_canonico`. |
| `conteudo` | string | não | Texto enviado. Placeholder aplicado se vazio. |
| `tipo_mensagem` | string | não | Default `bot_agente`. Use `confirmacao_automatica` **apenas** para lembretes que devem mover o funil. |
| `canal` / `provider` | string | não | Default `manychat`. |
| `provider_message_id` | string | não* | *Recomendado. Chave de idempotência junto com `provider`. |
| `subscriber_id` | string | não | Assinante ManyChat. |
| `flow_ns` | string | não | Namespace/ID do flow enviado. |
| `status` | enum | não | `solicitado \| enviado \| entregue \| lido \| erro`. Default `enviado`. |
| `origem` | string | não | Rótulo livre (`n8n_manychat`, …). |
| `request_id` | string | não | Correlação (se não vier em header). |
| `erro` | string | não | Preencha quando `status="erro"`. |

## Regras críticas

1. **Idempotência**: se já existe linha com o mesmo
   `(provider, provider_message_id)`, retorna
   `{ ok: true, duplicada: true, ... }` sem nova inserção.
2. **Vinculação**: só associamos ao agendamento quando há
   exatamente **um** match por `telefone_canonico`. Ambíguo →
   `agendamento_id=null`, `ambiguo=true`.
3. **Confirmation status**: apenas `tipo_mensagem ∈ {
   confirmacao_automatica, confirmacao_consulta }` e `status ≠ erro`
   podem alterar `confirmation_*` do agendamento. Mensagens do bot,
   manuais ou boas-vindas **nunca** movem o funil.
4. **Status `erro`**: registra o OUT com `status_envio="erro"` e não
   atualiza confirmação.

## Response 200
```json
{
  "ok": true,
  "mensagem_id": "uuid",
  "agendamento_id": "uuid | null",
  "ambiguo": false,
  "duplicada": false
}
```

## Response 401
```json
{ "error": "Unauthorized", "reason": "invalid_n8n_secret" }
```

## Onde colocar o nó no n8n

```
message.received
  → registrar-mensagem-in-n8n
  → Secretaria (GPT-4.1 no n8n)
  → ManyChat setCustomFieldByName
  → ManyChat sendFlow   ← precisa sucesso
  → registrar-envio-out-n8n   ← ESTE NÓ
  → n8n_followups / tracker
```

Se `sendFlow` falhar, chamar mesmo assim com `status="erro"` e `erro`
preenchido; assim o Kanban registra o OUT tentado.

## Migração do legado

O endpoint `n8n-registrar-envio` agora aplica as mesmas regras
(idempotência, guarda de confirmation_status). Novos flows devem
usar `registrar-envio-out-n8n` diretamente e enviar `provider_message_id`.
