## Etapa 3 mobile-first: horários com legenda e seleção rápida

### Objetivo
Reduzir abandono na Etapa 3 melhorando a usabilidade mobile do `TimeSlotPicker`: mostrar mais opções de uma vez, com agrupamento por período, seleção rápida e legenda clara de disponibilidade.

### Alterações

**1. `src/components/scheduling/TimeSlotPicker.tsx` (refatorar)**
- **Remover o slice aleatório de 3 horários** — exibir todos os slots disponíveis.
- **Agrupar por período**: Manhã (até 12h), Tarde (12h–18h), Noite (18h+). Cada grupo com mini-cabeçalho (ícone `Sun` / `Sunset` / `Moon` + contador).
- **Grid responsivo**: `grid-cols-3` no mobile (botões h-12, touch-friendly) e `grid-cols-4` no desktop (h-11).
- **Quick picks** no topo (chips horizontais): "Próximo livre", "Manhã", "Tarde", "Noite" — filtram a visualização. Estado local `filtroPeriodo`.
- **Badge "Últimos"** (âmbar) no cabeçalho do período quando restam ≤2 slots — transmite escassez sem pressionar.
- **Legenda visual** abaixo do grid:
  - 🟦 Disponível
  - 🟪 Selecionado
  - 🟧 Poucos restantes
- **Scroll suave** até o resumo (`#summary-anchor`) ao selecionar um horário no mobile, garantindo feedback imediato.
- Manter auto-refresh de 30s, skeleton de loading e estado vazio.

**2. `src/components/scheduling/DateTimeStep.tsx` (ajustes)**
- Adicionar `id="summary-anchor"` ao bloco de resumo para o scroll do TimeSlotPicker.
- Reduzir densidade no mobile: `gap-4 md:gap-6` no grid e `p-3 md:p-4` nos cards.
- Tornar o resumo de seleção **sticky bottom** no mobile (`sticky bottom-2` + sombra leve), via `useIsMobile()`, para que o paciente sempre veja a confirmação ao rolar a lista de horários.

### Resultado esperado
- Mobile: usuário vê todos os horários organizados por turno, escolhe com 1 toque, recebe feedback visual imediato no resumo fixo no rodapé.
- Legenda explícita reduz dúvidas sobre o que cada cor significa.
- Quick picks e agrupamento aceleram a decisão, especialmente em dias com muitos slots.

### Arquivos
- `src/components/scheduling/TimeSlotPicker.tsx`
- `src/components/scheduling/DateTimeStep.tsx`