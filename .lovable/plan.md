## Objetivo
Adicionar uma seção de **Legenda** colapsável no CRM Kanban (`/admin/crm`) explicando o significado de cada badge (unidade, tipo, convênio) e dos indicadores visuais (cores de borda de urgência, selo TESTE, timer), para acelerar a triagem.

## Onde aparece
Logo acima da barra de filtros (`<CRMFilters />`) no `src/pages/admin/CRM.tsx`, dentro da aba "Kanban". Por padrão **fechada**, com botão "Legenda dos cards" para expandir — assim não polui a tela de quem já conhece.

## Componente novo: `src/components/admin/CRMLegenda.tsx`
Card colapsável (estilo `bg-muted/20 rounded-xl border`) com 4 colunas (responsivo: 1/2/4):

1. **Unidade de atendimento** (badges com cores reais usadas no card)
   - 🔵 **Clinicor** — Atendimento preferencial pela manhã
   - 🟣 **HGP** — Atendimento preferencial à tarde
   - 🟡 **Belém** — Encaminhamento para clínicas parceiras (IOB / Vitria)

2. **Tipo de atendimento**
   - Consulta — Primeira consulta oftalmológica
   - Retorno — Reavaliação
   - Exame — Visual, OCT, mapeamento, etc.
   - Cirurgia — Catarata, pterígio, refrativas

3. **Convênio**
   - Particular — Pagamento direto
   - Bradesco / Unimed / Cassi / Sul América — Convênios aceitos
   - Outro — Convênio descrito manualmente

4. **Urgência e indicadores**
   - Borda verde — ≤ 2 dias na fase
   - Borda amarela — > 2 dias parado
   - Borda vermelha — > 7 dias (urgente)
   - Timer "Nd" — dias desde criação do lead
   - Selo TESTE (laranja) — sandbox, fora das métricas

Reutiliza as MESMAS classes de cor do `KanbanCard.tsx` (`localBadgeColors`) para garantir consistência visual perfeita.

## Edição em `src/pages/admin/CRM.tsx`
- Importar `CRMLegenda`.
- Renderizar `<CRMLegenda />` imediatamente antes de `<CRMFilters ... />` (linha ~568).

## Não muda
- Nenhum dado, RLS, estrutura de cards, filtros ou lógica do Kanban.
- Puramente visual/informativo.
