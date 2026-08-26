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
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";

const DIST = "dist";
const PORTA = 4321;
const ESPERA_APOS_LOAD = 2500; // margem para o JSON-LD do helmet entrar no head

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

async function main() {
  if (!existsSync(join(DIST, "index.html"))) {
    console.warn("[prerender] dist/index.html nao existe. Rode o build antes. Pulando.");
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.warn(
      "[prerender] playwright indisponivel neste ambiente. Pulando — a SPA e publicada normalmente."
    );
    return;
  }

  const rotas = await rotasDoSitemap();
  const servidor = servir();
  await new Promise((r) => servidor.listen(PORTA, r));

  let browser;
  let ok = 0;
  let falhas = 0;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.warn(
      `[prerender] Chromium nao pode ser iniciado (${String(e).slice(0, 80)}). Pulando.`
    );
    servidor.close();
    return;
  }

  for (const rota of rotas) {
    const pagina = await browser.newPage();
    try {
      await pagina.goto(`http://127.0.0.1:${PORTA}${rota}`, {
        waitUntil: "networkidle",
        timeout: 45000,
      });
      await pagina.waitForTimeout(ESPERA_APOS_LOAD);

      const html = await pagina.content();

      // Sanidade: se o conteudo nao renderizou, gravar seria pior que nao fazer
      // nada — congelaria uma pagina vazia no lugar do shell que ao menos monta
      // no cliente.
      const temH1 = /<h1[\s>]/i.test(html);
      const temCanonical = /rel="canonical"/i.test(html);
      if (!temH1 || !temCanonical) {
        console.warn(`[prerender] ${rota}: sem h1 ou canonical apos render. Mantido o shell.`);
        falhas++;
      } else {
        const destino =
          rota === "/" ? join(DIST, "index.html") : join(DIST, rota, "index.html");
        await mkdir(dirname(destino), { recursive: true });
        await writeFile(destino, html, "utf-8");
        ok++;
      }
    } catch (e) {
      console.warn(`[prerender] ${rota}: ${String(e).slice(0, 90)}`);
      falhas++;
    }
    await pagina.close();
  }

  await browser.close();
  servidor.close();
  console.log(`[prerender] ${ok} rota(s) prerenderizada(s), ${falhas} mantida(s) como shell.`);
}

main().catch((e) => {
  // Nunca derruba o build.
  console.warn(
    `[prerender] falhou: ${String(e).slice(0, 120)}. A SPA e publicada normalmente.`
  );
});
