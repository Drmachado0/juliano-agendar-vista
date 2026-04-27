# Central de Logs do Sistema (`/admin/logs`)

## Visão Geral
Página administrativa única que consolida toda a observabilidade do site: erros de Edge Functions, ações no CRM, mensagens WhatsApp, acessos públicos e ações administrativas. Hoje os logs estão espalhados (Supabase Edge Logs, `crm_audit_log`, `mensagens_whatsapp`, `status_acesso_log`), o que dificulta diagnóstico rápido.

## 1. Banco — Nova tabela `system_logs`
Campos: `id`, `level` (info/warn/error/critical), `category` (edge_function/agendamento/whatsapp/google_calendar/cron/admin_action/auth/frontend), `source` (nome da função/componente), `message`, `details jsonb`, `user_id`, `user_email`, `agendamento_id`, `request_id`, `created_at`.

Índices em `created_at desc`, `level`, `category`, `source`, `agendamento_id`.
RLS: apenas admins fazem SELECT; INSERT só via service_role ou RPC SECURITY DEFINER.

## 2. RPCs SECURITY DEFINER
- `registrar_system_log(...)` — usado pelo frontend (ações administrativas).
- `listar_system_logs(p_search, p_level, p_category, p_source, p_user_id, p_data_inicio, p_data_fim, p_limit)` — filtros server-side com checagem de role admin (mesmo padrão do `listar_crm_audit`).

## 3. Helper compartilhado para Edge Functions
`supabase/functions/_shared/systemLogger.ts` com `logSystem({ level, category, source, message, details, ... })` que insere via service_role em fire-and-forget.

Instrumentar pontos críticos:
- `criar-agendamento`, `criar-lead`, `converter-lead-agendamento` — sucesso, erro Zod, conflito SLOT_TAKEN.
- `enviar-whatsapp`, `enviar-whatsapp-queue`, `receber-whatsapp` — falhas Evolution, rate-limit, mensagens sem vínculo.
- `enviar-boas-vindas-lead`, `lembrete-consulta-whatsapp` — execuções cron com contagens.
- `notificar-n8n` — payloads inválidos, falhas HMAC.
- `google-calendar-pull/sync` — falhas de token, contagens.

## 4. Service frontend (`src/services/systemLogs.ts`)
- Type `LogEntry`, função `listarSystemLogs(filtros)`, `registrarLogAdmin(...)`, `exportarLogsCsv(entries)`.

## 5. Página `/admin/logs` com 4 abas
- **(a) Sistema** — `system_logs` com filtros (nível, categoria, fonte, busca, período, usuário). Badges coloridos por severidade. Expand-row para ver `details` JSON.
- **(b) CRM** — reaproveita `crm_audit_log` (mesma lógica do `AuditLogDrawer` em formato de tabela inline).
- **(c) WhatsApp** — `mensagens_whatsapp` com filtros (direção IN/OUT, `status_envio`, busca por telefone, link para o agendamento).
- **(d) Acessos públicos** — `status_acesso_log` (rastreio dos pacientes que abrem a página de status).

Header com botões: **Atualizar**, **Auto-refresh (10s)**, **Exportar CSV**, toggle **"Ao vivo"** (Realtime).

## 6. Realtime
Habilitar Realtime na tabela `system_logs`. Subscrição ativa apenas quando "Ao vivo" estiver ligado, com prepend de novos logs no topo.

## 7. Navegação
- Adicionar item **"Logs do Sistema"** (ícone `ScrollText`) em `AdminLayout.tsx`.
- Adicionar rota `/admin/logs` em `src/App.tsx`.
- Manter `/admin/auditoria-tracking` separada (foco em pixels/tags de marketing).

## 8. Retenção (limpeza automática)
Cron pg_cron diário: deletar `info` > 30 dias e `warn/error/critical` > 90 dias.

## 9. Validação
1. Criar agendamento → entrada `info` em `criar-agendamento`.
2. Forçar SLOT_TAKEN → entrada `warn`.
3. Mover card no CRM → aparece na aba CRM.
4. Falha de envio WhatsApp → `error` na aba Sistema + registro na aba WhatsApp.
5. Toggle "Ao vivo" deve mostrar novos logs em tempo real.

## Arquivos
**Criar:** `supabase/migrations/[ts]_create_system_logs.sql`, `supabase/functions/_shared/systemLogger.ts`, `src/services/systemLogs.ts`, `src/pages/admin/Logs.tsx`, `src/components/admin/LogDetailsDrawer.tsx`.

**Editar:** `src/App.tsx`, `src/components/admin/AdminLayout.tsx`, e instrumentar as Edge Functions principais (`criar-agendamento`, `criar-lead`, `converter-lead-agendamento`, `enviar-boas-vindas-lead`, `enviar-whatsapp`, `receber-whatsapp`, `notificar-n8n`, `google-calendar-pull`, `lembrete-consulta-whatsapp`).