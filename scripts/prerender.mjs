/**
 * Prerender pos-build das rotas publicas.
 *
 * POR QUE: o site e uma SPA. O HTML servido tem ~5 KB e nenhum conteudo — tudo
 * e montado no cliente. Consequencias medidas na auditoria de SEO:
 *   - LCP mobile em 4,4-5,1 s, porque nada pinta antes de baixar e executar o JS
 *   - crawlers de IA que nao executam JS (boa parte deles) veem uma pagina vazia
 *   - canonical, description e JSON-LD so existem depois do react-helmet-async
 *
 * COMO: em vez de migrar para SSR — que exigiria separar o BrowserRouter, criar
 * entry de servidor e lidar com hidratacao num app com Supabase, consent e
 * tracking —, este script pega o build pronto, abre cada rota num Chromium
 * headless e salva o HTML ja renderizado em dist/<rota>/index.html.
 *
 * O React monta por cima com createRoot().render(), que substitui o conteudo em
 * vez de hidratar. Nao ha risco de erro de hidratacao: o HTML prerenderizado
 * serve ao crawler e ao primeiro paint, e o app assume em seguida.
 *
 * FALHA SUAVE, DE PROPOSITO: se o Chromium nao estiver disponivel no ambiente de
 * build, o script avisa e sai com codigo 0. O build continua e publica a SPA
 * normal. Prerender e ganho, nao dependencia — nunca deve derrubar um deploy.
 */

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";

const DIST = "dist";
const PORTA = 4321;
/** Rotas renderizadas ao mesmo tempo. Acima disso a maquina do build sofre. */
const PARALELAS = 4;
/**
 * Prazo total. Estourou, o que ja foi gravado fica e o resto segue como shell.
 * Existe para o script nunca pendurar um deploy: sem isso, um Chromium travado
 * segura o build indefinidamente.
 */
const PRAZO_MS = 120000;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff2": "font/woff2",
};

