

# Corrigir envio de mensagem de boas-vindas para leads

## Problemas identificados

1. **Mensagens duplicadas**: O lead e criado toda vez que o usuario avanca do step 2 para o step 3, e a mensagem e enviada instantaneamente. Se o usuario voltar e avancar novamente (ou recarregar), multiplas mensagens identicas sao enviadas.
2. **Envio imediato**: A mensagem e disparada no momento da criacao do lead, mas o ideal e aguardar 5 minutos para verificar se o usuario realmente abandonou o processo.

## Solucao

### 1. Remover envio imediato do `criar-lead`
- Retirar todo o bloco de envio automatico de WhatsApp da edge function `criar-lead`
- O lead sera criado sem disparar mensagem

### 2. Criar nova edge function `enviar-boas-vindas-lead`
- Funcao agendada que roda a cada 2 minutos via pg_cron
- Busca leads com `status_funil = 'lead'` criados ha mais de 5 minutos
- Verifica se ja existe uma mensagem do tipo `boas_vindas` para aquele telefone na tabela `mensagens_whatsapp` (evita duplicatas)
- Envia uma unica mensagem por telefone
- Marca o envio na tabela para nao reenviar

### 3. Agendar via pg_cron
- Cron job rodando `*/2 * * * *` (a cada 2 minutos) chamando a nova edge function

## Fluxo apos a mudanca

```
Usuario preenche steps 1-2 → Lead criado (sem mensagem)
                                    ↓
                        5 minutos se passam...
                                    ↓
                Cron verifica: lead ainda em status "lead"?
                Ja recebeu boas_vindas nesse telefone? Nao.
                                    ↓
                    Envia UMA mensagem de boas-vindas
```

## Detalhes tecnicos

### Arquivos modificados
| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/criar-lead/index.ts` | Remover bloco de envio WhatsApp (linhas 86-127) |
| `supabase/functions/enviar-boas-vindas-lead/index.ts` | **Novo** - Edge function agendada |
| `supabase/config.toml` | Adicionar `verify_jwt = false` para nova funcao |

### Logica da nova edge function
- Query: leads com `status_funil = 'lead'` e `created_at < now() - interval '5 minutes'`
- Anti-duplicata: LEFT JOIN em `mensagens_whatsapp` WHERE `tipo_mensagem = 'boas_vindas'` AND telefone ja enviado → so processa os que NAO tem mensagem
- Limite de 10 leads por execucao para nao sobrecarregar
- Autenticacao via CRON_SECRET (Bearer token)

### pg_cron
- SQL para agendar execucao a cada 2 minutos chamando a edge function

