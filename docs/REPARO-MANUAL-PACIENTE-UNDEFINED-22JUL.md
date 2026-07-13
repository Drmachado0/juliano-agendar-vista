# Reparo manual — agendamento de teste "Paciente: undefined" (22/07/2026 14:30 HGP)

**Data do incidente:** 2026-07-13
**Origem:** MCP `criar_agendamento` recebeu `nome_completo="undefined"` vindo de
`$fromAI` do n8n. O guard não existia ainda, então:

1. Um registro foi criado em `public.agendamentos` com `nome_completo="undefined"`,
   `data_agendamento=2026-07-22`, `hora_agendamento=14:30`,
   `local_atendimento=HGP`.
2. A rotina `confirmar-agendamento-whatsapp` renderizou o template e
   disparou pelo n8n a mensagem `Paciente: undefined | Data: 22/07/2026 14:30 HGP`.

## Correção de código (deploy pendente)

- `supabase/functions/_shared/sanitizeOptionalFields.ts` — nova função
  `assertNomePacienteValido` (rejeita `undefined`, `null`, `n/a`, vazio,
  `Paciente`, `Lead WhatsApp`, `Novo Lead`, …).
- `criar-agendamento` — retorna HTTP **422** `nome_paciente_invalido` antes de
  qualquer insert.
- `mcp-agendamento` (tool `criar_agendamento`) — devolve
  `{ sucesso:false, motivo:"nome_paciente_invalido" }` antes de qualquer upsert
  ou notificação; nunca dispara `confirmar-agendamento-whatsapp`.
- `confirmar-agendamento-whatsapp` — recusa o template quando o nome é
  inválido, marca `confirmation_status='bloqueado_nome_invalido'`, pausa o bot
  por 24h (`bot_pausado_ate`, `bot_pausa_motivo='nome_paciente_invalido:*'`),
  grava em `system_logs (level=error, category=whatsapp)` e retorna HTTP **422**.

Testes cobrindo criação, atualização e confirmação: ver
`src/lib/__tests__/agendamentoNomeGuard.integration.test.ts`,
`agendamentoNomeGuard.smoke.test.ts` e `sanitizeOptionalFields.test.ts`.

## Registro afetado

> ⚠️ **NÃO cancelado automaticamente.** Este documento existe para que a
> equipe decida manualmente o que fazer com o card. O agente **não** executou
> nenhum UPDATE/DELETE em produção.

### Identificar o registro

```sql
-- READ-ONLY: inspecionar
SELECT id, nome_completo, telefone_whatsapp, data_agendamento, hora_agendamento,
       local_atendimento, status_crm, status_funil, confirmation_status,
       origem, created_at
FROM public.agendamentos
WHERE data_agendamento = '2026-07-22'
  AND hora_agendamento = '14:30'
  AND local_atendimento ILIKE '%HGP%'
  AND (
    nome_completo IS NULL
    OR btrim(nome_completo) = ''
    OR lower(btrim(nome_completo)) IN ('undefined','null','n/a','na','paciente','lead','lead whatsapp','novo lead')
  );
```

### Opções de reparo (escolher UMA e rodar em transação)

**Opção A — cancelar (recomendado, libera o horário para outro paciente):**

```sql
BEGIN;
UPDATE public.agendamentos
SET status_crm = 'cancelado',
    status_funil = 'cancelado',
    observacoes_internas = COALESCE(observacoes_internas,'')
      || E'\n[reparo 2026-07-13] cancelado por nome inválido "undefined" vindo do MCP $fromAI',
    updated_at = now()
WHERE id = '<UUID_DO_REGISTRO>';
-- Verifique 1 linha afetada antes de commitar:
-- COMMIT; ou ROLLBACK;
```

**Opção B — reatribuir a um paciente real (se o telefone identificar o lead):**

```sql
BEGIN;
UPDATE public.agendamentos
SET nome_completo = '<Nome Completo Real>',
    updated_at = now()
WHERE id = '<UUID_DO_REGISTRO>';
-- COMMIT; ou ROLLBACK;
```

### Após cancelar (opcional): reenviar template correto

Só disparar `confirmar-agendamento-whatsapp` DEPOIS de garantir que
`nome_completo` é válido — caso contrário o novo guard bloqueia novamente
(comportamento esperado).

## Monitoramento contínuo

```sql
-- Falhas do guard registradas nas últimas 24h
SELECT created_at, source, details
FROM public.system_logs
WHERE message = 'confirmacao_bloqueada_nome_invalido'
ORDER BY created_at DESC
LIMIT 50;
```
