## Problema

Ao clicar **"Salvar alterações"** na tela `/admin/configuracoes/evolution`, o backend retorna:

```
Edge function returned 400: {"error":"Encryption key not found in vault"}
```

### Causa raiz

A RPC `atualizar_evolution_config` (criada na migração de hoje) chama `public.encrypt_sensitive_data(token)`. Essa função busca um segredo chamado **`ENCRYPTION_KEY`** no Supabase Vault para criptografar com `pgp_sym_encrypt`. **Esse segredo não existe** no Vault deste projeto, então a função aborta com a mensagem acima — e o save inteiro falha.

A mesma função já é usada para criptografar `observacoes_internas` em agendamentos, então provavelmente esse fluxo também está quebrado silenciosamente.

---

## Solução

Criar uma migração que **garante a existência da `ENCRYPTION_KEY` no Vault**, gerando uma chave aleatória forte (256 bits) caso ela ainda não esteja lá. Operação idempotente — não sobrescreve se já existir.

### Migração SQL (resumo do que será executado)

```sql
-- Garante extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insere ENCRYPTION_KEY no Vault apenas se não existir
DO $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM vault.secrets
  WHERE name = 'ENCRYPTION_KEY'
  LIMIT 1;

  IF v_existing IS NULL THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),  -- 256-bit key, hex
      'ENCRYPTION_KEY',
      'Chave mestra para encrypt_sensitive_data / decrypt_sensitive_data'
    );
  END IF;
END $$;
```

### Por que essa abordagem
- **Idempotente:** roda sem risco mesmo se a chave já existir um dia.
- **Sem downtime:** não toca dados existentes (a coluna `api_token_encrypted` está vazia hoje).
- **Sem dependência externa:** chave gerada dentro do próprio banco com `pgcrypto`.

### Efeito imediato
- Salvar credenciais Evolution na UI passa a funcionar.
- Trigger de criptografia de `observacoes_internas` em `agendamentos` volta a funcionar.

---

## Verificação após apply

1. Recarregar `/admin/configuracoes/evolution`.
2. Colar BASE URL, INSTÂNCIA e API KEY → **Salvar alterações**.
3. Esperado: toast verde + badge muda de **"NÃO CONFIGURADA"** para **"CONFIGURADA"** + token mascarado aparece.
4. Clicar **"Testar credenciais"** → deve responder OK da Evolution.

## Detalhes técnicos

- **Arquivo único:** uma nova migração `supabase/migrations/<timestamp>_ensure_encryption_key.sql`.
- **Sem mudanças em código** (edge functions, helper, UI permanecem como estão — eles já estão corretos).
- **Sem rotação de chave:** não estamos trocando uma chave existente, só criando se faltar. Se algum dia houver dados criptografados com chave diferente, eles permaneceriam ilegíveis — mas não há esse caso aqui (tabela `integracoes_evolution` está vazia e `observacoes_internas_encrypted` provavelmente também).