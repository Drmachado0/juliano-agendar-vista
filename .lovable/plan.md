## Objetivo

Mover automaticamente para a coluna **Concluído** (`ATENDIDO`) qualquer agendamento cuja `data_agendamento` seja anterior a hoje, independente da coluna em que está.

## Regra

- Se `data_agendamento < hoje` (compara data, ignora hora) e `status_crm != 'ATENDIDO'` → tratar como `ATENDIDO`.
- Vale para qualquer coluna (NOVO LEAD, AGUARDANDO, CLINICOR, HGP, BELÉM, PRECISA_DE_HUMANO).
- Cards sem data continuam onde estão.

## Implementação

### 1. Reclassificação na origem (`src/services/agendamentos.ts`)

Na função que agrupa por status (`agruparPorStatusCrm`), antes do `grouped[status].push(...)`:

```text
hoje = data local de hoje (YYYY-MM-DD)
se agendamento.data_agendamento && agendamento.data_agendamento < hoje:
    status_efetivo = 'ATENDIDO'
senão:
    status_efetivo = status_crm
```

Assim a UI já mostra na coluna Concluído sem precisar de migração de dados.

### 2. Persistência em background (mesma função)

Coletar IDs reclassificados e disparar `UPDATE agendamentos SET status_crm='ATENDIDO' WHERE id IN (...)` fire-and-forget. Garante que webhooks/n8n e relatórios fiquem consistentes ao longo do tempo, sem bloquear a UI.

- Registrar via `crmAudit` com `acao='auto_concluido_por_data'` para manter rastreabilidade.
- Pular cards que já estão em `ATENDIDO`.

### 3. Backfill único

Rodar uma vez, via ferramenta de dados, para histórico:

```sql
UPDATE agendamentos
SET status_crm = 'ATENDIDO'
WHERE data_agendamento < CURRENT_DATE
  AND status_crm <> 'ATENDIDO';
```

### 4. Ajustes finos no CRM

- `src/pages/admin/CRM.tsx` linha 94 (filtro "atrasados"): já exclui `ATENDIDO`, segue válido — sem mudança.
- Drag-and-drop manual continua funcionando normalmente; usuário pode tirar de Concluído se errar.

## Fora do escopo

- Cron job no banco: a reclassificação no fetch + backfill resolve. Se quiser cron diário no futuro, fica como evolução.
- Mexer em `status_funil`, lembretes, n8n, ou outras colunas além do CRM.

## Validação

1. Abrir `/admin/crm` com um card cuja data seja ontem em outra coluna → deve aparecer em **Concluído** e a coluna anterior fica sem ele.
2. Recarregar e conferir no banco que `status_crm` foi atualizado.
3. Card de hoje permanece na coluna original.
4. Card sem data permanece onde estava.