/** Rotas publicas, lidas do sitemap para nao duplicar a lista. */
async function rotasDoSitemap() {
  const xml = await readFile(join("public", "sitemap.xml"), "utf-8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, "") || "/")
    .filter((r) => r.startsWith("/"));
}

/** Servidor estatico com fallback de SPA, igual ao que o hosting faz. */
function servir() {
  return createServer(async (req, res) => {
    const caminho = decodeURIComponent((req.url || "/").split("?")[0]);
    const tentativas = [join(DIST, caminho), join(DIST, caminho, "index.html")];
    for (const t of tentativas) {
      if (existsSync(t) && extname(t)) {
        try {
          const buf = await readFile(t);
          res.writeHead(200, {
            "Content-Type": TIPOS[extname(t)] || "application/octet-stream",
          });
          return res.end(buf);
        } catch {
          /* cai no fallback */
        }
      }
    }
    const html = await readFile(join(DIST, "index.html"));
    res.writeHead(200, { "Content-Type": TIPOS[".html"] });
    res.end(html);
  });
}

/**
 * Abre o Chromium; se o binario nao estiver no ambiente, baixa e tenta de novo.
 *
 * POR QUE: `playwright` so baixa o navegador num postinstall, e havia tres
 * jeitos de esse passo nao acontecer no build de producao — devDependencies
 * pulada por install de producao, bun bloqueando lifecycle script, e npm com
 * --ignore-scripts. Bastava um deles para este script cair no catch e publicar
 * o site inteiro como casca de 5 KB, com a suite local passando porque AQUI o
 * navegador existe. Os dois primeiros viraram `dependencies` e
 * `trustedDependencies` no package.json; este retry cobre o terceiro.
 *
 * Continua sem poder derrubar o build: se o download falhar, devolve null e o
 * chamador publica a SPA normalmente.
 */
let porqueSemChromium = null;

async function abrirNavegador(chromium) {
  try {
    return await chromium.launch();
  } catch (primeiro) {
    console.warn(
      `[prerender] Chromium ausente (${String(primeiro).slice(0, 60)}). Baixando uma vez...`
    );
    try {
      execFileSync("npx", ["--yes", "playwright", "install", "chromium"], {
        stdio: "inherit",
        timeout: 180000,
        shell: process.platform === "win32",
      });
      return await chromium.launch();
    } catch (segundo) {
      // Guardado para o relatorio: o texto do erro separa causas que pedem
      // saidas diferentes — bloqueio de rede ao CDN da Playwright, falta de
      // permissao de escrita, prazo estourado, ou dependencia de sistema
      // faltando no container. Sem ele, "sem-chromium" nao diz o que tentar.
      porqueSemChromium = {
        aoAbrir: String(primeiro).slice(0, 300),
        aoBaixar: String(segundo).slice(0, 300),
      };
      console.warn(
        `[prerender] sem Chromium apos o download (${String(segundo).slice(0, 60)}). Pulando.`
      );
      return null;
    }
  }
}

/**
 * Grava dist/prerender-status.json em toda saida, inclusive nas que pulam.
 *
 * POR QUE: a falha suave acima e correta — prerender e ganho, nao deve derrubar
 * deploy. Mas ela era SILENCIOSA, e silencio em producao e indistinguivel de
 * sucesso. O site publicou casca de 9 KB em todas as 18 rotas por varios
 * deploys enquanto o build local prerenderizava as 18, porque aqui o Chromium
 * existe e no servidor de build nao. Ninguem tinha como saber sem pedir o HTML
 * cru e contar bytes.
 *
 * Este arquivo torna o resultado observavel de fora: GET /prerender-status.json
 * no site publicado diz o que aconteceu no ultimo build.
 *
 * Ele tambem separa as duas causas possiveis, que pedem condutas OPOSTAS:
 *   - arquivo AUSENTE em producao  -> o host nao roda o script "build" do
 *     package.json; encadear o prerender ali nunca vai funcionar
 *   - motivo "sem-chromium"        -> o host roda o script, mas nao consegue o
 *     navegador; a saida e obter o binario ou trocar por SSG sem navegador
 */
async function registrar(motivo, extra = {}) {
  try {
    await mkdir(DIST, { recursive: true });
    await writeFile(
      join(DIST, "prerender-status.json"),
      JSON.stringify({ motivo, ...extra, em: new Date().toISOString() }, null, 2),
      "utf-8"
    );
  } catch {
    // Diagnostico nunca pode ser o que derruba o build.
  }
}

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.warn("[prerender] dist/index.html nao existe. Rode o build antes. Pulando.");
    await registrar("sem-dist");
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.warn(
      "[prerender] playwright indisponivel neste ambiente. Pulando — a SPA e publicada normalmente."
    );
    await registrar("playwright-indisponivel");
    return;
  }

  const rotas = await rotasDoSitemap();
  const servidor = servir();
  await new Promise((r) => servidor.listen(PORTA, r));

  let browser;
  let ok = 0;
  let falhas = 0;
  browser = await abrirNavegador(chromium);
  if (!browser) {
    servidor.close();
    await registrar("sem-chromium", porqueSemChromium ?? {});
    return;
  }

  const inicio = Date.now();
  const fila = [...rotas];

  // Imagens, video e fonte nao mudam o HTML capturado, so o tempo de carga.
  // Bloquear derruba o tempo por rota sem alterar o resultado.
  const PESADOS = new Set(["image", "media", "font"]);

  const trabalhador = async () => {
    const pagina = await browser.newPage();
    await pagina.route("**/*", (rota) =>
      PESADOS.has(rota.request().resourceType()) ? rota.abort() : rota.continue()
    );

    while (fila.length) {
      if (Date.now() - inicio > PRAZO_MS) {
        console.warn("[prerender] prazo estourado; rotas restantes ficam como shell.");
        fila.length = 0;
        break;
      }
      const rota = fila.shift();
      try {
        await pagina.goto(`http://127.0.0.1:${PORTA}${rota}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        // Espera o sinal real de que o app montou, em vez de um atraso fixo.
        await pagina.waitForSelector("h1", { timeout: 15000 });
        await pagina.waitForFunction(
          () => !!document.querySelector('link[rel="canonical"]'),
          { timeout: 10000 }
        );
        // h1 + canonical provam que o app montou, mas nao que os dados
        // chegaram: sem esta espera, o bloco de depoimentos era congelado
        // vazio, sem nenhum card do Google. Limitada para nao virar o gargalo
        // que a versao sequencial era.
        await pagina
          .waitForLoadState("networkidle", { timeout: 8000 })
          .catch(() => {});

        const html = await pagina.content();
        if (!/<h1[\s>]/i.test(html) || !/rel="canonical"/i.test(html)) {
          console.warn(`[prerender] ${rota}: sem h1 ou canonical. Mantido o shell.`);
          falhas++;
          continue;
        }
        const destino =
          rota === "/" ? join(DIST, "index.html") : join(DIST, rota, "index.html");
        await mkdir(dirname(destino), { recursive: true });
        await writeFile(destino, html, "utf-8");
        ok++;
      } catch (e) {
        console.warn(`[prerender] ${rota}: ${String(e).slice(0, 70)}`);
        falhas++;
      }
    }
    await pagina.close();
  };

  await Promise.all(
    Array.from({ length: Math.min(PARALELAS, rotas.length) }, trabalhador)
  );

  await browser.close();
  servidor.close();
  const segundos = Math.round((Date.now() - inicio) / 1000);
  await registrar(ok > 0 ? "ok" : "nenhuma-rota", {
    rotas: ok,
    shell: falhas,
    segundos,
  });
  console.log(
    `[prerender] ${ok} rota(s) em ${segundos}s, ${falhas} mantida(s) como shell.`
  );
}

main().catch((e) => {
  // Nunca derruba o build.
  console.warn(
    `[prerender] falhou: ${String(e).slice(0, 120)}. A SPA e publicada normalmente.`
  );
  return registrar("erro", { erro: String(e).slice(0, 200) });
});
