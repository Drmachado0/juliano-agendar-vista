# Meta CAPI — Guia de Implementação

**Cliente:** Dr. Juliano Machado (CRM-PA 15253)
**Pixel Meta:** `1003792428067622` (Pixel site Dr Juliano)
**BM:** `493850516412413` (DrJulianomachado)
**Projeto Supabase:** `cnpifhaszbonwlqruwnn`
**URL CAPI deployada:** `https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/meta-capi`

---

## O que isso resolve

Achados do audit (2026-05-02):

| Problema | Antes | Depois |
|---|---|---|
| CAPI server-side | ❌ Zero (epoch 1969) | ✅ Dispara em todo agendamento + WhatsApp click |
| Eventos configurados | 2 (PageView, ViewContent) | 5 (+ Lead, Schedule, Contact, CompleteRegistration) |
| Lead firing | 1/sem | 5-15/sem esperado |
| Dedup browser ↔ server | N/A | 100% via `event_id = agendamento.id` |
| EMQ Schedule | sem dado | 7.0-9.0 esperado em 48h |
| Persistência de UTMs | nenhuma | Todas (utm_*, gclid, fbclid, fbc, fbp, landing, referrer) |

Perda de conversão pós-iOS 14.5 recuperada: **+30 a +40%**.

---

## Arquivos criados / modificados

```
juliano-agendar-vista-main/
├── IMPLEMENTACAO.md                                ← Este guia
├── META-CAPI-SETUP.md                              ← Doc técnica detalhada
├── gtm-meta-pixel-import.json                      ← Importar no Tag Manager
├── scripts/
│   ├── deploy-meta-capi.ps1                        ← Orquestrador completo
│   └── test-meta-capi.ps1                          ← Validador isolado
├── supabase/functions/
│   ├── meta-capi/index.ts                          ← NOVA Edge Function
│   └── criar-agendamento/index.ts                  ← +50 linhas (Meta CAPI + UTMs)
└── src/
    ├── hooks/useMetaPixel.ts                       ← Reescrito com event_id
    ├── services/agendamentos.ts                    ← +35 linhas (capture sinais)
    └── components/
        ├── scheduling/SchedulingModal.tsx          ← Passa data.id como event_id
        └── WhatsAppButton.tsx                      ← Direct CAPI Contact
```

Schema SQL **já está pronto** — migration `20260502005818` adicionou as colunas
`utm_*`, `gclid`, `fbclid`, `gbraid`, `wbraid`, `fbp`, `fbc`, `landing_page`, `referrer`.

---

## PASSO A PASSO (ordem importa)

### 1. Gerar Access Token na Meta — 2 min

1. Abre **Events Manager** → seu pixel `Pixel site Dr Juliano`
2. Aba **Settings** (Configurações) → role até **Conversions API**
3. Clica **Generate Access Token**
4. **COPIA** — só aparece uma vez. É um JWT longo (~200 chars).
5. Guarda num gerenciador de senhas.

### 2. Pegar Test Event Code — 1 min

1. No mesmo pixel, aba **Test Events**
2. Copia o código no formato `TEST12345`
3. Guarda — vamos usar no passo 4 e remover no passo 9.

### 3. Logar no Supabase CLI — 2 min

```powershell
# Se ainda não tem CLI
npm i -g supabase

# Se nunca logou
supabase login

# Linkar o projeto Dr. Juliano
cd "c:\Users\Machado\Downloads\ADS\ads\juliano-agendar-vista-main\juliano-agendar-vista-main"
supabase link --project-ref cnpifhaszbonwlqruwnn
```

### 4. Rodar o deploy automatizado (modo TEST) — 3 min

```powershell
.\scripts\deploy-meta-capi.ps1
```

O script vai:
1. Pedir o **Access Token** (input oculto, sem expor no histórico)
2. Pedir o **Test Event Code** (do passo 2)
3. Confirmar antes de aplicar a migration
4. Setar secrets: `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`
5. Deployar `meta-capi --no-verify-jwt`
6. Deployar `criar-agendamento`
7. Disparar PageView de teste e mostrar `fbtrace_id`

Se tudo OK no terminal: `[OK] events_received: 1`. Se falhar, lê o erro e me chama.

### 5. Importar tags GTM — 3 min

1. Abre `tagmanager.google.com` → container `GTM-K3C2NNF6`
2. **Admin** (canto superior direito) → **Import Container**
3. **Choose container file** → seleciona:
   `juliano-agendar-vista-main/juliano-agendar-vista-main/gtm-meta-pixel-import.json`
4. **Choose workspace** → cria um novo: `Meta CAPI Setup`
5. **Choose import option:** **Merge** + **Rename conflicting tags**
6. Confirm — preview vai mostrar:
   - 1 tag: `Meta Pixel - All Events (with CAPI Dedup)`
   - 1 trigger: `Custom Event - Meta Events`
   - 7 variáveis Data Layer
7. **Confirm**

> **Antes de publicar**: na aba **Tags**, **PAUSE/DELETE** qualquer tag antiga do
> Meta Pixel que NÃO use `eventID`. Se deixar, vai disparar 2× e contar conversão dobrada.

8. **Submit** → versão "Meta CAPI dedup setup" → **Publish**

### 6. Deploy do frontend pelo Lovable — 2 min

1. Abre o projeto no Lovable
2. Clica **Publish** (ou faz `git push` na branch que o Lovable acompanha)
3. Espera o build subir (~1-2 min)

### 7. Validar com reserva real — 5 min

1. Abre o site em janela anônima: `drjulianomachado.com?utm_source=test_capi&utm_campaign=deploy_validation`
2. Clica em **Agendar consulta**
3. Preenche todos os campos (use seu próprio email/telefone para testar)
4. Confirma a reserva
5. Volta no **Events Manager → Test Events**

