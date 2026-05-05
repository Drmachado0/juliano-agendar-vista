# Adicionar aba "Contatos" no CRM

Hoje `/admin/crm` mostra direto o Kanban. A página `/admin/whatsapp` já tem uma aba "Contatos" funcional usando o componente `WhatsAppContatos` (que lista contatos únicos por telefone, com busca, edição e exclusão).

A proposta é embrulhar o conteúdo do CRM em `Tabs` com duas abas:

1. **Kanban** (default) — todo o conteúdo atual da página (header de stats, filtros, colunas Kanban, modais).
2. **Contatos** — reusa `<WhatsAppContatos />` já existente.

## Mudanças

### `src/pages/admin/CRM.tsx`
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs` e `WhatsAppContatos`.
- Adicionar state `tab: "kanban" | "contatos"` (default `"kanban"`, persistido em `localStorage` `crm:tab:v1` para manter a aba escolhida entre navegações).
- Logo abaixo do `<h1>CRM Kanban</h1>` + badges de stats, inserir `<TabsList>` com os dois triggers.
- Envolver o bloco atual (filtros + grid de `KanbanColumn` + modais) dentro de `<TabsContent value="kanban">`.
- Adicionar `<TabsContent value="contatos">` renderizando `<WhatsAppContatos onAbrirChat={(tel) => navigate('/admin/whatsapp')} />` (ao clicar em "Abrir conversa" leva para a página de WhatsApp — mesmo padrão já usado lá; podemos passar o telefone via query string `?telefone=` numa iteração futura, mas por enquanto só navegar é suficiente e consistente).
- O header com stats (leads/agendados/atendidos/total), o `EvolutionStatusBadge`, "Última atualização" e botões "Reprocessar boas-vindas" / "Auditoria" / "Duplicados" continuam acima das tabs (válidos para ambas).

### Detalhes técnicos
- Não mexer em `WhatsAppContatos.tsx` — ele já é genérico e aceita `onAbrirChat: (telefone: string) => void`.
- Não criar tabela nova nem edge function. Sem migrações.
- Visual: `TabsList` alinhada à esquerda, mesmo estilo da página WhatsApp (`self-start mb-3`).

## Resultado
Ao entrar em `/admin/crm` o usuário vê duas abas no topo: **Kanban** (atual) e **Contatos** (lista única de pacientes por telefone, com busca, editar e apagar — mesma UX da aba já existente em `/admin/whatsapp`).