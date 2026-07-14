## Diagnóstico (somente leitura)

### Sintoma
Para `telefone_canonico=91991300174` existem dois registros não-sandbox:

| id | status_crm | status_funil |
|---|---|---|
| `ff5ee055…` | `HGP` | `cancelado` |
| `24bd6d23…` | `PRECISA_DE_HUMANO` | `novo` |

`registrar-mensagem-in-n8n` criou o segundo corretamente (o primeiro já está `status_funil=cancelado`, portanto inativo). Mas `buscar-contexto-paciente` respondeu `ambiguo=true, total_ativos=2`.

### Causa raiz (divergência de critério de "ativo")

Existem **duas implementações concorrentes** do que é "registro ativo":

1. `supabase/functions/_shared/statusTerminais.ts` → `isRegistroAtivo(r)`
   - Retorna `false` quando `is_sandbox=true` **OU** `status_crm` terminal (`ATENDIDO/CANCELADO/COMPARECEU/FALTOU/EXCLUIDO`) **OU** `status_funil` terminal (`cancelado/compareceu/faltou/excluido`).
   - É o que `registrar-mensagem-in-n8n` (linhas 311, 410) usa — por isso ele viu 1 ativo e criou um lead novo.

2. `supabase/functions/buscar-contexto-paciente/index.ts` (linhas 34, 89–91, 170–171):
   ```ts
   const TERMINAIS = ["ATENDIDO", "CANCELADO", "COMPARECEU"];
   const isTerminal = (s) => TERMINAIS.includes(String(s ?? "").toUpperCase());
   ...
   const ativos = registros.filter((r) => !isTerminal(r.status_crm));
   ```
   - **Só olha `status_crm`**. Não consulta `status_funil`.
   - Também não inclui `FALTOU/EXCLUIDO` na lista terminal.

O registro `ff5ee055` tem `status_crm='HGP'` (não terminal em CRM) e `status_funil='cancelado'` (terminal em funil). O shared o considera inativo; o buscar o considera ativo. Somando com o `24bd6d23` ativo → `ativos.length=2` → `ambiguo=true`.

O comentário do próprio arquivo (linhas 10–12) declara a regra apenas sobre `status_crm`, mas a documentação `docs/CONTRATO-BUSCAR-CONTEXTO-PACIENTE.md` e o teste `atualizarStatusCrmSelecao.test.ts` já assumem o critério combinado do shared. A regra combinada é a correta — cancelamento por `status_funil` é o caminho canônico de baixa de agendamento no CRM.

### Efeito colateral
Enquanto persistir a divergência, qualquer telefone que tenha um agendamento antigo cancelado via `status_funil` (sem que `status_crm` tenha sido normalizado para `CANCELADO`) + um lead novo faz o bot cair em ambíguo e escala humano indevidamente. É o mesmo padrão do bug histórico `91991300174`.

### Menor correção segura (não aplicar agora)

1. **Unificar critério** em `buscar-contexto-paciente/index.ts`:
   - Importar `isRegistroAtivo`, `isCrmTerminal`, `isFunilTerminal` de `../_shared/statusTerminais.ts`.
   - Remover a constante local `TERMINAIS` e a função local `isTerminal`.
   - Trocar `const ativos = registros.filter((r) => !isTerminal(r.status_crm))` por `const ativos = registros.filter(isRegistroAtivo)`.
   - No cálculo do `historico` (linhas 216–223), trocar `isTerminal(r.status_crm)` por `isCrmTerminal(r.status_crm) || isFunilTerminal(r.status_funil)` para manter simetria (cancelados por funil aparecem no histórico, não somem).
   - Atualizar cabeçalho de comentário (linhas 10–12) para citar `status_funil` além de `status_crm`.

2. **Backend defensivo (opcional, mesma migração-menor)**: também restringir na própria query:
   ```ts
   .neq("is_sandbox", true)
   .not("status_funil", "in", "(cancelado,compareceu,faltou,excluido)")
   ```
   Reduz payload e blinda contra futuras regressões do filtro em memória. Manter o filtro em memória como segunda linha.

3. **Testes** a adicionar (sem tocar em nada além de tests):
   - Reproduzir exatamente o par `HGP/cancelado + PRECISA_DE_HUMANO/novo` e afirmar `ambiguo=false`, `leadAtivo=24bd6d23`, e que `ff5ee055` aparece em `ultimo_atendimento_historico` (se tiver `data_agendamento`).
   - Regressão simétrica para `ATENDIDO/novo` (terminal por CRM) e `HGP/faltou` (terminal por funil).

### O que NÃO precisa mudar
- `registrar-mensagem-in-n8n` já está correto: usa `isRegistroAtivo` e por isso criou o segundo card legítimo.
- A RPC `vincular_mensagem_por_telefone` e o shape de resposta do endpoint continuam iguais — só o filtro de contagem muda.
- Nenhuma migração de dados é necessária: o registro `ff5ee055` já está no estado correto (`status_funil=cancelado`). O bug é 100% de leitura no `buscar-contexto-paciente`.

### Escopo do que NÃO fazer nesta correção
- Não reescrever a lógica de histórico/mensagens.
- Não alterar contratos externos (mesmos campos de resposta, mesmos códigos de erro).
- Não mexer em `registrar-mensagem-in-n8n`, RPCs ou schema.

Aguardando aprovação para implementar apenas os itens 1 e 3 (e opcionalmente o 2) acima.
