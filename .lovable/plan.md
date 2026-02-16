

# Atualizar Credenciais da Evolution API

## Resumo

Atualizar os 3 secrets da Evolution API no backend para apontar para a nova instancia.

## Passo 1 -- Solicitar os novos valores via ferramenta de secrets

Usar a ferramenta `add_secret` para cada um dos 3 secrets:

| Secret | Novo Valor |
|--------|-----------|
| `EVOLUTION_API_BASE_URL` | `https://drmachado-evolution.cloudfy.live` |
| `EVOLUTION_API_INSTANCE` | `n8n` |
| `EVOLUTION_API_TOKEN` | (voce informara o novo token) |

Os dois primeiros ja tem valores conhecidos. Para o token, sera solicitado que voce cole o valor.

## Passo 2 -- Testar a conexao

Chamar a edge function `verificar-status-evolution` para confirmar que a nova instancia responde corretamente.

## Detalhes tecnicos

- Nenhuma alteracao de codigo necessaria
- Todas as edge functions leem os valores dinamicamente via `Deno.env.get()`
- O `evolutionApiClient.ts` compartilhado ja normaliza a URL removendo barras finais
- O badge de status no admin refletira o novo estado automaticamente

