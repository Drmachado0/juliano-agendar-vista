
# Auditoria da mensageria e plano de migração para ManyChat + n8n

Análise **somente leitura**. Nada foi editado, deployado ou publicado. Não presumo nós existentes nos painéis ManyChat/n8n (autenticados).

## 1. Estado atual do envio

O "helper legado" `_shared/evolutionApiClient.ts` **já não fala com a Evolution API**: é um shim que re-exporta `sendWhatsappTextMessage` / `sendWhatsappImageMessage` chamando `_shared/whatsappSender.ts`, que dispara para o webhook n8n (`N8N_WHATSAPP_WEBHOOK_URL`, header `X-Webhook-Secret`). O envio direto Evolution/Z-API está neutralizado no runtime.

O problema real é **arquitetural e semântico**:
- Nome "Evolution" ainda em imports/logs induz erro de leitura e permite regressão.
- Várias Edge Functions escrevem `status_envio` (`enviado|entregue|lido|erro`) e avançam funil (`AGUARDANDO`, `confirmacao_enviada=true`, `confirmation_status='aguardando_confirmacao'`) **antes** do ManyChat confirmar. O único fato é "n8n aceitou o payload".

### Edge Functions que ainda "enviam"

| Função | Papel hoje | Risco |
|---|---|---|
| `enviar-whatsapp` | Envio manual admin (texto/imagem) | Duplica caminho vs flow ManyChat. |
| `enviar-whatsapp-queue` | Fila em lote | Concorre com throttling/janela 24h ManyChat. |
| `enviar-whatsapp-imagem` | Imagem manual | Idem; ManyChat trata mídia no flow. |
| `enviar-boas-vindas-lead` (cron `*/5`) | Boas-vindas | Duplicidade se ManyChat responder `message.received`. |
| `retentar-boas-vindas-pendentes` (cron `*/10`) | Retry por status inferido | Reenvia sem ACK real → duplicidade. |
| `enviar-confirmacao-whatsapp` (cron 12:00) | Confirmação 24h | Avança status sem entrega confirmada. |
| `lembrete-consulta-whatsapp` (cron 09:00) | Lembrete véspera | Templates duplicados vs ManyChat. |
| `assistente-pre-agendamento` | Classifica + responde | Envia sugestão + n8n pode responder = duas mensagens. |
| `lembretes-runner` | Campanha anual via `manychat.ts` direto | Segundo canal oficial coexistindo com n8n. |
| `verificar-numeros-whatsapp` | phone-exists via n8n | ManyChat não expõe; contrato precisa doc. |
| `whatsapp-status` / `zapi-status` | Diagnóstico | `zapi-status` é vestígio morto. |

### Helpers
- `_shared/whatsappSender.ts` → dispara ao webhook n8n. **Fica**.
- `_shared/evolutionApiClient.ts` → shim + `mapEvolutionStatusToDelivery` (não se aplica ao ManyChat). **Renomear e enxugar.**
- `_shared/manychat.ts` → `subscriber + sendFlow` direto ao ManyChat, usado por `lembretes-runner`. Cria segundo canal oficial.
- `_shared/rateLimitOutbound.ts`, `whatsappGuards.ts`, `envioStatusGlobal.ts` → viram defesa em profundidade.

### Crons ativos (migração 20260712223249)
- `cron-boas-vindas-lead` (*/5)
- `cron-retry-boas-vindas-pendentes` (*/10)
- `cron-confirmacao-whatsapp` (0 12 * * *)
- `cron-lembrete-consulta` (0 9 * * *)

### UI admin acoplada ao envio direto
`NovaMensagemWhatsAppModal.tsx`, `WhatsAppChat.tsx`, `KanbanCard.tsx`, `KanbanColumn.tsx`, `AgendamentosTable.tsx`, `TesteEnvioWhatsAppCard.tsx`, `admin/CRM.tsx`, `admin/Avaliacoes.tsx`, `admin/Lembretes.tsx`, `admin/Agendamentos.tsx` — invocam `enviar-whatsapp*`.

## 2. Riscos concretos
1. **Duplicidade ao paciente**: boas-vindas, retry, lembrete/confirmação, assistente e `lembretes-runner` podem colidir com flows ManyChat.
2. **Status incorreto no CRM**: `status_envio` e transições de funil no disparo, não na entrega; `mapEvolutionStatusToDelivery` traduz eventos inexistentes.
3. **Conflito ManyChat**: dois canais oficiais (`whatsappSender` via n8n + `manychat.ts` direto); templates duplicados; `provider_message_id` sem chave estável.
4. **Race no funil**: `assistente-pre-agendamento` transiciona estado antes da confirmação real.

