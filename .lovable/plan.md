
# Lembretes Anuais — Preparação para Automação por Agente Externo

> **Decisão:** o "Hermes" deste plano é um **agente externo (n8n)** — não recriaremos a infra do antigo bot copiloto removido em 2026-04-29. Para evitar colisão com a regra de memória `não recriar edge functions hermes-*`, a edge function será chamada **`lembretes-runner`** (não `hermes-runner`). A memória será atualizada para refletir a distinção.
> 
> **Status global inicial:** `pausado` em produção. Nenhum envio automático até autorização explícita de piloto.

## Tabelas existentes (alinhamento de nomes)

O plano original cita `campanhas_lembretes / remessas_campanha / pacientes_campanha`. As tabelas reais do projeto são:

| Plano original | Tabela real do projeto |
|---|---|
| `campanhas_lembretes` | `lembretes_campanhas` |
| `remessas_campanha` | `lembretes_campanha_remessas` |
| `pacientes_campanha` | `lembretes_campanha_pacientes` |
| `lembretes_anuais` | `lembretes_anuais` ✓ |

Tudo o que se segue usa os nomes reais.

---

## Fase 1 — Migration Supabase (base auditável + lock)

### Tabelas novas

**`configuracoes_envio`** (singleton, `id boolean PK default true`)
- `limite_sessao int default 40`
- `limite_diario int default 100`
- `janela_inicio time default '09:00'`
- `janela_fim time default '18:00'`
- `status_global text default 'pausado'` — CHECK in `('ativo','pausado','bloqueado')`
- `motivo_bloqueio text`
- `blackout_dates date[] default '{}'`
- `updated_at`, `updated_by uuid`
- Trigger de validação: `janela_inicio < janela_fim`, `limite_sessao > 0`, `limite_diario > 0` (validation trigger, não CHECK).
- Seed: 1 linha singleton com defaults acima (status_global = 'pausado').

**`logs_envio_lembrete`**
- `id uuid PK`
- `created_at timestamptz default now()`
- `agente text` — `'manual' | 'lembretes-runner' | 'cron'`
- `status text` — `'sucesso' | 'falha' | 'bloqueado' | 'ignorado'`
- `motivo text` (quando bloqueado/ignorado/falha)
- `telefone text`, `nome text`
- `mensagem_renderizada text`
- `lembrete_id uuid`, `campanha_id uuid`, `remessa_id uuid`, `paciente_campanha_id uuid` (todos opcionais, sem FK forte para sobreviver a deletes)
- `latencia_ms int`
- `request_id text` (correlação com `system_logs`)
- `payload jsonb` (resposta Evolution sanitizada)
- Índices: `(created_at desc)`, `(status, created_at desc)`, `(agente, created_at desc)`, `(campanha_id)`.

### Colunas em `lembretes_campanha_pacientes` (lock anti-duplicidade)
- `processado_por text` — quem pegou o lock (`manual:<user_id>` ou `runner:<request_id>`)
- `lock_until timestamptz`
- `lock_token uuid`
- Índice parcial: `WHERE lock_until IS NOT NULL`.

### Funções

**`claim_paciente_campanha(p_paciente_id uuid, p_processador text, p_ttl_seconds int default 120) RETURNS uuid`**
- SECURITY DEFINER, search_path = public.
- `UPDATE lembretes_campanha_pacientes SET lock_token = gen_random_uuid(), lock_until = now() + interval, processado_por = p_processador WHERE id = p_paciente_id AND status = 'pendente' AND (lock_until IS NULL OR lock_until < now()) RETURNING lock_token`.
- Retorna `null` se já travado/processado.

**`release_paciente_campanha(p_paciente_id uuid, p_lock_token uuid) RETURNS boolean`**
- Limpa lock somente se o token bate.

