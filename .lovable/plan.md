
## Diagnóstico

O endpoint `mcp-agendamento` está funcionando corretamente. Ele rejeita a conexão com `-32001 Unauthorized` porque exige o header:

```
x-n8n-secret: <valor de N8N_SHARED_SECRET>
```

O nó **MCP Client** do seu workflow n8n está autenticando com outra coisa (provavelmente a Lovable Anon Key no `Authorization: Bearer`), por isso não passa. **Não há bug de código nem alteração a fazer no Lovable** — é configuração no n8n.

## Passo a passo no n8n (nó MCP Client)

1. Abra o workflow em produção e clique no nó **MCP Client**.
2. Em **Endpoint**, confirme:
   ```
   https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/mcp-agendamento
   ```
3. **Server Transport**: `HTTP Streamable` (como já está).
4. **Authentication**: troque de "Header Auth" (que só permite `Authorization`) para **Generic Credential Type → Header Auth** com header **customizado**, OU use **"Custom Headers"** no bloco de Options.
   - **Header Name**: `x-n8n-secret`
   - **Header Value**: cole o valor do secret `N8N_SHARED_SECRET` (o mesmo que já está configurado no Lovable Cloud).
5. Remova qualquer credencial antiga que esteja mandando `Authorization: Bearer <anon key>` para esse endpoint — ela não é necessária (`verify_jwt = false` para essa function) e não substitui o `x-n8n-secret`.
6. Salve, clique em **Test / Reconnect**. O painel Output deve deixar de mostrar "Unauthorized" e listar as tools (`listar_horarios_disponiveis`, `criar_agendamento`, etc.).

## Onde pegar o valor do N8N_SHARED_SECRET

Você já cadastrou esse secret no Lovable Cloud anteriormente (é o mesmo usado pelo `mcp-agendamento` e por várias functions internas). Se você não tem mais o valor em mãos, o caminho seguro é **rotacionar**: eu gero um novo valor aleatório com `update_secret`, você cola o mesmo valor no n8n, e prontos. Nada no código muda.

Se quiser seguir por aí, me responda **"pode rotacionar o N8N_SHARED_SECRET"** e eu abro o formulário seguro para você definir o novo valor e depois colamos no n8n.

## O que NÃO fazer

- Não remova a checagem `x-n8n-secret` do `mcp-agendamento`. Esse endpoint usa `service_role` e cria/cancela agendamentos — deixá-lo aberto expõe a agenda inteira.
- Não coloque o valor do secret em nenhum campo do frontend nem em `.env` do repositório.

## Referência (código atual, não vai ser alterado)

`supabase/functions/mcp-agendamento/index.ts`:
```ts
const provided = req.headers.get("x-n8n-secret");
if (!N8N_SHARED_SECRET || !provided || provided !== N8N_SHARED_SECRET) {
  return jsonRpcError(null, -32001, "Unauthorized");
}
```

## Entregável deste plano

Como a correção é 100% no n8n, **este plano não altera arquivos**. Aprovar o plano só confirma o diagnóstico. Se você quiser que eu rotacione o `N8N_SHARED_SECRET` para você ter um valor novo para colar no n8n, me avise após aprovar.
