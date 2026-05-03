# Prompts para Lovable AI — Meta CAPI

Cole esses prompts no chat do Lovable na ordem. Cada um faz uma parte específica.

---

## 🔑 Prompt 1 — Configurar secrets

> Copia, cola, **substitui o ACCESS_TOKEN_AQUI e TEST_CODE_AQUI pelos valores reais** que você pegou da Meta.

```
Por favor configure 3 secrets no Lovable Cloud para a Edge Function meta-capi:

META_PIXEL_ID = 1003792428067622
META_CAPI_ACCESS_TOKEN = ACCESS_TOKEN_AQUI
META_TEST_EVENT_CODE = TEST_CODE_AQUI

Esses secrets serão lidos via Deno.env.get() pela função supabase/functions/meta-capi/index.ts.
Depois de configurar, confirme que aparecem listados (sem expor os valores).
```

---

## 🚀 Prompt 2 — Deploy e validação

```
Por favor:
1. Faça Publish do projeto para deployar a nova Edge Function meta-capi e a versão atualizada de criar-agendamento
2. Confirme em Cloud → Edge Functions que ambas aparecem ativas
3. Mostre os primeiros logs da meta-capi (deve estar idle aguardando requests)
4. Aplique qualquer migration pendente — a 20260502005818 deve estar aplicada (adiciona colunas utm_*, gclid, fbclid, fbc, fbp, landing_page, referrer em agendamentos)
```

---

## ✅ Prompt 3 — Smoke test

```
Por favor faça um teste do endpoint meta-capi enviando este payload:

POST https://cnpifhaszbonwlqruwnn.supabase.co/functions/v1/meta-capi
Headers:
  Content-Type: application/json
  Authorization: Bearer {anon_key_do_projeto}

Body:
{
  "event_name": "PageView",
  "event_id": "lovable-smoke-test-001",
  "event_source_url": "https://drjulianomachado.com/?utm_source=lovable_test",
  "user_data": { "country": "BR" },
  "custom_data": { "content_name": "SmokeTest", "utm_source": "lovable_test" }
}

Esperado: status 200 com { success: true, events_received: 1, fbtrace_id: "..." }
Mostre a resposta completa.
```

---

## 🧪 Prompt 4 — Validar persistência no banco

```
Depois que eu fizer 1 reserva real no site (vou testar agora), por favor rode esta SQL e me mostre o resultado:

SELECT
  id,
  nome_completo,
  email,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  gclid,
  fbclid,
  fbc,
  fbp,
  landing_page,
  referrer,
  created_at
FROM agendamentos
ORDER BY created_at DESC
LIMIT 3;

Quero confirmar que utm_source, fbc, fbp e landing_page estão sendo preenchidos
nos novos agendamentos (eram nulos antes do deploy de hoje).
```

---

## 🔍 Prompt 5 — Diagnóstico se algo der errado

```
A Edge Function meta-capi está respondendo com erro [colar erro aqui].
Por favor:
1. Mostre os logs das últimas 5 invocações da meta-capi
2. Confirme que os 3 secrets estão configurados (META_PIXEL_ID, META_CAPI_ACCESS_TOKEN, META_TEST_EVENT_CODE)
3. Teste fetch manual para o endpoint Meta:
   POST https://graph.facebook.com/v19.0/1003792428067622/events
   Body: { "data": [{"event_name":"PageView","event_time":<unix-now>,"event_id":"diag-test","action_source":"website","event_source_url":"https://drjulianomachado.com/","user_data":{"client_ip_address":"127.0.0.1","client_user_agent":"diag"}}], "access_token": "<META_CAPI_ACCESS_TOKEN>" }
4. Me diga se o erro está no token, no payload, ou na rede
```

---

## 🟢 Prompt 6 — Ligar produção (depois de 24-48h validando)

```
A integração Meta CAPI está validada (browser + server + dedup ≥90% por 24h).
Por favor:
1. Remova o secret META_TEST_EVENT_CODE do Lovable Cloud
2. Faça Publish para que a edge function meta-capi seja redeployada sem o test_event_code
3. Confirme nos logs que os próximos eventos NÃO contêm o campo test_event_code
4. Eventos agora vão para o reporting padrão (não mais Test Events) e começam a alimentar Andromeda AI
```

---

## 🔧 Prompt 11 — Fix `landing_page` URL absoluta (CAPI fix crítico)

> **Cole inteiro de uma vez.** Faz 2 mudanças em arquivos diferentes + Publish + validação SQL.

````
Por favor aplique 2 mudanças e faça Publish:

1. src/lib/tracking.ts — linha 65: trocar window.location.pathname por window.location.href

ANTES:
  captured.landing_page = captured.landing_page || window.location.pathname;

DEPOIS:
  // URL absoluta (não pathname) — Meta CAPI exige event_source_url completo
  captured.landing_page = captured.landing_page || window.location.href;

2. supabase/functions/meta-capi/index.ts — adicionar função normalizeSourceUrl e usar ela na construção do event:

a) Adicione esta função após getClientIp():

function normalizeSourceUrl(raw: string | null | undefined): string {
  const fallback = "https://drjulianomachado.com/";
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://drjulianomachado.com${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

b) No objeto event, troque:
  event_source_url,
por:
  event_source_url: normalizeSourceUrl(event_source_url),

Depois faça Publish do projeto. A edge function meta-capi vai redeployar
automaticamente, e o frontend novo vai entrar em produção pra que rows
futuros tenham landing_page como URL absoluta.

Validação: depois do publish, faça uma nova reserva em
https://drjulianomachado.com/agendamento?utm_source=url_fix_test
e rode SQL:
SELECT landing_page, utm_source FROM agendamentos ORDER BY created_at DESC LIMIT 1;
Esperado: landing_page começar com "https://drjulianomachado.com/agendamento?utm_source=url_fix_test"
````

---

## 🛠️ Prompt 7 — Configurar webhook do CAPI Gateway (opcional, futuro)

> Use só se a Meta liberar o CAPI Gateway pra essa BM. Por enquanto está com `gateway_status: NOT_ONBOARDED`.

```
A BM 493850516412413 ganhou acesso ao Conversions API Gateway da Meta.
Por favor configure o gateway no projeto e migre a edge function meta-capi
para usar o gateway managed em vez do POST direto para graph.facebook.com.
Mantenha a mesma interface (event_name, event_id, user_data, custom_data) para
não quebrar os call sites no frontend.
```

---

## 📋 Resumo do fluxo

| # | Prompt | Tempo |
|---|---|---|
| 1 | Configurar secrets | 1 min |
| 2 | Deploy + validação | 2 min |
| 3 | Smoke test do endpoint | 1 min |
| **Manual** | Importar GTM no Tag Manager | 3 min |
| **Manual** | Fazer 1 reserva real no site | 5 min |
| 4 | Validar UTMs no banco | 1 min |
| ⏸️ | Soak time 24-48h | — |
| 6 | Ligar produção | 1 min |
| **Total** | | ~14 min + soak |

---

## Observação sobre o GTM

O GTM **não** está dentro do Lovable — é serviço Google separado. Esse passo
você precisa fazer manualmente em `tagmanager.google.com` importando o arquivo
`gtm-meta-pixel-import.json` (vide `IMPLEMENTACAO.md` passo 6).
