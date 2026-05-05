# Histórico de conversas no card do Kanban

Adicionar botão "Histórico" em cada card do Kanban que abre um modal mostrando todas as mensagens WhatsApp trocadas com aquele paciente (IN/OUT, agrupadas por dia, em tempo real).

## Mudanças

### 1. Novo componente `src/components/admin/HistoricoConversaModal.tsx`
- Recebe `agendamento`, `isOpen`, `onClose`.
- Ao abrir, chama `listarMensagensPorAgendamento(agendamento.id, telefone)` (já existe em `src/services/mensagens.ts` — cobre mensagens ligadas ao id e mensagens órfãs por telefone).
- Subscreve realtime na tabela `mensagens_whatsapp` (canal `historico-{id}`) e recarrega quando há mudança.
- Layout: `Dialog` com `max-w-2xl h-[80vh]`, header com nome + telefone + contador, corpo com `ScrollArea`.
- Mensagens agrupadas por dia com separador (`dd 'de' MMMM 'de' yyyy`).
- Reusa `WhatsAppMessageBubble` para renderizar cada bolha (já trata IN/OUT + status enviado/entregue/lido).
- Estados: loading (spinner), vazio ("Nenhuma mensagem trocada ainda"), lista normal.

### 2. `src/components/admin/KanbanCard.tsx`
- Importar `History` de `lucide-react` e `HistoricoConversaModal`.
- Adicionar state local `historicoOpen`.
- Adicionar botão `History` na barra de ações (ao lado de WhatsApp/Automação/Sandbox), tooltip "Histórico de conversas".
- Renderizar `<HistoricoConversaModal agendamento={agendamento} isOpen={historicoOpen} onClose={...} />` no fim do card.
- O botão usa `e.stopPropagation()` para não disparar drag.

## Sem mudanças
- Sem migrações, sem edge functions, sem novos serviços (toda infra já existe).
- Não mexe em CRM.tsx nem em KanbanColumn — modal é local ao card.

## Resultado
Cada card no Kanban ganha um ícone de histórico (clock/history). Clicar abre um modal com a thread completa do WhatsApp daquele paciente, atualizando em tempo real, sem precisar sair do CRM ou abrir a página de WhatsApp.