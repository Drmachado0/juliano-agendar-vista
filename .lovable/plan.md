## Objetivo
Adicionar um toggle "Compacto / Confortável" no CRM (`/admin/crm`) que ajusta densidade visual do Kanban (cards, colunas) e dos filtros, sem alterar lógica, dados ou comportamento.

## Persistência
Preferência salva em `localStorage` (`crm:density:v1`). Default: **Compacto** (estado atual). Aplicada via Context para todos os filhos.

## Arquivos novos

### `src/hooks/useDensity.tsx`
Provider + hook `useDensity()` que expõe `{ density, isCompact, isComfortable, setDensity, toggle }`. Persiste em localStorage. Tem fallback seguro caso usado fora do provider (assume compact).

## Arquivos alterados

### `src/pages/admin/CRM.tsx`
1. Importar `DensityProvider` e `useDensity`.
2. Envolver o `AdminLayout` (ou só o conteúdo da aba Kanban) com `<DensityProvider>`.
3. No header da página, ao lado dos badges de métricas, adicionar um **segmented toggle** "Compacto | Confortável" (estilo do toggle de Sandbox que já existe no `CRMFilters`).

### `src/components/admin/KanbanColumn.tsx`
- Ler `useDensity()`.
- Largura: `w-[220px] sm:w-[280px]` (compact) → `sm:w-[320px]` (comfortable).
- Padding container: `p-3` → `p-4` em comfortable.
- Espaçamento entre cards: `space-y-2` → `space-y-3`.
- Header: tamanhos atuais ficam para compact; em comfortable, `text-sm` → `text-[15px]`, badge contador `text-xs` → `text-sm`.

### `src/components/admin/KanbanCard.tsx`
- Ler `useDensity()`.
- Padding card: `p-3` → `p-4` em comfortable.
- `space-y-2` interno → `space-y-2.5`.
- Nome: `text-sm` (compact) → `text-[15px] leading-snug` (comfortable).
- Telefone: `text-xs` → `text-sm` em comfortable.
- Bloco data/hora: `text-xs px-2 py-1.5` → `text-sm px-3 py-2` em comfortable.
- Badges (unidade/tipo/convênio): `text-[10px] px-1.5 py-0.5` → `text-[11px] px-2 py-0.5`.
- Botões de ação: `h-7 w-7` → `h-8 w-8`, ícones `h-3.5` → `h-4`.

### `src/components/admin/CRMFilters.tsx`
- Ler `useDensity()`.
- Padding container: `p-3` → `p-4` em comfortable.
- Selects/inputs: classe `[&_button[role=combobox]]:h-9 [&_input]:h-9` → `h-10` em comfortable.
- Gap do grid: `gap-2.5` → `gap-3` em comfortable.
- Labels: `text-xs` → `text-[13px]` em comfortable.

## Implementação do toggle (UI)
Botão segmentado igual ao do Sandbox (componente inline no header da página), com 2 opções:
- "Compacto" (ícone `Rows3` ou `LayoutList`)
- "Confortável" (ícone `Rows2` ou `LayoutGrid`)
Visualmente: `flex rounded-md border border-border/70 overflow-hidden text-xs`, opção ativa com `bg-primary text-primary-foreground`.

## Não muda
- Nenhuma lógica de filtragem, ordenação, drag-and-drop, dados, RLS ou edge functions.
- Apenas dimensões/espaçamentos visuais condicionais.
- Tooltips e legenda já adicionados continuam funcionando.
