# Por que todos os horários aparecem "Bloqueados" após Abrir dia

Investigação no banco e em `src/services/agenda.ts` (linhas 168-192) mostra duas causas combinadas:

## Causa 1 (principal) — bloqueio "dia inteiro" persiste após reabrir

Quando aplicamos o **Bloco 3** do SQL de junho, inserimos em `bloqueios_agenda` um registro `tipo_bloqueio='dia_inteiro'` para **todos os dias fora da agenda oficial** (inclui 25/jun).

A função `Abrir dia` (`abrirDiaManual` / `abrirDiaComModelo` em `src/services/disponibilidade.ts:252-284`) apenas insere em `disponibilidade_especifica`. **Não remove o bloqueio dia_inteiro existente.**

Em `montarGradeAgenda` (`src/services/agenda.ts:183-192`), qualquer bloqueio `dia_inteiro` ou `feriado` sobrescreve o slot como "bloqueado". Resultado: dia abre, mas o bloqueio antigo continua mascarando os 13 slots.

## Causa 2 (secundária) — slot 08:00 mostra "Fora do horário"

`disponibilidade_especifica.hora_inicio` é coluna `time` no Postgres e retorna `"08:00:00"`. Os slots gerados têm `horaFormatada = "08:00"`. A comparação string `"08:00" < "08:00:00"` é **true** (lexicográfica), então o primeiro slot é marcado como "Fora do horário de atendimento" (`agenda.ts:171`).

---

# Plano de correção

## 1. `abrirDiaManual` e `abrirDiaComModelo` removem bloqueios dia_inteiro/feriado

Em `src/services/disponibilidade.ts`, antes do `insert` em `disponibilidade_especifica`, executar:

```ts
await supabase
  .from("bloqueios_agenda")
  .delete()
  .eq("clinica_id", input.clinicaId)
  .eq("data", input.data)
  .in("tipo_bloqueio", ["dia_inteiro", "feriado"]);
```

Justificativa: abrir um dia implica que ele não está mais "fechado por padrão". Bloqueios de **intervalo** ou **ausência de profissional** são mantidos (granulares).

## 2. Normalizar comparação de horário em `montarGradeAgenda`

Em `src/services/agenda.ts:169-180`, comparar usando os 5 primeiros caracteres para evitar o problema `"HH:MM"` vs `"HH:MM:SS"`:

```ts
const ini = horaInicioDisp.slice(0,5);
const fim = horaFimDisp.slice(0,5);
if (slotTime < ini || slotTime >= fim) { ... }
```

## 3. Limpar manualmente os 22 bloqueios dia_inteiro já existentes para 25/jun

Como o usuário já clicou em "Abrir dia" para 25/jun da Clinicor antes da correção, rodar um `DELETE` único para esse dia/clínica em `bloqueios_agenda` (`tipo_bloqueio IN ('dia_inteiro','feriado')`) para que a agenda já apareça correta sem ter que refazer a abertura.

Os demais 21 dias bloqueados de junho permanecem intactos — só serão limpos quando/se o admin abrir cada um.

## 4. Validação

Após aplicar:
- Recarregar a Agenda em 25/jun → esperado: 13 slots **livres** (não bloqueados).
- Slot 08:00 deve aparecer como **Livre**, não como "Fora do horário".
- Dias 04/jun (fora da lista oficial e sem abertura manual) devem continuar bloqueados.

## Arquivos afetados

- `src/services/disponibilidade.ts` — adicionar delete de bloqueios em `abrirDiaManual` e `abrirDiaComModelo`.
- `src/services/agenda.ts` — normalizar slice(0,5) na comparação de janela.
- 1 operação SQL pontual em `bloqueios_agenda` para 25/jun Clinicor.

Nenhuma mudança de schema. Memória `agenda-datas-abertas` continua válida (bloqueios são exceções; abrir dia agora limpa exceção de dia inteiro automaticamente — vou anotar isso na memória após implementar).
