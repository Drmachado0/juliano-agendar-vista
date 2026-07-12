
# Correção crítica CRM/WhatsApp — plano de execução

Escopo alto e sensível (produção, segredos, dados reais). Antes de codar, aqui está o plano proposto. Peço confirmação antes de aplicar, principalmente pelas partes 1, 4 e 6 (crons, órfãs, rotação de segredos).

## 1. Autenticação & crons (edge functions + config.toml + migration)

Arquivos:
- `supabase/config.toml`: declarar `retentar-boas-vindas-pendentes`, `assistente-pre-agendamento`, `enviar-confirmacao-whatsapp`, `atualizar-status-crm`, `registrar-mensagem-in-n8n` explicitamente. Todas com `verify_jwt = false` (autenticação feita em código).
- `supabase/functions/_shared/authGuards.ts` (novo): `requireCronSecret(req)` e `requireN8nSecret(req)` com comparação timing-safe (`crypto.timingSafeEqual`), lendo do Vault via `ler_secret_integracao('CRON_SECRET' | 'N8N_SHARED_SECRET')` com fallback para `Deno.env` apenas em dev.
- `supabase/functions/_shared/n8nSecret.ts`: já existe `getN8nSharedSecret`. Unificar `atualizar-status-crm` e qualquer outro endpoint n8n para usar esse helper.
- `assistente-pre-agendamento/index.ts`: exigir header `x-n8n-secret` com `requireN8nSecret`; retornar 401 JSON claro.
- `retentar-boas-vindas-pendentes/index.ts`: exigir `x-cron-secret`; nunca público.

Migration `20260712_cron_secrets_from_vault.sql`:
- Cria helper SQL `public._cron_headers()` que lê `CRON_SECRET` do `vault.decrypted_secrets` e devolve `jsonb` de headers. Roda como `SECURITY DEFINER`.
- `cron.unschedule` + `cron.schedule` dos jobs de boas-vindas, retry, confirmação e assistente pull, agora chamando `net.http_post(..., headers := public._cron_headers())`. Zero segredo literal no SQL.

## 2. Normalização de telefone + associação idempotente

Migration `20260712_phone_canonical.sql`:
- Função `public.telefone_canonico(text)`: strip não-dígitos, remove DDI 55, garante 11 dígitos, normaliza 9º dígito (regra Brasil). `IMMUTABLE`.
- Coluna gerada `agendamentos.telefone_canonico text GENERATED ALWAYS AS (telefone_canonico(telefone_whatsapp)) STORED`.
- Índice `CREATE UNIQUE INDEX ... ON agendamentos(telefone_canonico) WHERE status_crm <> 'cancelado' AND is_sandbox = false` — **não único** de fato (múltiplos leads permitidos); usar índice comum + índice único parcial só em `(telefone_canonico, data_agendamento, hora_agendamento, clinica_id)` já existente.
- Mesma coluna gerada em `mensagens_whatsapp` para lookup determinístico.
- Nova RPC `public.vincular_mensagem_por_telefone(p_mensagem_id uuid)`: match exato por `telefone_canonico`, com `FOR UPDATE SKIP LOCKED`. Se 0 → cria lead novo com `origem='whatsapp_inbound'`. Se 1 → vincula. Se >1 → marca `precisa_revisao=true`, NÃO merge.

Atualizar `registrar-mensagem-in-n8n` para usar a RPC e emitir `message.received` só após vinculação.

## 3. Continuidade do funil

- Nova coluna `mensagens_whatsapp.processado_em timestamptz` + índice único parcial em `mensagem_externa_id` para idempotência.
- RPC `public.transicionar_estado_agendamento(p_id, p_novo_status_crm, p_motivo)` transacional: atualiza `status_crm`, `status_funil` e `estado_atendimento` mantendo mapeamento consistente. Quando novo status = `PRECISA_DE_HUMANO` → `bot_ativo=false, bot_pausa_motivo=<motivo>`. Guard: não rebaixa se já `compareceu`/`agendado` com data futura.
- Trigger em `mensagens_whatsapp` (IN) chama assistente via `pg_net` (fire-and-forget) com `request_id` correlacionado. Assistente responde OUT e grava `conversation_intents`. Falha ⇒ `transicionar_estado_agendamento(..., 'PRECISA_DE_HUMANO', 'assistente_falhou')`.