**View `vw_status_campanha_atual`** (SECURITY INVOKER, mas RLS via tabelas)
- Junta `lembretes_campanhas` (mês corrente), `lembretes_campanha_remessas` (próxima `data_programada >= today`), totais agregados de `lembretes_campanha_pacientes`, contagem de envios do dia em `logs_envio_lembrete` (status='sucesso'), e a config singleton.

### RLS
- `configuracoes_envio`, `logs_envio_lembrete`: apenas admin (`has_role(auth.uid(),'admin')`) para SELECT/INSERT/UPDATE/DELETE.
- Service role (edge function) bypassa RLS naturalmente.

### Aceite
- Migration roda sem afetar dados existentes.
- `SELECT * FROM configuracoes_envio` retorna 1 linha com `status_global='pausado'`.
- Dois `claim_paciente_campanha` consecutivos no mesmo paciente: primeiro retorna uuid, segundo retorna NULL.
- `SELECT * FROM vw_status_campanha_atual` não quebra mesmo sem campanha do mês.

---

## Fase 2 — Config dinâmica + tela `/admin/configuracoes`

### Refatorar `src/hooks/useEnvioLoteConfig.ts`
- Manter as configurações **avançadas** (intervalos, pausas, variação) como estão no localStorage — são preferências locais.
- Criar **novo** hook `src/hooks/useConfiguracoesEnvio.ts` (React Query) que lê o singleton `configuracoes_envio`:
  - `staleTime: 60_000`
  - Fallback de leitura: usar `LIMITE_SESSAO=40, LIMITE_DIARIO=100, janela 09-18, status_global='pausado'` (fail-safe: nunca libera envio se leitura falhar).
- Expor `{ limiteSessao, limiteDiario, janelaInicio, janelaFim, statusGlobal, blackoutDates, isLoading, isError }`.

### Adaptar `useEnvioLoteConfig`
- `LIMITE_SESSAO` e `LIMITE_DIARIO` deixam de ser constantes "hard rules" e viram **valores dinâmicos** lidos do novo hook.
- `validarLimitesEnvio` recebe os limites como parâmetros (ou consome o novo hook internamente).
- Remover os `export const LIMITE_SESSAO/LIMITE_DIARIO` ou marcar como deprecated.

### Service `src/services/configuracoesEnvio.ts`
- `buscarConfiguracoesEnvio()` → SELECT singleton.
- `atualizarConfiguracoesEnvio(payload)` → UPDATE com `auth.uid()` em `updated_by`.
- `pausarEnvioGlobal(motivo)` / `retomarEnvioGlobal()` → atalhos para mudar `status_global`.

### Consumers a atualizar
- `src/pages/admin/Lembretes.tsx` — header passa a mostrar limites do banco; bloquear UI quando `status_global !== 'ativo'` com badge claro ("Pausado pelo administrador" / "Bloqueado: <motivo>").
- `src/components/admin/CampanhaMensalLembretes.tsx` — usar limites dinâmicos no cálculo/validação.
- `ConfiguracoesAvancadasEnvio.tsx` — manter; só remove duplicidade dos limites globais.

### Nova aba/página `/admin/configuracoes` → "Envio de Lembretes"
- Adicionar nova `<Tab>` ou seção dentro de `src/pages/admin/Configuracoes.tsx` (já existe).
- Campos editáveis:
  - `limite_sessao` (number, > 0)
  - `limite_diario` (number, > 0)
  - `janela_inicio` / `janela_fim` (time pickers, validar `<`)
  - `status_global` (Select: ativo / pausado / bloqueado)
  - `motivo_bloqueio` (textarea, obrigatório se bloqueado)
  - `blackout_dates` (multi-date picker)
- Botões "Salvar" com toast e invalidação do React Query.
- Banner de aviso quando `status_global === 'ativo'`: "Envios automáticos liberados — confirme a janela e os blackout_dates antes de sair desta tela".

