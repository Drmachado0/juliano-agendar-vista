
# Corrigir URLs do n8n com dominio antigo

## Problema
Quatro arquivos ainda usam o dominio antigo `juliano-n8n.cloudfy.live`, causando erros "Failed to fetch" na pagina de Avaliacoes e potencialmente em outros fluxos.

## Alteracoes

| Arquivo | Linha | URL antiga | URL nova |
|---------|-------|-----------|----------|
| `src/pages/admin/Avaliacoes.tsx` | 127 | `juliano-n8n.cloudfy.live/webhook/avaliacao-google-lovable` | `drmachado-n8n.cloudfy.live/webhook/avaliacao-google-lovable` |
| `src/services/lembretesAnuais.ts` | 34 | `juliano-n8n.cloudfy.live/webhook/avaliacao-google-lovable` | `drmachado-n8n.cloudfy.live/webhook/avaliacao-google-lovable` |
| `src/components/scheduling/SchedulingModal.tsx` | 78 | `juliano-n8n.cloudfy.live/webhook/confirmacao` | `drmachado-n8n.cloudfy.live/webhook/confirmacao` |
| `src/pages/Agendar.tsx` | 56 | `juliano-n8n.cloudfy.live/webhook/confirmacao` | `drmachado-n8n.cloudfy.live/webhook/confirmacao` |

## Detalhes tecnicos
- Substituicao simples de dominio em 4 arquivos
- Os paths dos webhooks permanecem iguais (`/webhook/avaliacao-google-lovable` e `/webhook/confirmacao`)
- Nenhuma alteracao de logica, apenas atualizacao do dominio
- Corrige os erros "Failed to fetch" vistos na pagina de Avaliacoes e tambem previne falhas no fluxo de agendamento do site
