# Plano — CRM Kanban: rodada de UX (top 5 + mobile + nomenclatura)

## Escopo desta rodada

1. **Auto-colapsar colunas vazias** (faixa fina vertical, com contador, click reexpande, com toggle global "Mostrar vazias")
2. **Chips de filtro rápido** acima do board (Hoje / Esta semana / Atrasados / Sem data / Por unidade / Por convênio), multi-seleção e contador
3. **Hierarquia tipográfica do card** (nome em destaque, telefone secundário, escala consistente 12/14/16)
4. **Abas no modal de detalhes** (Resumo · Consulta · Histórico · Mensagens · Auditoria) com CTAs WhatsApp/Ligar fixos no topo
5. **Visualização mobile (<768px)** em lista vertical agrupada por status, com switcher entre grupos
6. **Renomear colunas e título** para tom mais humano

Fora de escopo (rodadas futuras): contraste/acessibilidade detalhada (WCAG AA), sparklines/comparação temporal nos KPIs, seleção múltipla em massa, atalhos de teclado, modo ultra-compacto, redesenho do design system.

Tooltips nas ações do card **já existem** no `KanbanCard.tsx`, então não entram como item separado.

---

## Item 1 — Auto-colapsar colunas vazias

**Comportamento:** quando uma coluna do Kanban tem 0 cards após filtros, ela vira uma faixa vertical fina (~44px) com:
- Bolinha de cor da coluna
- Título girado 90° (vertical)
- Contador "0"
- Click expande temporariamente para o tamanho normal (mostrando o estado vazio existente)

Adicionar toggle no header **"Mostrar vazias"** (Switch) ao lado de "Colunas" (manager existente). Estado salvo em `localStorage` (`crm:kanban:show-empty:v1`, default = false).

Quando `mostrarVazias = true`, comportamento atual (todas expandidas).

**Arquivos:**
- `src/components/admin/KanbanColumn.tsx` — aceitar prop `collapsed`; quando true, renderizar faixa vertical com título girado (usar `[writing-mode:vertical-rl]` Tailwind) e contador. Click no header chama callback para expandir.
- `src/pages/admin/CRM.tsx` — adicionar state `mostrarVazias` + state local `expandidasManualmente: Set<string>`. Calcular `collapsed = !mostrarVazias && agendamentosFiltrados[col.status].length === 0 && !expandidasManualmente.has(col.status)`. Adicionar Switch "Mostrar vazias" na toolbar.

---

## Item 2 — Chips de filtro rápido

Acima do board (entre Legenda e o `CRMFilters` atual), uma linha de chips clicáveis. Cada chip mostra label + contagem.

**Chips fixos (período):** Hoje · 7 dias · Atrasados · Sem data · Todos
**Chips dinâmicos (unidade):** Clinicor · HGP · Belém (gerados a partir das opções existentes em `CRMFilters`)
**Chips dinâmicos (convênio):** Particular · Bradesco · Unimed · etc. (top 5 mais usados, derivados dos dados)

Clicar no chip atualiza `filters` (mesmo state existente). Multi-seleção dentro do mesmo grupo (período é single, unidade/convênio são multi). Botão "Limpar" remove todos os chips ativos.

O `CRMFilters` atual continua acessível como "Filtros avançados" colapsado por padrão.

**Arquivos:**
- `src/components/admin/CRMFilters.tsx` — estender `CrmFilters` para suportar `unidades: string[]` e `convenios: string[]` (atualmente são strings únicas). Migrar `filters.local` e `filters.convenio` para arrays. Atualizar `aplicarFiltrosEOrdenacao` em `CRM.tsx` para usar `.includes()`.
- Novo componente `src/components/admin/CRMQuickChips.tsx` — renderiza chips e gerencia toggles. Recebe `filters`, `onChange`, e `agendamentos` (para contar).
- `src/pages/admin/CRM.tsx` — montar `<CRMQuickChips />` antes do `<CRMFilters />` e colocar o `CRMFilters` dentro de um Collapsible "Filtros avançados".

⚠️ **Migração silenciosa:** ler localStorage antigo (`crm:filters:v1`) e converter strings em arrays no `loadFilters()`.

---

## Item 3 — Hierarquia tipográfica do card

**Mudanças em `KanbanCard.tsx`:**

| Elemento | Antes | Depois |
|---|---|---|
| Nome paciente | `text-sm` (14px) / `text-[15px]` | `text-base font-semibold` (16px) / `text-lg` (18px) confortável |
| Telefone | `text-xs` / `text-sm` | `text-[12px] text-muted-foreground/80` (constante) |
| Bloco data/hora | `text-xs px-2 py-1.5` | mantém — já está bem destacado |
| Local + tipo + convênio | `text-[10px]` / `text-[11px]` | `text-[11px]` (constante) e tipo·convênio em `text-muted-foreground` |
| Meta info (criado/dias) | `text-[10px]` | mantém |

**Regras:**
- Nome do paciente é o ÚNICO `font-semibold` text-base+ no card.
- Telefone vira ícone `Phone` + texto, mas a cor do texto cai para 70% opacity.
- Adicionar `tracking-tight` no nome para parecer mais "produto".

Trade-off: cards ficam ~4-6px mais altos no modo compacto. Aceitável.

---

## Item 4 — Abas no modal de detalhes

**Refatorar `AgendamentoDetailsModal.tsx`** para usar `<Tabs>` (já existe em `@/components/ui/tabs`).

