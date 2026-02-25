

## Fix: "Erro ao verificar disponibilidade do horário"

### Root Cause

The `validar-agendamento` edge function has a signature mismatch with the shared `validarDisponibilidade` function:

**Current (broken) call on line 62:**
```typescript
const resultado: ValidacaoResult = await validarDisponibilidade(
  local_atendimento,   // <-- passing string where SupabaseClient expected
  data_agendamento,    // <-- this becomes "data" (OK)
  hora_agendamento     // <-- this becomes "hora" but "local" is missing
);
```

**Expected signature:**
```typescript
validarDisponibilidade(supabase: SupabaseClient, data: string, hora: string, local: string)
```

Two bugs:
1. `ValidacaoResult` type doesn't exist -- the export is `ResultadoValidacao`
2. The supabase client is not being created or passed; arguments are shifted

### Changes

**File: `supabase/functions/validar-agendamento/index.ts`**

1. Fix the import to use `ResultadoValidacao` and also import `criarClienteSupabase`
2. Create a supabase client before calling `validarDisponibilidade`
3. Fix the function call to pass all 4 arguments in the correct order: `(supabase, data_agendamento, hora_agendamento, local_atendimento)`

### Technical Detail

```text
BEFORE (line 1):
  import { validarDisponibilidade, ValidacaoResult } from "...";

AFTER:
  import { validarDisponibilidade, ResultadoValidacao, criarClienteSupabase } from "...";

BEFORE (lines 62-66):
  const resultado: ValidacaoResult = await validarDisponibilidade(
    local_atendimento,
    data_agendamento,
    hora_agendamento
  );

AFTER:
  const supabase = criarClienteSupabase();
  const resultado: ResultadoValidacao = await validarDisponibilidade(
    supabase,
    data_agendamento,
    hora_agendamento,
    local_atendimento
  );
```

This is a 2-line import change + 2-line body change. No other files need modification.

