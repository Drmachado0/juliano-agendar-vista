# Auditoria do CRM em tempo real

## Objetivo
Atualizar o drawer de Auditoria do CRM em tempo real, exibindo automaticamente novas ações registradas (mudança de status, reprocessamento de boas-vindas, WhatsApp manual, automações, merge de duplicados) sem precisar clicar em "Atualizar" ou recarregar.

## Arquitetura
Usar **Supabase Realtime** na tabela `public.crm_audit_log`, inscrevendo apenas no evento `INSERT` (a tabela é append-only — RLS bloqueia UPDATE/DELETE). A inscrição fica ativa **somente enquanto o drawer está aberto**, para economizar conexões.

## Mudanças

### 1. Migração SQL — habilitar Realtime
```sql
ALTER TABLE public.crm_audit_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_audit_log;
```

### 2. `src/components/admin/AuditLogDrawer.tsx`
- Novo `useEffect` que, enquanto `open === true`:
  - Cria channel `crm-audit-log-changes` e inscreve em `postgres_changes` (`event: 'INSERT'`, `schema: 'public'`, `table: 'crm_audit_log'`).
  - No callback:
    - Lê o filtro atual via `ref` (evita stale closure).
    - Se `agendamento_id` existir, busca `nome_completo`/`telefone_whatsapp` em `agendamentos` para preencher o join (Realtime não traz relacionamentos).
    - Aplica filtro `filtroAcao` antes de inserir.
    - Faz prepend em `entries`, deduplicando por `id`, mantendo no máximo 200.
  - Cleanup remove o channel.
- Mantém `fetch()` inicial e botão "Atualizar" para fallback manual.

### 3. UX — indicador "ao vivo"
- Ao lado do contador "X registro(s)", mostrar um ponto verde pulsante + texto "ao vivo" quando o channel está `SUBSCRIBED`.

## Não muda
- RLS, RPC `registrar_crm_audit`, `listarAuditCrm`, demais telas.
- Como todas as ações já chamam `registrar_crm_audit`, aparecerão automaticamente.

## Riscos
- **RLS**: não-admins não recebem eventos (correto — drawer é admin-only).
- **Race com filtro**: usar `ref` para evitar stale closure e não precisar recriar canal a cada troca.
- Cap de 200 entries para evitar crescimento ilimitado.

## Arquivos
- `supabase/migrations/<timestamp>_realtime_crm_audit_log.sql` (novo)
- `src/components/admin/AuditLogDrawer.tsx` (editar)