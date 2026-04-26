## Objetivo

Adicionar busca por nome/telefone do paciente e um painel colapsável "Filtros avançados" no drawer de Auditoria (`AuditLogDrawer`), com filtragem **server-side** via uma RPC dedicada para suportar bem o histórico completo (não apenas os 200 já carregados).

---

## 1. Banco de dados — nova RPC `listar_crm_audit`

Função `SECURITY DEFINER` (somente admin) que faz `JOIN` em `agendamentos` e aplica todos os filtros no Postgres. Retorna o mesmo formato já consumido pelo frontend (`CrmAuditEntry` com `agendamento` aninhado).

**Parâmetros:**
- `p_search text` — busca livre em `nome_completo` e `telefone_whatsapp` (ILIKE + dígitos via `normalizar_telefone` para o telefone)
- `p_acao text` — filtro de ação (mantém compatibilidade)
- `p_user_id uuid` — quem fez a ação
- `p_status_anterior text`
- `p_status_novo text`
- `p_data_inicio timestamptz`
- `p_data_fim timestamptz`
- `p_limit int` (default 200)

**Saída:** mesma estrutura de `crm_audit_log` + colunas `paciente_nome` e `paciente_telefone` (frontend monta o objeto `agendamento`).

Guard: `IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Access denied'`.

## 2. RPC auxiliar `listar_crm_audit_users`

Retorna `user_id, user_name, user_email` distintos presentes em `crm_audit_log` (ordenados por nome) para popular o `<Select>` de "Usuário" sem expor `auth.users` diretamente. Também `SECURITY DEFINER` + guard de admin.

## 3. `src/services/crmAudit.ts`

- Estender `listarAuditCrm` para aceitar os novos filtros e usar a RPC `listar_crm_audit` (mantendo o tipo de retorno `CrmAuditEntry[]`).
- Novo helper `listarUsuariosAudit()` chamando `listar_crm_audit_users`.
- Exportar constantes `STATUS_CRM_OPCOES` (NOVO LEAD, AGUARDANDO, CLINICOR, HGP, BELÉM, ATENDIDO) para alimentar os selects.

## 4. `src/components/admin/AuditLogDrawer.tsx`

**Estado novo:**
- `search` (debounced ~300 ms)
- `filtroUsuario`, `filtroStatusAnterior`, `filtroStatusNovo`
- `dataInicio`, `dataFim` (Popover + Calendar shadcn com `pointer-events-auto`)
- `usuariosDisponiveis` (carregado on-mount do drawer)
- `filtrosAvancadosOpen` (Collapsible)

**UI:**
- Linha principal mantém: `<Select>` de ação + busca (Input com ícone Search + clear) + botão Refresh + indicador "ao vivo" + contador.
- Abaixo, `<Collapsible>` "Filtros avançados" com grid de:
  - Usuário (Select alimentado por `listarUsuariosAudit`)
  - Status anterior (Select com STATUS_CRM_OPCOES + "Qualquer")
  - Status novo (Select)
  - Data início / Data fim (DatePickers)
  - Botão "Limpar filtros" (visível quando algum filtro ativo) + badge contando filtros ativos no header do collapsible.

**Comportamento:**
- Refs sincronizadas com cada filtro (padrão já usado para `filtroAcao`) para o callback do Realtime aplicar todos os filtros sem stale closure, incluindo a busca textual (match local em `paciente_nome`/`paciente_telefone`).
- `useEffect` que dispara `fetch()` quando qualquer filtro muda (com debounce no `search`).
- Manter cap de 200 itens e dedup por id no Realtime.

## 5. Realtime — sem mudanças no backend

A subscription continua escutando `INSERT` em `crm_audit_log`. O enriquecimento (busca de `nome_completo`/`telefone_whatsapp`) já existe; basta aplicar os mesmos filtros via refs antes de inserir no estado.

## 6. Arquivos afetados

- **Novo:** `supabase/migrations/<timestamp>_listar_crm_audit_rpc.sql` (cria `listar_crm_audit` + `listar_crm_audit_users`)
- **Editado:** `src/services/crmAudit.ts` (novos params + helper de usuários + STATUS_CRM_OPCOES)
- **Editado:** `src/components/admin/AuditLogDrawer.tsx` (busca, painel colapsável, datepickers, selects, debounce, refs para Realtime)

## 7. Fora do escopo (não será alterado)

- `src/pages/admin/CRM.tsx` — continua passando os mesmos callbacks `onOpenAgendamento`/`onOpenWhatsApp`.
- Tipos `CrmAuditEntry` permanecem; apenas a fonte muda de `.from()` para `.rpc()`.
