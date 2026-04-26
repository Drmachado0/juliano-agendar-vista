
## Objetivo
Quando o paciente escolher um horário ou marcar "Aceito o primeiro horário disponível", já mostrar **alternativas próximas** dentro da própria Etapa 3 (data e horário), antes de avançar para a confirmação. Hoje o fallback só existe como botão "Próximo horário livre" e como checkbox sem feedback visual — o paciente só descobre que o horário caiu na hora de criar o agendamento.

## Comportamento proposto

### 1. Card "Alternativas próximas" (novo, dentro de `DateTimeStep`)
Aparece logo abaixo do `TimeSlotPicker` quando:
- O paciente já selecionou data + horário, **OU**
- O checkbox `acceptFirstAvailable` está marcado.

Mostra até **3 sugestões** ordenadas por proximidade do horário escolhido (ou do "agora" caso só o checkbox esteja marcado):
- 1 horário no **mesmo dia** mais próximo do escolhido, se existir.
- Próximos horários em **dias subsequentes**, completando 3 sugestões.

Cada card de alternativa mostra:
- Data abreviada (ex: "Qua, 30 de abril")
- Horário em destaque
- Rótulo de distância (ex: "Mesmo dia · 1h depois" ou "Em 2 dias")
- Botão "Usar este horário" → atualiza `selectedDate` + `selectedTime`.

### 2. Validação automática ao avançar
No `handleNext` do `DateTimeStep`, antes de chamar `onNext()`, chamar a edge function `validar-agendamento` (já existe). Se o slot ficou indisponível (concorrência entre o tempo de seleção e o avanço):
- Toast: "Esse horário acabou de ser ocupado. Veja as opções abaixo."
- Recarrega o `TimeSlotPicker` e realça o card de alternativas.

### 3. Preview quando o checkbox está marcado sem horário
Se o paciente marcar "Aceito o primeiro horário disponível" antes de escolher, o card já aparece mostrando as 3 próximas vagas reais — funciona como prova de que existem opções e reduz fricção.

## Arquivos a editar

### `src/services/disponibilidadePublica.ts`
- Adicionar função `buscarHorariosAlternativos(dataRef: Date, horarioRef: string | null, localAtendimento?: string, limite = 3)`:
  - Busca slots no mesmo dia ordenados pela diferença em minutos para `horarioRef`.
  - Avança dias subsequentes até completar `limite` sugestões (reutiliza a lógica iterativa de `buscarProximoHorarioLivre`, mas retornando array).
  - Retorna `Array<{ data: Date; horario: string; distanciaLabel: string }>`.

### `src/components/scheduling/AlternativesSuggestion.tsx` (novo)
- Props: `selectedDate`, `selectedTime`, `localAtendimento`, `acceptFirstAvailable`, `onSelect(data, time)`.
- Faz fetch via `buscarHorariosAlternativos` com debounce (300ms) sempre que as deps mudam.
- Estados: skeleton durante loading; lista de até 3 cards clicáveis; mensagem "Sem alternativas próximas no momento" quando vazio.
- Visual alinhado ao tema Navy/Gold + Plus Jakarta Sans (segue padrão dos outros componentes de scheduling).

### `src/components/scheduling/DateTimeStep.tsx`
- Importar e renderizar `<AlternativesSuggestion>` abaixo do bloco "Selection Summary".
- Card visível quando `selectedTime` existir **OU** `acceptFirstAvailable` estiver marcado.
- No `handleNext`: chamar `supabase.functions.invoke('validar-agendamento', { body: { local_atendimento: formData.location, data_agendamento, hora_agendamento } })`. Se `disponivel === false`, exibir toast e abortar `onNext()`.
- Microcopy abaixo do TimeSlotPicker: "Sugerimos opções próximas caso seu horário fique indisponível."

## Fora do escopo
- Não altera `criar-agendamento` (já valida no commit final).
- Não altera o fluxo do formulário/CRM.
- Não toca em `Agendamento.tsx`/`Agendar.tsx` diretamente — eles consomem `DateTimeStep` e herdam o comportamento.
