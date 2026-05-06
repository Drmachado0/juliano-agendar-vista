## Objetivo
Adicionar tooltips informativos nos cards do Kanban (`/admin/crm`) para que, ao passar o mouse, seja possível ver os detalhes completos do paciente e do agendamento, mesmo quando o conteúdo está truncado no card.

## Onde
`src/components/admin/KanbanCard.tsx` — único arquivo a alterar. O `TooltipProvider` já envolve o card.

## Mudanças

### 1. Tooltip no header (Nome + Telefone)
Envolver o bloco `Nome / Phone` em `<Tooltip>`. Conteúdo do tooltip:
- **Nome** completo (sem truncar)
- **Telefone**
- **E-mail** (se existir)
- **Data de nascimento** (formatada `dd/MM/yyyy` se existir)
- **Local de atendimento** completo
- **Tipo de atendimento**
- **Convênio** (ou `convenio_outro` se for "Outro")
- **Detalhe** do exame/cirurgia (se existir)
- **Observações internas** (se existir, separado por linha)

### 2. Tooltip no bloco Data/Hora
Envolver o bloco `Calendar + Clock` em `<Tooltip>` quando o agendamento tem data/hora. Conteúdo:
- Data por extenso: `EEEE, dd 'de' MMMM 'de' yyyy` (pt-BR), ex.: "quinta-feira, 30 de junho de 2025"
- Horário no formato `HH:mm`

### 3. Cursor visual
Usar `cursor-help` nos triggers para indicar que há informação adicional ao passar o mouse.

## Não muda
- Tooltips já existentes (timestamps no rodapé, status de boas-vindas, sandbox, botões de ação) permanecem intactos.
- Nenhuma alteração de dados, layout ou lógica — apenas adição de tooltips.
