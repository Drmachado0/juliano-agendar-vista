# Sincronização automática com Google Calendar após agendamento

## Objetivo
Disparar a criação automática do evento no Google Calendar do consultório sempre que um agendamento for confirmado (via `/agendar`, `/agendamento` ou admin), sem exigir ação manual. Reaproveitar a edge function `google-calendar-sync` já existente.

## Estratégia
A edge function `google-calendar-sync` já cria/atualiza/deleta eventos, mas exige um `user_id` (admin que conectou o Calendar via OAuth na tabela `google_calendar_tokens`). Como os agendamentos públicos são anônimos, vamos selecionar **automaticamente** o primeiro admin com token válido como "calendário do consultório".

## Arquivos a editar/criar

### 1. `supabase/functions/_shared/syncGoogleCalendar.ts` (novo)
Helper compartilhado:
- `syncAgendamentoToCalendar(supabase, agendamentoId, action)`:
  1. Busca em `google_calendar_tokens` o primeiro `user_id` ativo (preferindo admins via `user_roles`).
  2. Se não houver token configurado → loga aviso e retorna silenciosamente.
  3. Invoca `google-calendar-sync` com `{ action, agendamento_id, user_id }`.
  4. Captura erros e apenas loga (fire-and-forget).

### 2. `supabase/functions/criar-agendamento/index.ts`
- Após o `insert` bem-sucedido, adicionar invocação fire-and-forget do helper junto com WhatsApp e Email: `Promise.allSettled([notifyWhatsApp, notifyEmail, notifyCalendar])`.

### 3. `supabase/functions/converter-lead-agendamento/index.ts`
- Após o update bem-sucedido (lead → agendamento), disparar fire-and-forget o mesmo helper com `action: 'create'`.

### 4. `supabase/config.toml`
- Mudar `google-calendar-sync` para `verify_jwt = false` para permitir invocação server-to-server. A função continua segura: usa SERVICE_ROLE_KEY internamente e valida `user_id`.

### 5. Admin: criação manual
- `NovoAgendamentoAdminModal.tsx` já sincroniza quando o admin atual tem GCal conectado. Mantido como está.

## Edge cases tratados
- **Sem token configurado**: helper retorna silenciosamente; agendamento salva normalmente.
- **Token expirado**: `getValidAccessToken` já faz refresh automático.
- **Falha na API do Google**: erro é apenas logado; não bloqueia confirmação ao usuário.
- **Atualização/cancelamento futuro**: `google_calendar_event_id` já é salvo em `agendamentos`, permitindo update/delete via UI admin.

## Resultado
Após qualquer novo agendamento confirmado, evento aparece automaticamente no Google Calendar com paciente, telefone, tipo, local, convênio e lembretes 1h e 24h antes — sem ação manual da secretária.

## Pré-requisito (usuário)
Pelo menos **um admin** precisa conectar o Google Calendar uma vez em `/admin/configuracoes` → **Integrações**. Se ninguém estiver conectado, agendamentos seguem funcionando, apenas sem criar evento.