### Aceite
- Header de `/admin/lembretes` mostra os valores do banco (não constantes).
- Mudar `limite_diario` em `/admin/configuracoes` reflete em `/admin/lembretes` em até 60s ou após refetch manual.
- Com `status_global = 'pausado'`, o botão de envio manual fica desabilitado e exibe banner.
- Se a leitura do singleton falhar, UI assume "pausado" (fail-safe).

---

## Fase 3 — Logs persistentes em `logs_envio_lembrete`

### Service `src/services/logsEnvioLembrete.ts`
- `registrarLogEnvioLembrete(payload)` — INSERT.
- `listarLogsEnvioLembrete({ limit = 50, status?, agente?, desde? })` — SELECT ordenado por `created_at desc`.
- React Query hook `useLogsEnvioLembrete()` com `staleTime` curto (10s) + invalidação após cada envio manual.

### Refatorar `Lembretes.tsx`
- Remover o array `LogEnvio` em memória / state local.
- `Histórico de Envios` passa a ler de `useLogsEnvioLembrete()`.
- Após cada envio manual (sucesso ou falha), chamar `registrarLogEnvioLembrete`:
  - `agente: 'manual'`, `status: 'sucesso' | 'falha'`
  - `telefone`, `nome`, `mensagem_renderizada`, `lembrete_id`
  - `latencia_ms` (calcular `Date.now()` antes/depois do envio)
  - `payload` com resposta sanitizada (sem dados sensíveis adicionais)
- Mesma estrutura usada nas envios em lote (`CampanhaMensalLembretes`).

### UI
- Manter look atual do histórico, adicionar filtros por `status` e `agente` (chips), e botão "Atualizar".
- Coluna "Origem" exibe badge `manual` / `lembretes-runner`.

### Aceite
- Envio manual cria 1 row em `logs_envio_lembrete`.
- Refresh (F5) preserva o histórico.
- Lista mostra últimas 50, com filtros funcionais.
- Falhas são registradas com `motivo` legível.

---

## Fase 4 — Edge Function `lembretes-runner` (API segura para o agente)

### Arquivo
- `supabase/functions/lembretes-runner/index.ts` (novo)
- `supabase/config.toml`: `[functions.lembretes-runner] verify_jwt = false` (auth via header customizado).

### Secrets
- `LEMBRETES_RUNNER_SECRET` (novo) — solicitar via `add_secret` antes do deploy.
- Reusa `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `EVOLUTION_*` já configurados.

### Endpoints (router por `pathname`)
| Método | Path | Descrição |
|---|---|---|
| GET | `/health` | `{ ok, ts, db_latency_ms }` |
| GET | `/status-campanha?mes=YYYY-MM` | snapshot de `vw_status_campanha_atual` + config + métricas do dia |
| POST | `/pausar` | `{ motivo? }` → `status_global='pausado'` |
| POST | `/retomar` | `status_global='ativo'` (recusa se `status_global='bloqueado'`) |
| POST | `/processar-fila` | `{ limite? }` → processa pacientes pendentes da remessa do dia |
| POST | `/executar-remessa` | `{ campanha_id, numero_remessa, limite? }` → processa pacientes daquela remessa |

### Segurança
- Header obrigatório: `x-lembretes-secret` — comparado com `LEMBRETES_RUNNER_SECRET` via `crypto.timingSafeEqual`.
- Sem secret ou inválido → 401.
- CORS: liberado só para JSON (sem credenciais; é server-to-server).

### Pipeline obrigatório antes de qualquer envio
1. Carregar `configuracoes_envio` singleton.
2. Se `status_global !== 'ativo'` → **423** + log `bloqueado` (motivo: `status_global=<valor>`).
3. Hora atual em `America/Belem` deve estar em `[janela_inicio, janela_fim)`. Fora → **423** + log `bloqueado`.
4. `current_date` não pode estar em `blackout_dates`. Se estiver → **423** + log `bloqueado`.
5. Limite diário: `count(logs_envio_lembrete WHERE status='sucesso' AND created_at::date = today)` < `limite_diario`.
6. Limite de sessão: contador local na invocação < `limite_sessao`.
7. Para cada paciente: `claim_paciente_campanha(paciente_id, 'runner:<request_id>', 120)`. Se NULL → log `ignorado` (motivo: `lock_busy`).
8. Enviar via Evolution (reutilizar `_shared/evolutionApiClient.ts` e `_shared/templateRenderer.ts` para variação anti-spam).
9. `release_paciente_campanha(...)` no `finally` (sucesso libera + status='enviado'; falha libera + status='falha' com motivo).
10. Atualizar contadores em `lembretes_campanha_remessas` (processados/enviados/falhas/ignorados) e em `lembretes_campanhas` (totais).
11. Registrar log em `logs_envio_lembrete` (sucesso/falha/ignorado/bloqueado) com `agente='lembretes-runner'`, `request_id`, `latencia_ms`.
12. Aplicar delay aleatório (mesma lógica de `useEnvioLoteConfig`) entre envios; pausa após N envios (configurável via query param ou defaults).

### Reuso
- Mensagens: usar `gerarMensagemDoTemplate('lembrete_anual', ...)` se template existir; senão renderizar como o front faz.
- Link fixo: `https://drjulianomachado.com/agendamento`.
- WhatsApp guards: `isKnownInvalidWhatsapp` antes de enviar (usa `verificacoes_whatsapp`).

