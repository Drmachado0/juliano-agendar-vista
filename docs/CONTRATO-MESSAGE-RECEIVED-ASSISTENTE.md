# Contrato de integração: `message.received` → `assistente-pre-agendamento`

**Revisado em:** 2026-07-12

## Fluxo real (o que roda hoje)

1. WhatsApp → **n8n** (webhook Evolution API).
2. n8n → `POST https://<projeto>.supabase.co/functions/v1/registrar-mensagem-in-n8n`
   - Header obrigatório: `x-n8n-secret: $N8N_SHARED_SECRET`
   - Também aceita: `x-mcp-secret`, `x-api-key`, `apikey` ou `Authorization: Bearer <secret>`
   - Body:
     ```json
     {
       "telefone": "+5591…",
       "conteudo": "texto",
       "mensagem_externa_id": "wamid.xxxx",   // idempotência forte (UNIQUE parcial no banco)
       "tipo_mensagem": "whatsapp",
       "nome_contato": "opcional",
       "payload": { "…dados brutos Evolution…": true }
     }
     ```
   - Resposta:
     ```json
     {
       "ok": true,
       "mensagem_id": "uuid",
       "agendamento_id": "uuid|null",
       "lead_criado": true,
       "ambiguo": false,
       "total_matches": 1,
       "duplicada": false,
       "request_id": "uuid"
     }
     ```
   - Casos possíveis do vínculo (via RPC `vincular_mensagem_por_telefone` + `pg_advisory_xact_lock`):
     - `total_matches = 0` → cria lead novo (`lead_criado=true`).
     - `total_matches = 1` → vincula.
     - `total_matches > 1` → **NÃO vincula** (`ambiguo=true`, `agendamento_id=null`). Fica órfã e aparece no admin (`/admin/saude-integracoes`) para revisão manual.

3. **A ativação do assistente é RESPONSABILIDADE DO n8n** — o gatilho é externo.
   O n8n deve, logo após ingerir a mensagem, chamar:
   ```
   POST https://<projeto>.supabase.co/functions/v1/assistente-pre-agendamento
   Headers:
     x-n8n-secret: $N8N_SHARED_SECRET
     x-request-id: <mesmo id vindo do passo anterior>
   Body:
   {
     "telefone": "+5591…",
     "conteudo": "texto",
     "agendamento_id": "uuid|null",
     "mensagem_id": "uuid da mensagens_whatsapp"    // idempotência
   }
   ```
   - Se `mensagem_id` já foi processado (index `UNIQUE` parcial em `conversation_intents.mensagem_id`), o endpoint retorna a intent existente sem reprocessar (`duplicada:true`).
   - Se o classificador (Lovable AI) falhar, o endpoint **NÃO** deixa o card no bot: escala para `PRECISA_DE_HUMANO` (`bot_ativo=false`) e retorna `ok:false, agiu:false, escalado:"classificador_falhou"`.
   - Se o envio OUT via Evolution falhar, **NÃO** avança status/agendamento: escala para humano e retorna `agiu:false, escalado:"envio_falhou"`.

## Passo manual pendente (fora deste repositório)

- **Confirmar no workflow n8n** que existe o nó HTTP Request para
  `assistente-pre-agendamento` disparando após `registrar-mensagem-in-n8n`,
  com o header `x-n8n-secret`. Sem esse nó, o bot NÃO age.
- **Rotacionar `N8N_SHARED_SECRET`** via `/admin/integracoes` (RPC `rotacionar_secret_integracao`) sempre que houver suspeita de vazamento — os edge functions leem do vault com cache de 60s.
- **Não afirmamos** que o assistente está automaticamente ativo apenas por essa migração — depende do workflow n8n publicado.

## Trigger no banco (`trg_mensagens_whatsapp_emit_message_received`)

- Existe um trigger que emite `crm_emit_event('message.received', …)` para os
  `crm_webhook_endpoints`. Isso é o que aciona o n8n. Se `crm_webhook_endpoints`
  não tiver endpoint ativo para `message.received`, o evento é ignorado
  (log em `system_logs`).
- Para validar: `SELECT * FROM crm_webhook_endpoints WHERE event='message.received';`
