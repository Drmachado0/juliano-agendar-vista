# Pausa automática do bot quando humano responde

## Objetivo

Quando alguém da equipe envia uma mensagem manual pelo painel `/admin/whatsapp`, o bot Hermes é **pausado automaticamente** naquela conversa por um período configurável (padrão 30 min). Durante a pausa, o webhook do Hermes continua recebendo mensagens, registra normalmente, mas **não responde**. O card no CRM permanece como está (não vai para "PRECISA_DE_HUMANO" só por causa da pausa) e a UI mostra claramente que o bot está em silêncio.

## Comportamento

1. Secretária envia mensagem pela aba WhatsApp do admin → backend marca `agendamentos.bot_ativo = false` + nova coluna `bot_pausado_ate = now() + 30min`.
2. Paciente responde → `hermes-whatsapp-webhook` registra a mensagem normalmente, mas pula geração/envio de resposta automática enquanto `bot_pausado_ate > now()`.
3. Quando o tempo expira, na próxima mensagem recebida o bot volta a responder sozinho (auto-reativação leve: `bot_ativo = true`, `bot_pausado_ate = null`).
4. Toggle manual no header da conversa permite "Reativar bot agora" ou "Pausar mais 30 min".
5. Indicador visual no header do chat: badge âmbar "Bot pausado · volta em 27 min".

Mensagens automáticas do sistema (lembrete 24h, confirmação, boas-vindas, lembrete anual, avaliação) **não disparam pausa** — apenas mensagens manuais enviadas pelo admin.

## Mudanças

### 1. Banco de dados (migration)
- Adicionar coluna `bot_pausado_ate timestamptz` em `agendamentos` (nullable).
- Adicionar coluna `bot_pausado_por uuid` (auth.users) e `bot_pausa_motivo text` para auditoria.
- Configuração global em uma nova tabela mínima `bot_config` (singleton): `pausa_automatica_minutos int default 30`, `pausa_automatica_ativa boolean default true`. Admin RLS.

### 2. Edge function `enviar-whatsapp`
- Após sucesso de envio com `tipo_mensagem = "manual"` e `agendamento_id` presente: fazer `UPDATE agendamentos SET bot_ativo = false, bot_pausado_ate = now() + interval 'X min', bot_pausa_motivo = 'humano_respondeu'` lendo X de `bot_config`.
- Registrar entrada em `crm_audit_log` (acao: `bot_pausado_auto`).

### 3. Edge function `hermes-whatsapp-webhook`
- No início do processamento de IN, após localizar o agendamento: se `bot_pausado_ate > now()` → registrar mensagem, logar `bot_pausado_skip` em `bot_assistente_log`, retornar 200 sem gerar resposta.
- Se `bot_pausado_ate <= now()` e `bot_ativo = false` por causa de pausa automática (motivo `humano_respondeu`): reativar (`bot_ativo = true, bot_pausado_ate = null, bot_pausa_motivo = null`) e seguir fluxo normal.
- Pausas manuais antigas (status URGENTE / PRECISA_DE_HUMANO) **não** são auto-reativadas — só pausa com motivo `humano_respondeu`.

### 4. Frontend — `WhatsAppChat.tsx`
- Header: badge mostrando estado do bot:
  - Verde: "Bot ativo"
  - Âmbar: "Bot pausado · volta em Xmin" (com countdown)
  - Vermelho: "Bot desligado" (pausa manual / urgente)
- Botões: "Reativar agora" e "Pausar +30 min".
- Atualização via realtime na mudança da row em `agendamentos`.

### 5. Configurações (`/admin/configuracoes`)
- Nova seção "Bot Hermes": toggle "Pausar bot automaticamente quando equipe responde" + input numérico "Tempo de pausa (minutos)" 5–240, default 30.

## Detalhes técnicos

- A pausa só conta se `tipo_mensagem` é `manual` ou `null` (vazio = manual). Tipos automáticos (`lembrete_24h`, `confirmacao`, `boas_vindas`, `avaliacao`, `lembrete_anual`, `bot_pre_agendamento`, `confirmacao_automatica`, `sistema`, `resposta_automatica`) ficam isentos.
- Auto-reativação acontece dentro do webhook em um único UPDATE atômico antes de chamar o gerador de resposta.
- Tempo restante calculado no front com `bot_pausado_ate - now()`; quando chega a zero, badge volta a "Bot ativo" (ainda que o backend só limpe na próxima mensagem — visualmente já está ok).
- `bot_config` é uma tabela com 1 linha; helper `getBotConfig()` cacheia por 60s no edge function.

## Fora do escopo (próximas fases)

- Comando `/stop` via WhatsApp (Fase 3 do plano original).
- Kill switch global / badge no `AdminLayout` (Fase 2).
- Escalonamento por número de mensagens humanas seguidas.
