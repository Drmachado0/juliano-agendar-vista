## Refazer conexão Evolution API + corrigir endpoint e instância

### Diagnóstico

A configuração atual está apontando para o servidor e instância **errados**:

| Item | Hoje (errado) | Correto |
|---|---|---|
| URL base (`EVOLUTION_API_BASE_URL`) | `https://drmachado-evolution.cloudfy.live` | `https://secretaria-evolution.cloudfy.live` |
| Instância (`EVOLUTION_API_INSTANCE`) | `Agente ia` | `Hermes` |
| Token (`EVOLUTION_API_TOKEN`) | Token antigo | Token da nova instância (precisa do usuário) |

Além disso, **15 edge functions** têm o fallback hardcoded `|| "Agente ia"` no código, e a página de configurações tem o link `drmachado-evolution.cloudfy.live` hardcoded. Tudo isso precisa ser limpo, senão se o secret falhar o sistema cai novamente na instância errada.

---

### O que será feito

**1. Atualizar os 3 secrets no Lovable Cloud** (necessita ação tua — vou pedir via `add_secret`):
- `EVOLUTION_API_BASE_URL` → `https://secretaria-evolution.cloudfy.live`
- `EVOLUTION_API_INSTANCE` → `Hermes`
- `EVOLUTION_API_TOKEN` → o apikey da nova instância no painel Evolution

**2. Remover fallback `"Agente ia"` de todas as edge functions** e exigir o secret explicitamente. Arquivos:
- `_shared/evolutionApiClient.ts`
- `assistente-pre-agendamento/index.ts`
- `configurar-webhook-evolution/index.ts`
- `confirmar-agendamento-whatsapp/index.ts`
- `enviar-whatsapp/index.ts`
- `enviar-whatsapp-queue/index.ts`
- `enviar-whatsapp-imagem/index.ts`
- `lembrete-consulta-whatsapp/index.ts`
- `receber-whatsapp/index.ts`
- `verificar-numeros-whatsapp/index.ts`
- `verificar-status-evolution/index.ts`
- `gerenciar-conexao-evolution/index.ts`

Padrão novo: `const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE");` + erro claro se faltar.

**3. Atualizar página `ConfiguracoesEvolution.tsx`**
- Trocar link hardcoded `drmachado-evolution.cloudfy.live` → `secretaria-evolution.cloudfy.live`
- Tornar o link dinâmico (renderiza a `EVOLUTION_API_BASE_URL` retornada pelo backend) para nunca mais ficar dessincronizado.
- Expor a URL atual num novo retorno do `verificar-status-evolution` (`baseUrl` no payload).

**4. Reconfigurar webhook na nova instância**
Disparar a edge function `configurar-webhook-evolution` após o swap dos secrets, para registrar o webhook `receber-whatsapp` na instância **Hermes** do servidor `secretaria-evolution.cloudfy.live` (senão mensagens recebidas não chegam ao CRM).

**5. Validar conexão**
- Chamar `verificar-status-evolution` para confirmar `state: open` no número 559184043477.
- Se cair em `close`, abrir QR Code via `gerenciar-conexao-evolution` action `connect`.

**6. Atualizar memória**
Atualizar `mem://infrastructure/evolution-api-secrets-configuration` com a nova URL (`secretaria-evolution.cloudfy.live`) e instância (`Hermes`).

---

### Ordem de execução

```text
1. Pedir os 3 secrets (add_secret)
2. Substituir código (remover fallback "Agente ia" + corrigir link)
3. Deploy das edge functions afetadas
4. Rodar configurar-webhook-evolution
5. Verificar status — se "close", abrir QR Code para escanear no celular
6. Atualizar memória
```

### O que tu vai precisar fazer

- Confirmar/colar o novo **`EVOLUTION_API_TOKEN`** (apikey global ou da instância Hermes — pega no painel `https://secretaria-evolution.cloudfy.live`).
- Após rodar tudo, **escanear o QR Code** com o WhatsApp do número 559184043477 quando aparecer.