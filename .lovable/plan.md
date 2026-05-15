## Refatoração: Agenda baseada em "datas abertas"

### Conceito novo

A regra de ouro passa a ser: **sem `disponibilidade_especifica` ativa para a clínica/data, o dia é fechado** — mesmo que exista `disponibilidade_semanal` cadastrada. A grade semanal vira apenas **modelo/template** para abrir dias rapidamente.

---

### 1. Banco de dados (migrations)

**a) `disponibilidade_semanal` vira "modelos de horário"**
- Adicionar coluna `nome text` (ex.: "Clinicor manhã", "HGP tarde") — opcional, fallback gerado.
- Adicionar `is_template boolean default true` (semântica: nunca abre agenda sozinho).
- Manter `dia_semana` apenas como sugestão visual de quando aplicar.
- (Sem breaking change na estrutura — só uso lógico muda.)

**b) `disponibilidade_especifica` ganha vínculo com modelo**
- Adicionar `modelo_id uuid` referenciando `disponibilidade_semanal(id)` (opcional).
- Quando `modelo_id` preenchido, herda `hora_inicio/hora_fim/intervalo_minutos` do modelo (se os próprios campos da disp_especifica estiverem nulos).

**c) RPCs novas (SECURITY DEFINER, públicas para o agendamento online)**

```
get_available_days(p_month int, p_year int, p_clinica_id uuid)
  → TABLE(data date, total_slots int, slots_livres int)
  Considera: disp_especifica.disponivel=true para a data,
             desconta agendamentos e bloqueios.

get_available_slots(p_data date, p_clinica_id uuid)
  → TABLE(hora time, status text)  -- 'livre' | 'ocupado' | 'bloqueado'
  Resolve modelo→horários, aplica bloqueios e agendamentos.

get_next_available_slot(p_clinica_id uuid, p_from date default current_date)
  → TABLE(data date, hora time)
```

Todas em America/Belem para "data passada".

---

### 2. Backend (services)

Substituir lógica de `src/services/disponibilidadePublica.ts` e parte de `src/services/agenda.ts` para chamar as RPCs em vez de montar grade no frontend. Manter assinaturas dos serviços públicos para não quebrar `CalendarGrid`, `TimeSlotPicker`, etc.

---

### 3. UI Admin — `/admin/agenda` (visão diária)

Quando o dia **não tem `disponibilidade_especifica` ativa** para a clínica selecionada:
- Esconder a grade longa de slots bloqueados.
- Mostrar **card centralizado**: "Dia fechado para atendimento em {Clínica}".
- Botões:
  - **Abrir este dia** (abre modal pedindo hora_inicio/fim/intervalo).
  - **Abrir usando modelo** (dropdown com modelos da clínica → cria `disp_especifica` herdando do modelo).

Quando o dia **está aberto**, mostrar **header de resumo** acima da grade:
- Status: Aberto • Clínica • Modelo aplicado (se houver) • Total / Livres / Ocupados / Bloqueados.
- Ações: "Fechar dia" (deleta/desativa disp_especifica), "Trocar modelo".

---

### 4. UI Admin — `/admin/disponibilidade` (refator com abas)

Novo `<Tabs>`:
- **Datas abertas** — lista/calendário de `disponibilidade_especifica` ativas, com filtro por clínica/mês. CRUD completo.
- **Modelos de horários** — CRUD da `disponibilidade_semanal` (rebatizada na UI). Botão "Aplicar modelo a uma data".
- **Bloqueios / Exceções** — CRUD de `bloqueios_agenda`, com aviso: "use apenas para fechar intervalo dentro de um dia já aberto".

---

### 5. Front público (calendário do paciente)

`CalendarGrid` e `disponibilidadePublica.listarDatasComSlotsDisponiveis` passam a chamar `get_available_days`. Reduz de N+1 queries para 1 chamada por mês. Comportamento visível idêntico, exceto que **dias sem disp_especifica nunca aparecem como disponíveis** (era a regra confusa atual).

---

### Arquivos afetados

- `supabase/migrations/<novo>.sql` — colunas + 3 RPCs.
- `src/services/disponibilidadePublica.ts` — reescrita usando RPCs.
- `src/services/agenda.ts` — `montarGradeAgenda` passa a delegar para RPC; mantém shape `SlotAgenda`.
- `src/services/disponibilidade.ts` — adicionar helpers `abrirDataComModelo`, `fecharData`.
- `src/pages/admin/Agenda.tsx` — novo card "dia fechado" + header de resumo.
- `src/pages/admin/Disponibilidade.tsx` — refator com `<Tabs>` (3 abas).
- Componentes novos:
  - `src/components/admin/DiaFechadoCard.tsx`
  - `src/components/admin/AbrirDiaModal.tsx`
  - `src/components/admin/ResumoDiaAberto.tsx`

---

### Fora de escopo

- Não mexer em `bot_config`, lembretes, WhatsApp, n8n.
- Não mudar tabela `agendamentos`.
- Não migrar dados existentes de `disponibilidade_semanal` (continua usável como modelo).

### Plano de validação

1. Rodar migrations.
2. Testar RPCs via `supabase--read_query` com clínica real.
3. Abrir `/admin/agenda` num dia sem disp_especifica → ver card "fechado".
4. Clicar "Abrir usando modelo" → grade aparece.
5. Calendário público (`/agendamento`) → mês exibe só dias abertos.

Posso prosseguir?
