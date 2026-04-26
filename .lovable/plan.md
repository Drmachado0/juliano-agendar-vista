# Melhorias na integração com Google Calendar

## Estado atual
- OAuth funciona, mas `calendar_id` é fixo em `primary` (sem opção de escolher).
- Sem visibilidade da conta conectada, data, ou status de saúde da sincronização.
- Sem teste de conexão, ressincronização manual ou pausa temporária.
- Configurações de evento (duração, lembretes, cor, conteúdo) não são editáveis.

## Melhorias propostas

### 1. Seleção de calendário de destino
- Nova edge function `google-calendar-list` chamando `GET /users/me/calendarList`, retornando apenas calendários com permissão de escrita (owner/writer).
- UI: `Select` com lista (nome + badge "Principal"). Salvar em `google_calendar_tokens.calendar_id` via nova action `update-calendar`.

### 2. Detalhes da conexão
- Migração: adicionar `google_email TEXT`, `connected_at TIMESTAMPTZ`, `last_sync_at TIMESTAMPTZ`, `last_sync_error TEXT` em `google_calendar_tokens`.
- Callback grava `google_email` chamando `oauth2/v2/userinfo` (requer adicionar escopo `userinfo.email`).
- UI mostra: e-mail conectado, data da conexão, "última sincronização há X min", alerta se houver erro.

### 3. Botão "Testar conexão"
- Nova action `test` na função `google-calendar-sync` faz um GET rápido no calendário e retorna `{ ok, summary, time_zone }`.
- UI exibe resultado em toast com ícone verde/vermelho.

### 4. Configurações de evento personalizáveis
- Nova tabela `google_calendar_settings` (1 linha por user_id, RLS admin-only):
  - `default_duration_min` (int, default 30)
  - `reminder_popup_min` (int[], default `{60, 1440}`)
  - `event_color_id` (text, IDs Google 1–11)
  - `include_patient_phone` (bool)
  - `include_convenio` (bool)
  - `auto_sync_enabled` (bool) — pausa sincronização sem desconectar
- UI: switches/inputs + selector visual de cores.
- `createGoogleCalendarEvent` passa a ler estas settings.

### 5. Ressincronização em lote
- Nova action `sync-batch` itera agendamentos futuros (próximos 30 dias) sem `google_calendar_event_id` e cria eventos em lote (com pequeno delay).
- UI: botão "Ressincronizar próximos 30 dias" com toast de progresso/total.

### 6. Pausar/retomar sincronização
- Switch lendo `auto_sync_enabled`. Helper `syncAgendamentoToCalendar` respeita a flag.

### 7. Link rápido
- Botão "Abrir no Google Calendar" → `https://calendar.google.com/calendar/u/0/r?cid=<calendar_id base64>`.

## Arquivos afetados
- **Migração SQL**: colunas novas em `google_calendar_tokens` + tabela `google_calendar_settings` com RLS.
- **Edge functions**:
  - `supabase/functions/google-calendar-list/index.ts` (nova)
  - `supabase/functions/google-calendar-sync/index.ts` (novas actions: `test`, `update-calendar`, `sync-batch`; ler settings; gravar `last_sync_at`/`last_sync_error`)
  - `supabase/functions/google-calendar-callback/index.ts` (gravar `google_email` e `connected_at`)
  - `supabase/functions/_shared/syncGoogleCalendar.ts` (respeitar `auto_sync_enabled`)
  - `supabase/config.toml` (registrar `google-calendar-list` com `verify_jwt = true`)
- **Frontend**:
  - `src/services/googleCalendar.ts` — novas funções (`listGoogleCalendars`, `updateCalendarSelection`, `testConnection`, `getSettings`, `updateSettings`, `resyncBatch`).
  - `src/pages/admin/Configuracoes.tsx` — card expandido com cabeçalho de status, select de calendário, botões de ação e bloco de configurações.

## Observação importante
- Será adicionado o escopo `userinfo.email` no fluxo OAuth, então será necessário **reconectar a conta uma vez** após o deploy para capturar o e-mail (a UI avisará).