### Resposta padrão
```json
{
  "request_id": "uuid",
  "ok": true,
  "processados": 12,
  "enviados": 10,
  "falhas": 1,
  "ignorados": 1,
  "bloqueado": false,
  "motivo_bloqueio": null,
  "duracao_ms": 14300
}
```

### Aceite
- `GET /health` sem secret → 401. Com secret → 200 `{ ok, ts, db_latency_ms }`.
- `POST /processar-fila` com `status_global='pausado'` → 423, nenhum INSERT em `mensagens_whatsapp`, log `bloqueado` em `logs_envio_lembrete`.
- `GET /status-campanha?mes=2026-05` retorna campanha + próxima remessa + último envio + taxa de erro + config corrente.
- Dois `processar-fila` paralelos no mesmo paciente → apenas 1 envio (lock garante).
- Em `EVOLUTION_API` indisponível → status `falha` por paciente, lock liberado, contadores atualizados, próxima execução reprocessa.

---

## Atualização da memória do projeto

Após Fase 4 concluída, atualizar `mem://index.md`:
- Manter regra "Hermes (bot copiloto WhatsApp) foi REMOVIDO".
- Adicionar nota: "Lembretes Anuais possuem agente externo (n8n) que opera via edge function `lembretes-runner` autenticada por `LEMBRETES_RUNNER_SECRET`. Não é o Hermes antigo."
- Adicionar memory file `mem://infrastructure/lembretes-runner-api` documentando endpoints + status_global + blackout.

---

## Detalhes técnicos (resumo para devs)

```text
┌────────────────────────────────────────────────────────────┐
│ Agente n8n  ──(x-hermes-secret)──>  lembretes-runner        │
│                                          │                  │
│                                          ▼                  │
│                              [configuracoes_envio]          │
│                              status_global / janela /       │
│                              limites / blackout             │
│                                          │                  │
│                                          ▼                  │
│                       claim → Evolution → release           │
│                                          │                  │
│                                          ▼                  │
│                              [logs_envio_lembrete]          │
│                              [lembretes_campanha_*]         │
└────────────────────────────────────────────────────────────┘
```

**Validação fail-safe:** se qualquer leitura crítica falhar (config, DB), o runner **NÃO envia** e responde 503. UI assume `pausado`.

**Não inclui (fora do escopo destas 4 fases):** cron operacional do agente (Fase 7 do doc original), smoke tests automatizados (Fase 6/Prompt 5), painel de métricas avançadas. Estes ficam para iterações posteriores.
