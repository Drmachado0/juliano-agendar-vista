## Objetivo

Reduzir ruído visual nos cards do Kanban e estabelecer uma hierarquia clara de cores: borda = urgência, local = cor de marca, origem = indicador discreto (só destaca quando NÃO é "Site"), tipo+convênio = texto neutro.

## Mudanças

### 1. `src/components/admin/KanbanCard.tsx`

**1.1 Nova paleta de Local (consolidada com a marca Navy/Gold + Teal)**
- Clinicor – Paragominas → **teal** (era azul)
- Hospital Geral de Paragominas → **âmbar** (era roxo)
- Belém (IOB / Vitria) → **violet** (era âmbar)

Resultado: Local deixa de competir com a borda lateral de urgência (verde/amarelo/vermelho) e com o badge de origem.

**1.2 Origem vira chip no canto superior direito (estilo selo "Teste")**
- Renderizado **apenas quando o grupo não é `site`** (default → invisível, removendo ruído de ~80% dos cards).
- Aparece como mini-chip absoluto no `-top-1.5 -right-1.5`, igual o selo "Teste".
- Quando há AMBOS sandbox e origem-não-site, o de origem fica deslocado para a esquerda (`right: 60px` aprox.) para não sobrepor.
- Cores discretas (paleta sóbria): n8n=violet, WhatsApp=emerald, Meta=pink, Outro=cinza.
- Tooltip mantém origem bruta (ex.: "Origem: mcp (n8n / Bot)").

**1.3 Remover badge de Origem da linha de badges**
A linha agora terá só: **Local** (colorido) + **Tipo · Convênio** como texto inline neutro.

**1.4 Tipo + Convênio viram texto inline**
Substituir os 2 badges neutros por uma linha de texto pequena com separador "·":
```
Consulta · Particular
```
Em vez de dois badges. Mantém leitura mas economiza espaço vertical e reduz ruído.

### 2. `src/lib/origemLead.ts`
Ajustar `ORIGEM_BADGE_CLASSES` para um tom mais sóbrio adequado ao chip flutuante (fundo sólido suave + texto branco em modo escuro), padrão similar ao selo "Teste" laranja:
- n8n: `bg-violet-500 text-white`
- whatsapp: `bg-emerald-500 text-white`
- meta: `bg-pink-500 text-white`
- outro: `bg-muted-foreground text-background`
- site: (não usado — não renderiza)

Manter as cores antigas (versão "soft" com /15) em uma constante separada `ORIGEM_BADGE_SOFT_CLASSES` caso seja útil em outros lugares (filtros, legenda).

### 3. `src/components/admin/CRMLegenda.tsx`
Atualizar a legenda das cores de Local para refletir a nova paleta (teal/âmbar/violet).

## Mockup do card depois

```
                              [🤖 n8n]   ← só aparece se origem ≠ site
┃ Cleiton Gustavo Conceição D.
┃ 📞 91985291927
┃ ┌────────────────────┐
┃ │ 📅 22/04/26 ⏰ 14:00│
┃ └────────────────────┘
┃ [HGP]   Consulta · Particular
┃ 👤 22/04/26  ⏱ 13d  🔔
┃ ✈ BV · Enviada
┃ ─────────────────────
┃ 💬 🕐 ⚡ 🧪 👁 Detalhes
```

## O que NÃO muda
- Borda lateral de urgência (verde/amarelo/vermelho) — continua sendo o único elemento "gritante".
- Selo "Teste" laranja no canto.
- Filtros, ordenação, ações e tooltips dos detalhes.
- Mapeamento `getOrigemGrupo` e o filtro de Origem do CRMFilters.
