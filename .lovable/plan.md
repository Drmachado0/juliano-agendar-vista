## Objetivo

Permitir identificar visualmente de onde veio cada lead/agendamento (n8n, WhatsApp, Site, Meta Ads etc.) direto no card do Kanban, e filtrar a coluna por origem.

## Mapeamento de origens

Valores existentes hoje na tabela `agendamentos.origem`: `site`, `mcp`, `whatsapp`, `whatsapp_manual`, `fb`, `ig`, `soak_test_2`.

Agrupamento exibido na UI:

| Grupo (UI) | Valores no banco | Cor do badge |
|---|---|---|
| Site | `site` | azul |
| n8n / Bot | `mcp` | violeta |
| WhatsApp | `whatsapp`, `whatsapp_manual` | verde |
| Meta Ads | `fb`, `ig` | rosa |
| Outro | qualquer outro (ex.: `soak_test_2`) | cinza |

Helper centralizado em `src/lib/origemLead.ts` exportando:
- `type OrigemGrupo = 'site' | 'n8n' | 'whatsapp' | 'meta' | 'outro'`
- `getOrigemGrupo(origem?: string | null): OrigemGrupo`
- `ORIGEM_LABELS` e `ORIGEM_BADGE_CLASSES` (cores Tailwind no padrão dos outros badges do card).

## Mudanças

### 1. `src/lib/origemLead.ts` (novo)
Funções e constantes de mapeamento descritas acima.

### 2. `src/components/admin/KanbanCard.tsx`
- Adicionar um badge pequeno na linha de badges existente (logo após o local), usando `ORIGEM_LABELS[grupo]` e cor de `ORIGEM_BADGE_CLASSES[grupo]`.
- Tooltip mostrando a origem bruta (ex.: "Origem: mcp (n8n / Bot)").
- Ícone discreto por grupo (Globe/site, Bot/n8n, MessageCircle/whatsapp, Megaphone/meta).

### 3. `src/components/admin/CRMFilters.tsx`
- Adicionar campo `origem?: OrigemGrupo` em `CrmFilters`.
- Novo `Select` "Origem" no grid expandido com opções: Todas, Site, n8n / Bot, WhatsApp, Meta Ads, Outro.
- Novo chip ativo "Origem: …" quando recolhido.
- Incluir `origem` em `hasActive`.

### 4. `src/pages/admin/CRM.tsx`
- Aplicar filtro: `if (filters.origem && getOrigemGrupo(a.origem) !== filters.origem) return false;`
- Persistência já é automática (filtros salvos em localStorage).

## Observações
- Não muda schema; apenas leitura do campo `origem` que já existe.
- Mantém densidade compacta/confortável já implementada.
