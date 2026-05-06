## Plano: Refresh visual da /admin/crm (sem mexer em lógica)

Objetivo: melhorar hierarquia visual, espaçamento, tipografia e contraste no modo escuro, mantendo TODOS os dados, props, services, status, drag-and-drop, filtros, modais, integrações e edge functions intactos.

### O que NÃO muda
- `src/services/agendamentos.ts`, `crmAudit.ts`, `integracoes.ts` e demais services.
- Nomes de status (`NOVO LEAD`, `AGUARDANDO HUMANO`, `AGUARDANDO`, `CLINICOR`, `HGP`, `BELÉM`, `ATENDIDO`).
- Lógica de filtros, ordenação, sandbox, drag-and-drop, realtime, polling, cálculo de métricas.
- Props/handlers de `KanbanColumn`, `KanbanCard`, `CRMFilters`, `AgendamentoDetailsModal`, `WhatsAppModal`, `AuditLogDrawer`, `DuplicadosDrawer`, `WhatsAppContatos`.
- Banco, RLS, edge functions, rotas, auth.

### Arquivos a editar (apenas JSX/Tailwind)

1. `src/pages/admin/CRM.tsx`
   - Header: título com selo "Oftalmologia", subtítulo discreto, badges de leads/agendados/atendidos/total reorganizados como linha única com ícones em círculo neutro.
   - Botões da direita (Reprocessar / Duplicados / Auditoria / Atualizar): agrupar com `divide-x`, tamanhos uniformes, ícone-only no mobile.
   - Cards de Taxa de Conversão / Conclusão: virar grid de 4 mini-cards (Leads, Agendados, Atendidos, Conversão %) + 1 card largo com as duas progress bars lado a lado, padding menor, número grande mas leve (`font-semibold`), barras mais finas.
   - Tabs: ajustar para visual mais sóbrio (underline em vez de pill se já houver suporte; manter o componente shadcn).
   - Container do Kanban: `gap-4`, scrollbar customizada já existe (`kanban-scroll`), padding inferior maior para sombra.

2. `src/components/admin/KanbanColumn.tsx`
   - Largura uniforme `w-[280px]` em todos breakpoints ≥sm; mobile mantém `w-[220px]`.
   - Header da coluna: pílula com nome + contador, fundo `bg-card/60` translúcido, borda sutil topo na cor do status.
   - Estado vazio: ícone discreto + texto "Nenhum paciente nesta etapa.".
   - Background da coluna mais sutil (`bg-muted/20`), borda fina, `rounded-2xl`.

3. `src/components/admin/KanbanCard.tsx`
   - Reordenar visualmente (sem remover nada): Nome em destaque (text-sm font-semibold) → telefone com ícone → bloco data/hora consulta com fundo destacado quando existir → linha de badges (unidade + tipo + convênio) → indicadores → rodapé de ações.
   - Bloco "Contato: dd/mm" e "Boas-vindas" colapsam em uma linha de meta-info menor, com cor mais discreta.
   - Selo Sandbox menor, no canto superior direito.
   - Botões de ação: redondos `h-7 w-7`, espaçamento consistente, hover com `bg-accent` em vez de cores específicas (verde/azul/laranja viram tint suave).
   - Badge de unidade com cor da paleta institucional: Clinicor azul, HGP roxo, Belém âmbar (já existe; só refinar sombra/borda).
   - Bordas mais arredondadas (`rounded-xl`), sombra `shadow-sm hover:shadow-md`, transição suave.

4. `src/components/admin/CRMFilters.tsx`
   - Header dos filtros mais discreto, contagem em badge à direita.
   - Toggle Sandbox como `ToggleGroup` visual (segmented), menor.
   - Grid: busca ocupa 2 colunas grandes; selects com altura uniforme `h-9`; botão "Limpar" com ícone à direita.
   - Espaçamento `gap-2.5` e `p-3` para ficar mais compacto.

### Garantias técnicas
- Todas as props, callbacks e nomes de variáveis preservados.
- Nenhum import novo de lib externa; só reorganizar classes Tailwind e usar componentes shadcn já presentes (Badge, Button, Tooltip).
- Tokens semânticos (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`) — sem hex/HSL hard-coded fora do que já existe.

### Fora do escopo (não mexerei)
- Modal de detalhes (`AgendamentoDetailsModal`), Drawers de Auditoria/Duplicados, aba Contatos: pediu para "se já existir, apenas melhorar o visual" — fica para uma fase 2 sob demanda, para não arriscar nesta rodada conservadora.

Posso aplicar?
