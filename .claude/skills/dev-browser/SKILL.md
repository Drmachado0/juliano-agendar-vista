---
name: dev-browser
description: Ferramenta PADRÃO de browser deste repo. Use sempre que precisar abrir/navegar um site, clicar, preencher formulário, tirar screenshot, extrair dados de página, validar visualmente uma mudança de UI, testar o fluxo de agendamento ou o CRM no navegador. Gatilhos - "abre o site", "tira um print", "clica em", "preenche o formulário", "testa no navegador", "valida a landing page", "confere o layout", "faz login", "scrape". Prefira esta skill a qualquer outra automação de browser (Playwright direto, Puppeteer, MCP de browser).
---

# Dev Browser (padrão do projeto)

CLI que controla um Chromium com scripts JavaScript em sandbox (QuickJS WASM).
Upstream: https://github.com/SawyerHood/dev-browser

**Esta é a ferramenta padrão de browser deste repositório.** Não instale nem
use Puppeteer, Playwright direto ou outro MCP de browser sem o usuário pedir.

## Antes de tudo

```bash
dev-browser --help   # imprime o guia de uso pra LLM + a API completa
```

Se o comando não existir, rode `.claude/hooks/session-start.sh` (ele instala o
CLI e liga o Chromium pré-instalado do container).

## Subir o app deste projeto

O `vite.config.ts` usa `host: "::"` (IPv6), que **não funciona** no container
remoto. Sempre suba assim:

```bash
npm run dev -- --host 127.0.0.1   # http://127.0.0.1:8080/
```

Depois navegue sempre por `http://127.0.0.1:8080/...` (localhost não passa pelo
proxy de egress).

## Uso

Sempre `--headless` no ambiente remoto (não há display):

```bash
dev-browser --headless --timeout 60 <<'EOF'
const page = await browser.getPage("app");
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
console.log(await page.title());
EOF
```

Páginas nomeadas (`getPage("app")`) **persistem entre execuções** — navegue uma
vez e continue interagindo nos scripts seguintes sem recarregar.

### Screenshot (e depois leia o arquivo)

```bash
dev-browser --headless <<'EOF'
const page = await browser.getPage("app");
const p = await saveScreenshot(await page.screenshot({ fullPage: true }), "home.png");
console.log(p);   // ~/.dev-browser/tmp/home.png -> abra com a tool Read
EOF
```

### Descobrir elementos numa página desconhecida

```bash
dev-browser --headless <<'EOF'
const page = await browser.getPage("app");
console.log((await page.snapshotForAI({ track: "main", timeout: 5000 })).full);
EOF
# depois: await page.getByRef("e12").click({ timeout: 5000 });
```

## Regras de ouro

- Um script = uma decisão. Termine logando só o estado necessário pro próximo passo.
- Dentro de `page.evaluate(...)` use JavaScript puro (sem TypeScript).
- O sandbox não tem `require`, `fetch`, `process` nem `fs`. Só `browser`,
  `console`, `setTimeout`, `saveScreenshot`, `writeFile`, `readFile`.
- I/O de arquivo é restrito a `~/.dev-browser/tmp/`.
- Egress externo é bloqueado pela política do container: navegue em
  `127.0.0.1`. Sites externos costumam falhar com `ERR_TUNNEL_CONNECTION_FAILED`.
- Ao terminar uma bateria de testes: `dev-browser stop`.

## Cuidado com dados reais

Este projeto tem CRM e agendamentos de pacientes reais (Supabase). Ao automatizar
o navegador, não crie, altere nem cancele agendamento em produção sem o usuário
pedir explicitamente. Prefira `.env.development` / ambiente de dev.