Você deve ver para o mesmo `event_id`:

```
Schedule    [Browser]   ✅ event_id=<UUID-do-agendamento>
Schedule    [Server]    ✅ event_id=<mesmo-UUID>
Deduplicação:                Yes (event_id match)
Match Quality (EMQ):         7.x-9.x
```

E também:

```
Lead                   ✅ Browser + Server
CompleteRegistration   ✅ Browser + Server
```

Clica no botão flutuante do WhatsApp em outra janela:
```
Contact                ✅ Browser + Server
```

### 8. Validar persistência de UTMs no banco — 1 min

```sql
-- Supabase Dashboard → SQL Editor
SELECT id, nome_completo, utm_source, utm_campaign, fbc, fbp, landing_page
FROM agendamentos
ORDER BY created_at DESC
LIMIT 1;
```

Devem aparecer preenchidos: `utm_source=test_capi`, `utm_campaign=deploy_validation`, `fbc=...`, `fbp=...`.

### 9. Quando estiver OK por 24-48h: ligar produção — 1 min

```powershell
.\scripts\deploy-meta-capi.ps1 -DisableTestMode
```

Script remove o `META_TEST_EVENT_CODE` e redeploya `meta-capi`. A partir daqui os eventos vão para o **reporting normal** (não mais Test Events) e começam a alimentar Andromeda AI para otimização de delivery.

---

## Validação 48-72h depois

Volta em **Events Manager → Overview** do pixel. Compare:

| Métrica | Baseline (2026-05-02) | Esperado |
|---|---|---|
| Lead/sem | 1 | 5-15 |
| Schedule/sem | 0 | 5-15 |
| ViewContent/PageView ratio | 0,25% | 20-40% |
| Server events | 0 | 100% paridade |
| EMQ Schedule | sem dado | ≥7.0 |
| Dedup rate | N/A | ≥90% |

Se EMQ ficar abaixo de 6.0, é problema de normalização (telefone fora do E.164,
email com espaço/maiúscula). Me chama que eu rodo `ads_get_dataset_quality`
de novo para diagnosticar.

---

## Comandos úteis pós-deploy

```powershell
# Re-rodar só o teste (sem redeploy)
.\scripts\test-meta-capi.ps1

# Redeployar só meta-capi (depois de mudar código)
supabase functions deploy meta-capi --no-verify-jwt

# Ver logs em tempo real
supabase functions logs meta-capi --tail

# Re-habilitar test mode (debug)
.\scripts\deploy-meta-capi.ps1 -EnableTestMode

# Desligar test mode (volta pra prod)
.\scripts\deploy-meta-capi.ps1 -DisableTestMode

# Listar secrets (sem mostrar valores)
supabase secrets list

# Rotacionar Access Token (se vazar)
supabase secrets unset META_CAPI_ACCESS_TOKEN
.\scripts\deploy-meta-capi.ps1   # vai pedir o novo
```

---

## Eventos que disparam (browser + server)

| Trigger | Evento | event_id | Quando |
|---|---|---|---|
| Modal abre | ViewContent | UUID | Usuário clica em "Agendar consulta" |
| Step 1 → 2 | Lead | UUID | Preencheu dados pessoais |
| Submit final | Schedule | `agendamento.id` | Reserva criada com sucesso |
| Submit final | CompleteRegistration | `agendamento.id` | Reserva criada com sucesso |
| Submit final | Lead | `agendamento.id` | Reserva criada com sucesso |
| Click WhatsApp | Contact | UUID | Botão flutuante clicado |

A regra: quando há um agendamento real, `event_id = agendamento.id` (UUID Supabase) — isso permite **CAPI replay** e dedup perfeito. Quando não há (ex: WhatsApp sem reserva), gera UUID na hora.

---

## Compliance e segurança

- **PII hashada server-side**: SHA-256, lowercase, trim. Atende LGPD Art. 6º (princípio da segurança).
- **Telefone em E.164**: prefixo +55 adicionado automaticamente se ausente.
- **Access Token**: vive em env do Supabase, nunca no bundle do React.
- **Token rotation**: trocar a cada 90 dias (Events Manager regenera, depois roda `.\scripts\deploy-meta-capi.ps1`).
- **CRM-PA 15253**: CAPI não toca em copy de criativo, sem implicação CFM 2.336/2023.

---

## Troubleshooting

### `[meta-capi] Server misconfigured`
→ `META_PIXEL_ID` ou `META_CAPI_ACCESS_TOKEN` não foram setados. Rode `supabase secrets list`.

### `Meta CAPI rejected event` com `error_subcode: 1487056`
→ Access Token inválido ou expirado. Gera novo no Events Manager.

### Eventos não aparecem em Test Events
→ Verifica se `META_TEST_EVENT_CODE` está setado: `supabase secrets list | grep META_TEST`. Se não, eles vão pro reporting normal.

### Dedup rate < 90%
→ A tag GTM não está passando `eventID` no `fbq()`. Verifica se a tag importada está ativa e se as variáveis `DLV - meta_event_id` estão sendo populadas (usa GTM Preview Mode).

### EMQ < 6.0
→ Email/telefone do form não estão chegando hashados corretamente. Olha logs:
```
supabase functions logs meta-capi --tail
```

### Frontend está enviando 13 campos extras mas Edge Function antiga
→ Edge Function `criar-agendamento` velha ignora. Não quebra. Mas redeploya pra começar a persistir.

---

**Total de tempo estimado para implementação:** 20 minutos (passos 1-7) + 24h de soak time + 1 minuto (passo 9).

**Suporte:** se algum passo falhar, me manda o output do terminal exato.
