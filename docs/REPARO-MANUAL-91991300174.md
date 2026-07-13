# Reparo Manual — Telefone 91991300174 (bug 2026-07-13)

**NÃO EXECUTAR AUTOMATICAMENTE.** Documento de referência. Executar apenas após revisão manual do DBA/gestor, em janela de manutenção, e com backup lógico da linha afetada.

## Contexto

Em 2026-07-13 o endpoint `atualizar-status-crm` (versão antiga, baseada em scan de 200 + últimos 8 dígitos) reativou incorretamente o registro histórico `33f691da-4582-4ba4-83cb-198f4f6e91ba` (data 2026-05-07, `status_funil=cancelado`), passando `status_crm` de `CANCELADO` para `HGP` e depois `PRECISA_DE_HUMANO`.

Como consequência, `vincular_mensagem_por_telefone` passou a ver **2 candidatos ativos** para o telefone canônico `91991300174` e retornava `ambiguo=true`, escalando o lead novo `c08dde0b-510d-482f-9512-519cd0ad34de` (real, sem data) ao humano por engano.

A correção de código (endpoints + RPC nesta mesma release) impede novas ocorrências. Este SQL restaura os dois registros ao estado consistente sem apagar histórico.

## SQL de reparo (transacional, revisar antes de rodar)

```sql
BEGIN;

-- Snapshot para auditoria (opcional; guardar em arquivo antes de rodar)
SELECT id, status_crm, status_funil, updated_at
  FROM public.agendamentos
 WHERE id IN (
   'c08dde0b-510d-482f-9512-519cd0ad34de',
   '33f691da-4582-4ba4-83cb-198f4f6e91ba'
 )
 FOR UPDATE;

-- 1) Restaurar o registro histórico ao estado terminal correto.
--    status_funil='cancelado' já está correto; apenas alinhar status_crm.
UPDATE public.agendamentos
   SET status_crm = 'CANCELADO',
       updated_at = now()
 WHERE id = '33f691da-4582-4ba4-83cb-198f4f6e91ba'
   AND status_funil = 'cancelado'
   AND status_crm IN ('HGP','PRECISA_DE_HUMANO');

-- 2) Garantir que o lead atual permaneça como NOVO LEAD/novo,
--    sem sobrescrever caso a equipe já tenha avançado.
UPDATE public.agendamentos
   SET status_crm = 'NOVO LEAD',
       status_funil = 'novo',
       updated_at = now()
 WHERE id = 'c08dde0b-510d-482f-9512-519cd0ad34de'
   AND status_crm = 'PRECISA_DE_HUMANO'
   AND status_funil = 'novo';

-- 3) Log de auditoria (rastreabilidade)
INSERT INTO public.crm_audit_log
  (agendamento_id, user_id, user_email, user_name, acao, status_anterior, status_novo, detalhes)
VALUES
  ('33f691da-4582-4ba4-83cb-198f4f6e91ba', NULL, 'ops@reparo', 'reparo manual',
   'reparo_estado', 'HGP/PRECISA_DE_HUMANO', 'CANCELADO',
   jsonb_build_object('motivo','bug_2026-07-13_reativacao_indevida','telefone_canonico','91991300174')),
  ('c08dde0b-510d-482f-9512-519cd0ad34de', NULL, 'ops@reparo', 'reparo manual',
   'reparo_estado', 'PRECISA_DE_HUMANO', 'NOVO LEAD',
   jsonb_build_object('motivo','bug_2026-07-13_escalado_por_ambiguidade','telefone_canonico','91991300174'));

-- 4) Validação — deve retornar exatamente 1 ativo (c08…)
SELECT id, status_crm, status_funil, is_sandbox
  FROM public.agendamentos
 WHERE telefone_canonico = '91991300174'
   AND is_sandbox IS NOT TRUE
   AND upper(coalesce(status_crm,'')) NOT IN ('ATENDIDO','CANCELADO','COMPARECEU')
   AND lower(coalesce(status_funil,'')) NOT IN ('cancelado','compareceu','faltou');

-- Se a validação retornar exatamente 1 linha (c08…), COMMIT. Caso contrário, ROLLBACK.
-- COMMIT;
-- ROLLBACK;
```

## Checklist antes de executar

1. [ ] Backup lógico dos dois `id`s (via `pg_dump --data-only --table=public.agendamentos -f snapshot.sql` filtrando por `WHERE id IN (...)`).
2. [ ] Confirmar com a equipe de atendimento que o registro `33f…` de fato é histórico e o `c08…` é o lead atual.
3. [ ] Rodar dentro de `BEGIN`/`COMMIT` e conferir a query 4 antes de commitar.
4. [ ] Manter a linha do histórico — **não apagar**. A auditoria depende dela.
