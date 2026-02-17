
# Corrigir recebimento de mensagens de pacientes no WhatsApp

## Diagnostico

Ao analisar o banco de dados, confirmei que:
- **Nao ha mensagens IN (recebidas) desde dezembro de 2025**
- A funcao backend `receber-whatsapp` nao esta sendo chamada (zero logs recentes)
- As mensagens enviadas (OUT) estao funcionando normalmente

O problema principal e que o **webhook da Evolution API nao esta configurado** para enviar as respostas dos pacientes para o sistema. Alem disso, mesmo quando funcionava antes, as mensagens recebidas ficavam sem vinculo com o agendamento correto (`agendamento_id: null`).

## Solucao em 2 partes

### Parte 1: Configurar webhook automaticamente na Evolution API

Criar uma funcao que registra o webhook na Evolution API automaticamente, para que toda resposta de paciente seja encaminhada ao sistema.

- **Novo arquivo:** `supabase/functions/configurar-webhook-evolution/index.ts`
  - Faz PUT/POST na API da Evolution (`/webhook/set/{instance}`) configurando a URL do `receber-whatsapp` como endpoint de webhook
  - Eventos: `messages.upsert` (mensagens recebidas)
  - Usa os secrets `EVOLUTION_API_BASE_URL`, `EVOLUTION_API_TOKEN`, `EVOLUTION_API_INSTANCE`

- **Atualizar:** `src/pages/admin/ConfiguracoesEvolution.tsx`
  - Adicionar botao "Configurar Webhook" na pagina de configuracoes
  - Mostrar status atual do webhook (configurado/nao configurado)

### Parte 2: Melhorar vinculacao de mensagens recebidas

- **Atualizar:** `supabase/functions/receber-whatsapp/index.ts`
  - Melhorar o matching de telefone: o agendamento salva `91981849947` mas a busca compara com formatos diferentes
  - Garantir que o `agendamento_id` seja encontrado corretamente usando busca pelos ultimos 8 digitos sem depender de formatacao

- **Atualizar:** `src/services/mensagens.ts` (funcao `listarMensagensPorAgendamento`)
  - Melhorar a busca por telefone para tambem incluir o formato sem codigo de pais (ex: `91981849947` vs `5591981849947`)
  - Garantir que mensagens com `agendamento_id: null` mas telefone correspondente aparecam no chat

## Detalhes tecnicos

### Funcao `configurar-webhook-evolution`

```
POST /configurar-webhook-evolution
Body: { action: "set" }

-> Chama Evolution API: PUT /webhook/set/{instance}
   Body: {
     url: "https://{SUPABASE_URL}/functions/v1/receber-whatsapp",
     webhook_by_events: false,
     events: ["MESSAGES_UPSERT"]
   }

-> Retorna: { success: true, webhook_url: "..." }
```

### Melhoria no matching de telefone (receber-whatsapp)

Problema atual: o agendamento tem `telefone_whatsapp: 91981849947` e a busca usa `ilike %XXXX` (ultimos 4 digitos), o que pode retornar matches incorretos.

Correcao: usar os ultimos 8 digitos de forma mais robusta, normalizando o telefone do agendamento antes de comparar.

### Arquivos afetados
1. `supabase/functions/configurar-webhook-evolution/index.ts` (novo)
2. `supabase/functions/receber-whatsapp/index.ts` (ajuste no matching)
3. `src/services/mensagens.ts` (melhoria na busca por telefone)
4. `src/pages/admin/ConfiguracoesEvolution.tsx` (botao de configurar webhook)
