## Objetivo
No `AuditLogDrawer`, cada entrada de auditoria que tiver `agendamento_id` ganha um link/botão direto para abrir o **modal de detalhes do agendamento** (`AgendamentoDetailsModal`) e um atalho para **abrir o WhatsApp** com o paciente. Hoje o drawer apenas mostra o nome/telefone como texto estático.

## Mudanças

### 1. `src/components/admin/AuditLogDrawer.tsx`
- Adicionar props opcionais:
  - `onOpenAgendamento?: (agendamentoId: string) => void`
  - `onOpenWhatsApp?: (agendamentoId: string, telefone: string) => void`
- Na renderização de cada item:
  - Transformar o nome do paciente em **botão/link** (ícone `ExternalLink`) que chama `onOpenAgendamento(e.agendamento_id)`.
  - Adicionar um botão pequeno ao lado com ícone `MessageCircle` que chama `onOpenWhatsApp` (passando telefone do `e.agendamento.telefone_whatsapp`).
  - Ambos só aparecem quando `e.agendamento_id` existe e o callback foi passado.
- Fechar o drawer ao clicar no link (chamar `onOpenChange(false)` antes de disparar o callback) para o modal ficar visível.

### 2. `src/pages/admin/CRM.tsx`
- Criar handler `handleOpenAgendamentoFromAudit(id)`:
  - Procurar o agendamento dentro de `agendamentosPorStatus` (todos os status). Se encontrado → `setSelectedAgendamento(...)` + `setDetailsModalOpen(true)`.
  - Caso não encontrado em memória (ex.: já arquivado/excluído), buscar via `buscarAgendamento(id)` de `src/services/agendamentos.ts` e abrir o modal; se também falhar, mostrar `toast` "Agendamento não encontrado (pode ter sido excluído)".
- Criar handler `handleOpenWhatsAppFromAudit(id, telefone)` com a mesma lógica (busca local → fallback no service) e abrir `WhatsAppModal`.
- Passar ambos para `<AuditLogDrawer ... onOpenAgendamento={...} onOpenWhatsApp={...} />`.

### 3. UX detalhe
- Quando o agendamento foi removido (ex.: unificação de duplicados), o link fica desabilitado com tooltip "Registro removido".
  - Detectado quando `e.agendamento` (join) vier `null` mesmo com `agendamento_id` preenchido.

## Arquivos afetados
- `src/components/admin/AuditLogDrawer.tsx` (edit)
- `src/pages/admin/CRM.tsx` (edit)

## Não muda
- Sem alterações de banco / RPC / edge functions.
- `crmAudit.ts` e schema permanecem iguais — o join `agendamento:agendamentos(...)` já traz os dados necessários.