## 4. Recuperação de órfãs (admin only, dry-run first)

- Nova RPC `public.vincular_mensagens_orfas(p_dry_run boolean default true)`: só vincula com match único e exato. Retorna `{candidatas, vinculadas, ambiguas, sem_match}`. Requer `has_role(admin)`.
- Página admin `src/pages/admin/MensagensOrfas.tsx` com botão dry-run e botão aplicar (confirmação dupla). Sem envio de mensagens.
- Filtro no CRM "Paciente aguardando resposta" baseado em: última mensagem IN sem OUT posterior E `updated_at < now() - interval '10 min'`.

## 5. Observabilidade

- Trigger em `net._http_response` (ou consulta periódica) para materializar contagens em `system_logs` por job.
- View `public.v_saude_integracoes`: 2xx/4xx/5xx/timeout por função últimas 24h + mensagens órfãs + intents processadas + aguardando resposta.
- Página `src/pages/admin/SaudeIntegracoes.tsx` (ou aba nova em Saúde existente) lendo a view.
- `request_id` UUID propagado ponta a ponta via header `x-request-id`, gravado em `system_logs.request_id`.

## 6. Segurança

- Migration `20260712_remove_literal_secrets.sql`: revoga jobs antigos que tinham segredo hardcoded. Não loga valor antigo.
- Doc `docs/ROTACAO-SEGREDOS-2026-07-12.md`: instruções ao operador para rotacionar `CRON_SECRET` e `N8N_SHARED_SECRET` via UI de rotação existente (`rotacionar_secret_integracao`) após deploy. Sem valores.

## 7. Testes (vitest)

Adicionar em `src/__tests__/` e `supabase/functions/**/*.test.ts` (deno test mockado onde couber):
- `authGuards.test.ts`: timing-safe, 401 sem header, 401 com header errado, 200 correto.
- `telefoneCanonico.test.ts`: casos +55, 8/9 dígitos, DDD, lixo, null.
- `vincularMensagem.test.ts`: 0/1/N matches, concorrência simulada, idempotência.
- `transicionarEstado.test.ts`: mapeamento tri-campo, não rebaixa compareceu, PRECISA_DE_HUMANO ⇒ bot_ativo=false.
- `assistenteFluxo.test.ts` (mock): IN → intent → OUT → estado; falha ⇒ humano.
- `cronAuth.test.ts`: sem CRON_SECRET → 401.
- `orfasDryRun.test.ts`: dry-run não muta.

Sem envio real de WhatsApp — mocks em `_shared/whatsappSender.ts` durante testes (flag `SANDBOX_MODE=true`).

## Ordem de deploy sugerida

1. Migrations 1 (normalização) → 2 (idempotência/RPCs) → 3 (crons via vault).
2. Deploy edge functions com novos guards.
3. Ativar `config.toml` novo.
4. Rodar dry-run de órfãs no admin.
5. Rotacionar segredos manualmente.

## Passos manuais que ficarão para o operador

- Rotacionar `CRON_SECRET` e `N8N_SHARED_SECRET` via `/admin/integracoes` após o deploy.
- Atualizar o workflow n8n para enviar `x-n8n-secret` (novo header) — hoje pode estar em outro nome.
- Executar dry-run de órfãs e revisar antes de aplicar.

## Riscos & mitigação

- Coluna gerada em tabela grande (`agendamentos`, `mensagens_whatsapp`) pode travar. Uso `ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS AS ... STORED` em transação curta; se necessário, faço `CREATE INDEX CONCURRENTLY` fora da migration.
- Trigger novo em `mensagens_whatsapp` pode dobrar carga: fire-and-forget via `pg_net`, sem bloquear insert.
- Mudança de contrato do assistente (header n8n) quebra n8n até o workflow ser atualizado. Vou aceitar por 24h **também** o header antigo com log de deprecation, para janela de migração.

---

Confirma que posso executar tudo acima? Se preferir, posso quebrar em fases (ex.: só 1+6 primeiro, depois 2+3, depois 4+5) para reduzir risco por deploy.