## 3. Arquitetura-alvo
- **IN única**: ManyChat → n8n → `registrar-mensagem-in-n8n` (preservar).
- **Decisão sem envio**: `assistente-pre-agendamento` só classifica/decide e devolve JSON estruturado.
- **OUT única**: novo endpoint `registrar-envio-out-n8n` (evolução do `n8n-registrar-envio`) — única porta que escreve `mensagens_whatsapp` OUT e transiciona estado via RPC.
- **Idempotência**: UNIQUE parcial em `(provider, provider_message_id)`.
- **Supabase = estado**, ManyChat = canal e templates.
- Painéis autenticados: não presumir nós — documentar contrato e ações do owner.

## 4. Plano faseado

### Fase 0 — Congelamento + observabilidade
1. Marcar `_shared/evolutionApiClient.ts` como deprecated e criar `_shared/whatsappOutbound.ts`.
2. `system_logs` com `category='outbound_request'` em cada disparo (source, agendamento, motivo, dedupe_key).
3. `/admin/saude-integracoes`: contadores "OUT emitidos" vs "OUT confirmados ManyChat" nas últimas 24h.

### Fase 1 — Endpoint canônico de OUT
1. Evoluir `n8n-registrar-envio` → `registrar-envio-out-n8n` aceitando `provider='manychat'`, `provider_message_id`, `subscriber_id`, `flow_ns`, `template_key`, `status`, `agendamento_id?`, `conteudo?`. UNIQUE parcial em `(provider, provider_message_id)`.
2. Só esse endpoint chama `transicionar_estado_agendamento` por causa de envio.
3. Doc `docs/CONTRATO-OUTBOUND-MANYCHAT-N8N.md` + ação pendente do owner (nó n8n).

### Fase 2 — Assistente como decisor puro
1. Remover `sendWhatsappTextMessage` de `assistente-pre-agendamento`.
2. Resposta JSON: `{ decisao, slots, variaveis, flow_ns_sugerido?, mensagem_sugerida?, motivo }`.
3. Transição de estado só após ACK. `conversation_intents` continua idempotente por `mensagem_id`.
4. Falha de classificação → `PRECISA_DE_HUMANO` + `bot_ativo=false`.

### Fase 3 — Desligar disparos duplicados (um cron por vez, 24-48h de observação)
- `enviar-boas-vindas-lead`, `retentar-boas-vindas-pendentes`, `enviar-confirmacao-whatsapp`, `lembrete-consulta-whatsapp` → n8n/ManyChat.
- `enviar-whatsapp*` → nova função `request-outbound` (só empurra intenção; não escreve OUT).
- UI admin passa a chamar `request-outbound`.

### Fase 4 — Consolidar canal ManyChat (decisão do owner)
- **A (recomendada)**: `lembretes-runner` deixa de usar `manychat.ts` e passa por `request-outbound`. Remove `_shared/manychat.ts`.
- **B**: mantém ManyChat direto; `registrar-envio-out-n8n` aceita ACK vindo de webhook do próprio ManyChat.

### Fase 5 — Limpeza
1. Renomear helper para `whatsappOutbound.ts`; remover `mapEvolutionStatusToDelivery` e `evolutionStatus`.
2. Remover `supabase/functions/zapi-status/`.
3. `whatsapp-status` reflete "ManyChat via n8n".
4. Lint `no-restricted-imports` contra `evolutionApiClient`.
5. Testes: idempotência do OUT, decisor sem envio, duplicidade de `provider_message_id`.

## 5. Pendências do owner (painéis autenticados)
- **n8n**: nó HTTP `assistente-pre-agendamento` (`x-n8n-secret`) e nó HTTP `registrar-envio-out-n8n` após ACK do ManyChat.
- **ManyChat**: flows boas-vindas, confirmação 24h, lembrete véspera, sugestão de horário; opt-in e janela 24h por flow.
- **`provider_message_id`**: definir chave estável (ex.: id retornado por `sendFlow`).

## 6. Não-objetivos
Não altera front público, tracking, SEO, Meta CAPI, GA4/GTM, agendamento web, RLS, roles, 2FA. Não publica nem envia mensagens.

## 7. Entregáveis por fase
- Fase 0: `docs/AUDITORIA-MENSAGERIA-2026-07-12.md` + observabilidade em `SaudeIntegracoes`.
- Fase 1: migration (UNIQUE parcial), Edge `registrar-envio-out-n8n`, contrato.
- Fase 2: refactor `assistente-pre-agendamento`.
- Fase 3: Edge `request-outbound`, migrations que removem crons, refactor UI admin.
- Fase 4: decisão A/B, refactor `lembretes-runner`.
- Fase 5: renomeações, remoção de `zapi-status`, lint, testes.

Nada será implementado sem aprovação. Este plano é o entregável.