**Estrutura:**
- **Topo fixo (sempre visível):** Avatar + Nome + Telefone + Botões "WhatsApp" (abre WhatsAppModal) e "Ligar" (`tel:`). Selo de status (NOVO LEAD / CLINICOR / etc.).
- **Aba "Resumo":** dados pessoais + tracking (UTMs/origem) — campos que hoje aparecem nas seções "Dados Pessoais" e "Origem & Tracking".
- **Aba "Consulta":** data/hora, local, tipo, convênio, status_funil, observações internas.
- **Aba "Histórico":** seção "Última conversa" + link "Abrir conversa completa" (já existe).
- **Aba "Mensagens":** lista das últimas 10 mensagens whatsapp do agendamento (query nova em `mensagens_whatsapp`).
- **Aba "Auditoria":** lista de eventos do `crm_audit_log` para esse agendamento (query nova).

Salvar aba ativa em `sessionStorage` (`crm:modal:tab`).

**Arquivos:**
- `src/components/admin/AgendamentoDetailsModal.tsx` — refator estrutural, sem mudar lógica de update.
- Possivelmente extrair cada aba em um sub-componente (`ModalTabResumo.tsx`, etc.) para manter o arquivo legível.

---

## Item 5 — Visualização mobile (<768px)

**Breakpoint:** `md` (768px). Detectar via hook existente `use-mobile.tsx` ou `useMediaQuery`.

**Quando mobile:**
- Esconder o board horizontal.
- Mostrar header com **dropdown/seletor de coluna** (Select shadcn) listando todas as colunas visíveis com contador. Ex: "CLINICOR (19)".
- Abaixo, lista vertical de cards da coluna selecionada (mesmos `KanbanCard`, mas largura 100%).
- Swipe horizontal entre colunas (opcional — detectar com `pointerdown`/`pointerup`; se complexo, fica só o seletor).
- Filtros rápidos viram um sheet acionado por botão "Filtros".

**Arquivos:**
- `src/pages/admin/CRM.tsx` — bifurcar render: `isMobile ? <CRMMobile /> : <Board atual />`.
- Novo componente `src/components/admin/CRMMobile.tsx`.

---

## Item 6 — Nomenclatura

**Mudanças textuais (sem alterar `status_crm` no banco):**

| Onde | Antes | Depois |
|---|---|---|
| `<h1>` da página | "CRM Kanban" | "Jornada do Paciente" |
| Subtítulo | "Acompanhamento de pacientes — Oftalmologia" | mantém |
| Coluna `PRECISA_DE_HUMANO` (title) | "Precisa de humano" | "Aguarda recepção" |
| Coluna `NOVO LEAD` (title) | "Novo Lead" | "Novo contato" |
| Coluna `AGUARDANDO` (title) | "Aguardando" | "Em análise" |
| Coluna `ATENDIDO` (title) | "Atendido" | "Concluído" |

Os `status` (string interna) **não mudam** — apenas o `title` em `DEFAULT_COLUMNS` (`useKanbanColumnsConfig.ts`). O CRM segue persistindo `status_crm = "PRECISA_DE_HUMANO"` no banco.

**Arquivos:**
- `src/hooks/useKanbanColumnsConfig.ts` — atualizar `title` em `DEFAULT_COLUMNS`.
- `src/pages/admin/CRM.tsx` — atualizar `<h1>`.
- Conferir se a `CRMLegenda` referencia esses nomes; se sim, atualizar.

---

## Detalhes técnicos

```text
src/
├── pages/admin/CRM.tsx           ← orquestração (mobile fork, chips, mostrarVazias, h1)
├── hooks/
│   ├── useKanbanColumnsConfig.ts ← rename titles
│   └── use-mobile.tsx            ← (já existe) usar para mobile fork
├── components/admin/
│   ├── KanbanColumn.tsx          ← prop `collapsed` + render vertical
│   ├── KanbanCard.tsx            ← tipografia
│   ├── CRMFilters.tsx            ← migrar local/convenio para arrays
│   ├── CRMQuickChips.tsx         ← NOVO
│   ├── CRMMobile.tsx             ← NOVO
│   └── AgendamentoDetailsModal.tsx ← refator com Tabs + CTAs topo
```

**Persistência localStorage adicionada:**
- `crm:kanban:show-empty:v1` (boolean)
- `crm:modal:tab` (sessionStorage)

**Migração de filtros:** `loadFilters()` em `CRM.tsx` precisa converter `filters.local: string` → `filters.unidades: string[]` (e mesmo para convênio) lendo o JSON antigo. Sem perda de dados.

**Sem mudanças de banco / RLS / edge functions.** Tudo é frontend.

---

## Validação após implementação

- [ ] Colunas "NOVO LEAD", "PRECISA DE HUMANO" e "AGUARDANDO" aparecem como faixas finas com contador 0; click expande
- [ ] Toggle "Mostrar vazias" persiste entre reloads
- [ ] Chip "Hoje" filtra corretamente; multi-seleção em "Unidade" funciona
- [ ] Filtros antigos (localStorage anterior) carregam sem quebrar
- [ ] Nome do paciente claramente dominante visualmente no card
- [ ] Modal abre na aba "Resumo"; CTAs WhatsApp/Ligar visíveis no topo
- [ ] Em viewport <768px, board é substituído por seletor + lista vertical
- [ ] H1 mostra "Jornada do Paciente"; coluna "PRECISA DE HUMANO" mostra "Aguarda recepção"
- [ ] Drag-and-drop entre colunas continua funcionando (não regredir)
- [ ] Realtime continua atualizando (badge "ao vivo")
