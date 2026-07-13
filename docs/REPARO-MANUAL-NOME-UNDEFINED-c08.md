# Reparo Manual — Nome "undefined" no lead c08 (bug 2026-07-13)

**NÃO EXECUTAR AUTOMATICAMENTE.** Documento de referência. Revisar antes de rodar, em janela de manutenção e com backup lógico da linha.

## Contexto

Em 2026-07-13 o endpoint `atualizar-agendamento-por-telefone` (versão anterior) recebeu do n8n/ManyChat um payload com `nome_completo: "undefined"` (string literal, vinda de um `$fromAI` sem valor). O código antigo tratava qualquer string não vazia como válida e sobrescreveu `Juliano Machado` por `undefined` no lead `c08dde0b-510d-482f-9512-519cd0ad34de`.

A correção de código nesta release (sanitização de placeholders `"undefined"`, `"null"`, `"n/a"`, vazio, só espaços) impede novas ocorrências. Este SQL restaura APENAS esse lead.

## SQL de reparo (transacional, revisar antes de rodar)

```sql
BEGIN;

-- Snapshot para auditoria (guardar antes de rodar)
SELECT id, nome_completo, updated_at
  FROM public.agendamentos
 WHERE id = 'c08dde0b-510d-482f-9512-519cd0ad34de'
 FOR UPDATE;

-- Restaurar nome real APENAS se estiver corrompido como "undefined"/"null"/vazio.
UPDATE public.agendamentos
   SET nome_completo = 'Juliano Machado',
       updated_at    = now()
 WHERE id = 'c08dde0b-510d-482f-9512-519cd0ad34de'
   AND lower(coalesce(trim(nome_completo), '')) IN ('undefined','null','n/a','na','');

-- Log de auditoria
INSERT INTO public.crm_audit_log
  (agendamento_id, user_id, user_email, user_name, acao, status_anterior, status_novo, detalhes)
VALUES
  ('c08dde0b-510d-482f-9512-519cd0ad34de', NULL, 'ops@reparo', 'reparo manual',
   'reparo_nome_completo', 'undefined', 'Juliano Machado',
   jsonb_build_object('motivo','bug_2026-07-13_placeholder_fromAI','origem','n8n/manychat'));

-- Validação — deve retornar Juliano Machado
SELECT id, nome_completo
  FROM public.agendamentos
 WHERE id = 'c08dde0b-510d-482f-9512-519cd0ad34de';

-- COMMIT; -- se a validação estiver correta
-- ROLLBACK; -- caso contrário
```

## Checklist antes de executar

1. [ ] Backup lógico da linha (`pg_dump --data-only --table=public.agendamentos ... WHERE id = 'c08...'`).
2. [ ] Confirmar com a equipe que o nome real é de fato `Juliano Machado` para esse telefone.
3. [ ] Rodar dentro de `BEGIN`/`COMMIT` e conferir a validação antes de commitar.
4. [ ] NÃO estender o `UPDATE` para outros IDs sem revisão caso-a-caso — pode haver leads legítimos com nomes curtos.
