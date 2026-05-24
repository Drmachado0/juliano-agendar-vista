## Travas anti-loop / anti-spam no envio de WhatsApp

Objetivo: garantir que **nunca** um lead/paciente receba mais de N mensagens automáticas em curto intervalo, mesmo se houver bug, cron duplicado ou falha de dedup.

### 1. Trava por telefone (rate-limit global outbound)
Nova função SQL `pode_enviar_outbound(telefone, tipo, janela_minutos, max_msgs)`:
- Conta mensagens em `mensagens_whatsapp` com `direcao='OUT'` para o telefone (últimos 8 dígitos) nos últimos X min.
- Retorna `false` se excedeu.

Aplicar em **todas** as edge functions outbound antes de chamar Evolution:
- `enviar-boas-vindas-lead` — máx **1 / 24h** por telefone
- `enviar-confirmacao-whatsapp` — máx **1 / 6h**
- `lembrete-consulta-whatsapp` — máx **2 / 24h**
- `lembretes-runner` — máx **1 / 7 dias** por telefone
- `enviar-whatsapp` (manual) — máx **10 / hora** (anti-fat-finger)

### 2. Circuit breaker por tipo de mensagem
Nova tabela `envio_circuit_breaker`:
- `tipo_mensagem`, `janela_inicio`, `count_enviado`, `count_erro`, `aberto` (bool)
- Se taxa de erro > 30% em 10 min → marca `aberto=true` e bloqueia envios desse tipo por 30 min.
- Edge function consulta antes de enviar; se aberto, registra em `system_logs` e pula.

### 3. Trava por agendamento
Para evitar reentradas (causa do bug Bruna):
- Garantir índices únicos parciais por `agendamento_id + tipo_mensagem` para `boas_vindas`, `confirmacao`, `lembrete_24h`, `lembrete_2h`, `agradecimento`.
- Padronizar pattern **"claim → send → update"** (já feito em boas-vindas) nas demais functions outbound.

### 4. Kill switch global imediato
- Já existe `configuracoes_envio.status_global`. Adicionar verificação **em todas** as edge functions outbound logo no início (hoje várias ignoram).
- Adicionar botão "🛑 PARAR TUDO AGORA" no admin → seta `status_global='bloqueado'` + `motivo_bloqueio='manual_panic'`.

### 5. Monitor + alerta
Cron `monitor-envios-anomalos` (a cada 5 min):
- Detecta telefone com ≥3 mensagens OUT em <30 min → registra `system_logs` nível `error` + marca agendamento `PRECISA_DE_HUMANO`.
- Detecta tipo de mensagem com taxa erro >50% → abre circuit breaker.
- Painel `/admin/logs` já mostra `system_logs`; adicionar filtro "anomalias de envio".

### 6. Backfill / limpeza
- Auditar `mensagens_whatsapp` últimas 7 dias agrupando por telefone+tipo: listar quem recebeu duplicatas.
- Inserir dedup records onde faltar para "congelar" o estado.

### Arquivos afetados
- **Migration**: função `pode_enviar_outbound`, tabela `envio_circuit_breaker`, índices únicos parciais (confirmacao/lembretes/agradecimento).
- **Edge functions** (guard no topo): `enviar-boas-vindas-lead`, `enviar-confirmacao-whatsapp`, `lembrete-consulta-whatsapp`, `lembretes-runner`, `enviar-whatsapp`, `enviar-whatsapp-queue`, `retentar-boas-vindas-pendentes`.
- **Nova edge function**: `monitor-envios-anomalos` + cron schedule (5 min).
- **Frontend**: botão pânico em `src/pages/admin/Configuracoes.tsx` (aba Envios) + badge de circuit breaker aberto.

### Perguntas antes de implementar
1. Quer aplicar **tudo** ou começar só pelos itens 1+4 (rate-limit + botão pânico) que já cobrem 90% do risco?
2. Limites sugeridos acima estão ok ou prefere mais conservador (ex.: boas-vindas 1/72h)?
