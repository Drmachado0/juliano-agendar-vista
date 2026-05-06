## Problema

1. **Tela treme ao usar filtros** — quando um `Select` (Radix) abre, ele bloqueia o scroll do `body` e remove a barra de rolagem, fazendo todo o conteúdo "saltar" alguns pixels para a direita e voltar ao fechar. Combinado com o re-render do Kanban filtrado, dá a sensação de tremor.
2. **Painel de filtros ocupa muito espaço** — sempre visível com 6 colunas + barra superior, consumindo altura útil acima do Kanban.

## Solução

### 1. Estabilizar a largura da página (fim do tremor)

Em `src/index.css`, reservar espaço permanente para a scrollbar:

```css
html {
  scrollbar-gutter: stable;
}
```

Isso impede que abrir/fechar Selects, Dialogs e Drawers altere a largura do conteúdo. Resolve o tremor em todo o admin, não só no CRM.

### 2. Tornar o painel de filtros recolhível

Em `src/components/admin/CRMFilters.tsx`:

- Adicionar estado `collapsed` persistido em `localStorage` com chave `crm:filters:collapsed:v1` (default: **recolhido**, para liberar espaço imediatamente).
- Cabeçalho do painel passa a mostrar:
  - Ícone + "Filtros" + contador `X/Y` (já existe).
  - **Resumo dos filtros ativos** como chips inline quando recolhido (ex.: "Local: Clinicor", "Período: Hoje"), com `X` para remover individualmente.
  - Botão "Limpar" (já existe, só quando há filtros).
  - **Botão chevron** à direita para expandir/recolher (`ChevronDown`/`ChevronUp`).
  - Toda a linha do cabeçalho fica clicável para alternar.
- Grid de inputs (busca + 4 selects + ordenação) só renderiza quando expandido, com transição suave de altura.
- Sandbox segmented continua visível no cabeçalho (afeta o que aparece no Kanban e o usuário precisa ver sempre).
- Busca rápida: manter o input de busca **sempre visível** no cabeçalho (compacto, ~240px) mesmo recolhido — é o filtro mais usado.

### 3. Pequenos ajustes de estabilidade

- Adicionar `min-h-0` no container do Kanban para evitar reflow vertical quando o painel colapsa.
- Garantir `transition-[max-height]` suave (200ms) no bloco expansível para a animação não parecer brusca.

## Arquivos afetados

- `src/index.css` — adicionar `scrollbar-gutter: stable`.
- `src/components/admin/CRMFilters.tsx` — refatorar para recolhível com chips de filtros ativos e busca sempre visível.

## Resultado esperado

- Nenhum salto horizontal ao abrir Selects, modais ou drawers em qualquer página do admin.
- CRM abre com filtros recolhidos por padrão, mostrando só cabeçalho + busca + chips dos filtros ativos, devolvendo ~120px de altura para o Kanban.
- Estado de recolhido fica salvo entre sessões.
