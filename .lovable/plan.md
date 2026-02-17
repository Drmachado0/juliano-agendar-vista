
# Corrigir "Failed to fetch" no sistema de Avaliacoes

## Diagnostico
O erro "Failed to fetch" ocorre porque o frontend faz uma chamada direta do navegador para o webhook do n8n (`https://drmachado-n8n.cloudfy.live/webhook/avaliacao-google-lovable`). Isso falha por **CORS** (o servidor n8n nao aceita requisicoes do dominio do Lovable) ou porque o servidor n8n esta temporariamente inacessivel.

## Solucao
Criar uma funcao backend que atua como proxy, fazendo a chamada ao n8n do lado do servidor (onde nao ha restricao de CORS).

## Alteracoes

### 1. Criar funcao backend `buscar-pacientes-n8n`
- **Arquivo:** `supabase/functions/buscar-pacientes-n8n/index.ts`
- Recebe `{ data_atendimento: string }` do frontend
- Faz o POST para o webhook do n8n usando o secret `N8N_WEBHOOK_URL` (ja configurado)
- Retorna a resposta do n8n para o frontend
- Inclui tratamento de erros (timeout, n8n offline, resposta invalida)

### 2. Atualizar `src/pages/admin/Avaliacoes.tsx`
- Substituir a chamada direta `fetch(N8N_WEBHOOK_URL, ...)` (linha 733) por `supabase.functions.invoke('buscar-pacientes-n8n', ...)`
- Remover a constante `N8N_WEBHOOK_URL` hardcoded (linha 127), pois o URL ficara apenas no secret do backend
- Manter toda a logica de filtragem de pacientes pendentes inalterada

## Detalhes tecnicos

### Funcao backend (proxy)
```
POST /buscar-pacientes-n8n
Body: { data_atendimento: "2026-02-06" }
-> Faz POST para N8N_WEBHOOK_URL com o mesmo body
-> Retorna resposta do n8n (lista de pacientes)
```

### Seguranca
- A funcao requer autenticacao (usuario logado)
- O URL do n8n fica protegido no backend (secret), sem exposicao no codigo frontend
