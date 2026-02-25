

## Revisao Completa do Fluxo de Agendamento

### Status Atual

O fluxo de agendamento esta funcionando quase 100%. Todas as edge functions criticas estao operando corretamente:

- **criar-lead**: OK - Cria lead no banco
- **validar-agendamento**: OK - Valida disponibilidade (corrigido nesta sessao)
- **confirmar-agendamento-whatsapp**: OK - Envia WhatsApp (corrigido nesta sessao)
- **notificar-agendamento-email**: OK - Envia email com sucesso
- **enviar-boas-vindas-lead**: OK - Executa a cada 2 min, nenhum lead pendente

### Unico Bug Encontrado

**`notificar-n8n`** - Erro "Body already consumed"

Na funcao `notificar-n8n`, quando a resposta do n8n e bem-sucedida, o codigo tenta ler o body com `.json()` e, se falhar, tenta `.text()`. O problema e que `.json()` ja consome o body internamente, entao o fallback `.text()` falha com "Body already consumed".

### Correcao

**Arquivo: `supabase/functions/notificar-n8n/index.ts`**

Substituir as linhas 176-181 para ler o body uma unica vez como texto e depois tentar parsear como JSON:

```text
ANTES:
  let n8nData;
  try {
    n8nData = await n8nResponse.json();
  } catch {
    n8nData = await n8nResponse.text();
  }

DEPOIS:
  let n8nData;
  const responseText = await n8nResponse.text();
  try {
    n8nData = JSON.parse(responseText);
  } catch {
    n8nData = responseText;
  }
```

Esta correcao le o body uma unica vez como texto e depois tenta converter para JSON via `JSON.parse`, evitando o erro de consumo duplo do body.

### Impacto

- Baixo risco: a funcao `notificar-n8n` ja retorna `success: true` mesmo em caso de erro (para nao bloquear o fluxo principal)
- A correcao garante que os logs do n8n sejam registrados corretamente sem erro

