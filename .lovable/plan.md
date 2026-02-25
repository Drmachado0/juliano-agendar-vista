

# Criar Edge Function `listar-horarios-disponiveis`

## Objetivo
Criar uma Edge Function que receba `data` e `local_atendimento` e retorne todos os horarios disponiveis para aquele dia, reutilizando a logica ja existente em `_shared/validarDisponibilidade.ts`.

## Endpoint

- **URL**: `POST /functions/v1/listar-horarios-disponiveis`
- **JWT**: desabilitado (publico, para integracoes externas)

### Request
```json
{
  "data": "2026-03-01",
  "local_atendimento": "Clinicor – Paragominas"
}
```

### Response (sucesso)
```json
{
  "data": "2026-03-01",
  "local_atendimento": "Clinicor – Paragominas",
  "horarios_disponiveis": ["08:00", "08:30", "09:00", "10:30", "14:00"],
  "total": 5
}
```

### Response (sem disponibilidade)
```json
{
  "data": "2026-03-01",
  "local_atendimento": "Clinicor – Paragominas",
  "horarios_disponiveis": [],
  "total": 0,
  "motivo": "Não há expediente neste dia da semana"
}
```

## Implementacao

### Arquivo: `supabase/functions/listar-horarios-disponiveis/index.ts`

A funcao vai:

1. Validar campos obrigatorios (`data` no formato YYYY-MM-DD)
2. Reutilizar as funcoes auxiliares de `_shared/validarDisponibilidade.ts` (`getClinicaSlugsFromLocal`, `gerarSlots`, `horarioDentroBloqueio`)
3. Seguir a mesma logica do frontend (`disponibilidadePublica.ts`) mas executada server-side:
   - Verificar se a data e passada
   - Buscar clinica IDs pelo local
   - Verificar bloqueios de dia inteiro/feriado
   - Verificar disponibilidade especifica (overrides)
   - Se nao houver override, usar disponibilidade semanal
   - Gerar todos os slots possiveis
   - Remover horarios bloqueados por intervalo
   - Remover horarios ja ocupados por agendamentos existentes
   - Remover horarios ja passados (para o dia de hoje)
4. Retornar array de horarios disponiveis

### Arquivo: `supabase/config.toml`

Adicionar entrada:
```toml
[functions.listar-horarios-disponiveis]
verify_jwt = false
```

## Detalhes tecnicos

- A funcao cria seu proprio cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` para acessar todas as tabelas sem restricao de RLS
- `local_atendimento` e opcional; se omitido retorna horarios globais (sem filtro de clinica)
- Horarios de hoje filtram slots com margem de 30 minutos (mesmo comportamento do frontend)
- CORS habilitado para todas as origens (uso em integracoes externas)

