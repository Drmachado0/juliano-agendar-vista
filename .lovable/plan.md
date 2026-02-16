

# Nova coluna "Aguardando" no CRM Kanban

## Resumo
Adicionar uma nova coluna **"Aguardando"** no CRM Kanban, posicionada entre "Novo Lead" e "Clinicor". Quando a mensagem de recuperacao (boas-vindas) for enviada automaticamente para um lead, ele sera movido de "NOVO LEAD" para "AGUARDANDO".

## Alteracoes

### 1. Frontend - CRM Kanban (`src/pages/admin/CRM.tsx`)
- Adicionar coluna "AGUARDANDO" na lista de colunas, entre "NOVO LEAD" e "CLINICOR", com cor distinta (ex: `bg-yellow-500`)
- Adicionar "AGUARDANDO" no estado inicial de `agendamentosPorStatus`

### 2. Service de Agendamentos (`src/services/agendamentos.ts`)
- Adicionar "AGUARDANDO" no enum do zod schema de `status_crm`
- Adicionar "AGUARDANDO" no objeto `grouped` da funcao `listarAgendamentosPorStatus`
- Atualizar o fallback de erro para incluir "AGUARDANDO" como chave vazia

### 3. Edge Function `enviar-boas-vindas-lead` (`supabase/functions/enviar-boas-vindas-lead/index.ts`)
- Apos enviar a mensagem com sucesso, atualizar o `status_crm` do lead para "AGUARDANDO"
- Isso fara o card sair automaticamente de "NOVO LEAD" e aparecer em "AGUARDANDO"

### 4. Validacao do schema Zod
- Incluir "AGUARDANDO" como valor valido no enum de `status_crm` para permitir drag-and-drop de/para essa coluna

## Fluxo resultante

```text
Lead criado (Step 2) --> NOVO LEAD
     |
     | (apos 5 min, msg enviada)
     v
  AGUARDANDO
     |
     | (lead responde / admin move manualmente)
     v
  CLINICOR / HGP / BELEM
     |
     v
  ATENDIDO
```

## Detalhes tecnicos

- Nenhuma migracao de banco necessaria: o campo `status_crm` e do tipo `text`, nao enum, entao aceita qualquer valor
- Leads existentes em "NOVO LEAD" que ja receberam boas-vindas permanecerao em "NOVO LEAD" (sem migracao retroativa)
- A coluna "AGUARDANDO" tera cor amarela/laranja para indicar que o lead esta aguardando resposta

