
# 🔄 Sincronização bidirecional Google Calendar → Site

Hoje a sincronização é **one-way** (site → Google). Vou implementar o caminho inverso: eventos criados/editados/deletados no Google Calendar viram agendamentos no sistema, com polling a cada 15 min + botão manual de sync imediato.

---

## 🗄️ 1. Migração de banco

```sql
ALTER TABLE public.google_calendar_tokens
  ADD COLUMN IF NOT EXISTS sync_token text,
  ADD COLUMN IF NOT EXISTS last_pull_at timestamptz,
  ADD COLUMN IF NOT EXISTS pull_enabled boolean DEFAULT true;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS google_calendar_etag text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced_at timestamptz;

ALTER TABLE public.google_calendar_settings
  ADD COLUMN IF NOT EXISTS default_import_clinica_id uuid;
```

`google_calendar_event_id` já existe — reutilizado para matching.

---

## ⚙️ 2. Nova edge function: `google-calendar-pull`

**Path:** `supabase/functions/google-calendar-pull/index.ts`  
**Config:** `verify_jwt = false`, valida `x-cron-secret` (CRON_SECRET) **ou** JWT admin no header.

**Fluxo:**
1. Para cada `google_calendar_tokens` com `pull_enabled=true`:
2. Renova access_token se expirado.
3. `GET /calendars/{calendar_id}/events?syncToken=...&singleEvents=true&showDeleted=true`.
4. Se `410 Gone` → refaz full sync com `timeMin=now`.
5. Para cada evento:
   - **Anti-loop:** se `extendedProperties.private.source === 'lovable'` → ignora.
   - **Já existe** (`google_calendar_event_id` no banco): atualiza só se etag mudou.
   - **Cancelado** (`status='cancelled'`): marca `status_funil='cancelado'`.
   - **Novo:**
     - Parser extrai de `summary` + `description`:
       - **Nome**: primeira linha do summary (fallback "Evento Google")
       - **Telefone**: regex `\(?\d{2}\)?\s*9?\d{4}-?\d{4}`
       - **E-mail**: regex padrão
       - **Convênio**: keywords (particular, unimed, bradesco, cassi, sul américa)
       - **Tipo**: keywords (consulta, retorno, exame, cirurgia)
     - `data_agendamento` / `hora_agendamento` ← `event.start.dateTime`
     - `local_atendimento` ← `default_import_clinica_id` (configurável)
     - `origem='google_calendar'`, `status_funil='agendado'`, `status_crm='NOVO LEAD'`
     - Grava `google_calendar_event_id` + `google_calendar_etag`
     - Validação de disponibilidade: se conflito, insere com `observacoes_internas='⚠️ Conflito detectado na importação'`.
6. Salva `nextSyncToken` e `last_pull_at`.
7. Retorna `{ imported, updated, cancelled, conflicts, errors }`.

---

## 🕒 3. Cron job (pg_cron, a cada 15 min)

Via tool `insert` (não migration, pois contém secret):

```sql
select cron.schedule(
  'google-calendar-pull-15min',
  '*/15 * * * *',
  $$ select net.http_post(
    url := 'https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/google-calendar-pull',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb
  ) $$
);
```

---

## 🛡️ 4. Anti-loop (crítico)

Atualizar `buildEvent` em `supabase/functions/google-calendar-sync/index.ts` para sempre incluir:

```typescript
extendedProperties: {
  private: { source: 'lovable', agendamento_id: '<uuid>' }
}
```

O `pull` ignora qualquer evento com essa marca → **zero risco de loop infinito**.

---

## 🎨 5. Interface (UI)

### `src/pages/admin/Configuracoes.tsx` (aba Integrações → Google Calendar)
- Switch **"Importar eventos do Google Calendar"** (`pull_enabled`).
- Select **"Local padrão para eventos importados"** (lista de clínicas).
- Indicador "Última importação: há X min".
- Botão **"Sincronizar agora"** → invoca pull manualmente, mostra toast com estatísticas.

### `src/pages/admin/Agenda.tsx`
- Novo botão **"↻ Sincronizar Google"** no header (com spinner).
- Após sync, recarrega agenda automaticamente.

### `src/components/admin/AgendaSlot.tsx`
- Slots com `origem='google_calendar'` ganham badge azul **"Google"**.
- Slots com observação de conflito ganham ícone ⚠️ + tooltip de aviso.

### `src/services/googleCalendar.ts`
- `pullGoogleCalendarEvents(userId)` → invoca `google-calendar-pull`.
- `updatePullSettings(userId, { pull_enabled, default_import_clinica_id })`.

---

## 📁 Arquivos afetados

**Novos:**
- `supabase/functions/google-calendar-pull/index.ts`
- `supabase/migrations/<timestamp>_google_calendar_pull.sql`

**Modificados:**
- `supabase/functions/google-calendar-sync/index.ts` (adiciona `extendedProperties`)
- `supabase/config.toml` (registra `[functions.google-calendar-pull] verify_jwt = false`)
- `src/services/googleCalendar.ts`
- `src/pages/admin/Configuracoes.tsx`
- `src/pages/admin/Agenda.tsx`
- `src/components/admin/AgendaSlot.tsx`

**SQL via insert (não migration):**
- Cron `google-calendar-pull-15min`

---

## ⚠️ Limitações

1. **Parsing depende do formato do título/descrição** do evento Google — eventos sem padrão claro viram "Evento Google" com data/hora apenas; admin completa nome/telefone manualmente.
2. **Não dispara WhatsApp automático** para eventos importados (paciente não consentiu via formulário). Pode ser ativado depois.
3. **`syncToken` expira em ~7 dias** sem polling — detectado via `410 Gone`, sistema refaz full sync automaticamente.
4. **Conflito de horário:** se evento importado bate com agendamento existente, é inserido com flag de aviso para admin resolver manualmente.
5. **Defasagem:** mudanças no Google aparecem em até 15 min (ou imediatamente via botão).

---

## ✅ Resultado final

- **Site → Google**: continua funcionando, ganha marca anti-loop.
- **Google → Site**: novo, automático a cada 15 min + botão manual.
- Eventos importados aparecem na agenda com badge "Google" e entram no CRM como NOVO LEAD.
- Sem risco de loop infinito.
