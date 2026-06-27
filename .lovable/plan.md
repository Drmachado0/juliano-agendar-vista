## Problema

O calendário de /agendamento mostra todas as datas bloqueadas mesmo quando há entradas em "Datas Especiais Configuradas" (09–11 e 23–25/07/2026, clínicas Clinicor e HGP, `disponivel=true`, com `modelo_id` apontando para um modelo semanal de 08–11h ou 14–17h).

Causa-raiz confirmada por teste das RPCs:
- `public.get_available_days(7, 2026, '<clinicor>')` → `[]`
- `public.get_available_slots('2026-07-09', '<clinicor>')` → `[]`
- Mesmo a query direta `SELECT … FROM disponibilidade_especifica … LIMIT 1` retornando 1 linha.

Dentro de `get_available_slots`, o teste `IF v_disp IS NULL THEN RETURN;` aplicado a uma variável `record` não é confiável e está abortando a execução. O mesmo padrão aparece em `IF v_modelo IS NOT NULL` e no laço de `get_available_days/get_next_available_slot`.

## Solução

Migration corrigindo as três funções para usar o idioma canônico `IF NOT FOUND THEN RETURN; END IF;` logo após cada `SELECT … INTO`, em vez de `IS NULL` em record.

### Mudanças em `public.get_available_slots(date, uuid)`

- Após o `SELECT * INTO v_disp …` trocar `IF v_disp IS NULL THEN RETURN; END IF;` por `IF NOT FOUND THEN RETURN; END IF;`.
- Após o `SELECT * INTO v_modelo …` trocar `IF v_modelo IS NOT NULL THEN …` por `IF FOUND THEN …`.

### Mudanças em `public.get_available_days(int, int, uuid)` e `public.get_next_available_slot(uuid, date)`

- Manter a lógica atual, mas garantir que continuam usando `get_available_slots` corrigido. Não há mudança estrutural além de redeclarar os GRANTs.

### Pós-migração

- Validar via SQL:
  - `SELECT count(*) FROM public.get_available_slots('2026-07-09','657e4784-e292-45c6-a033-40f3d115f984');` deve retornar 12 (08:00–10:45, intervalo 15).
  - `SELECT * FROM public.get_available_days(7, 2026, '657e4784-e292-45c6-a033-40f3d115f984');` deve listar 09, 10, 11, 23, 24, 25/07/2026.
- Recarregar /agendamento e confirmar que as datas aparecem clicáveis.

Não é necessário redeploy de edge function (as funções `listar-datas-disponiveis` / `listar-horarios-disponiveis` não são usadas por esta tela; o front chama a RPC direta). Não há mudança no front-end.
