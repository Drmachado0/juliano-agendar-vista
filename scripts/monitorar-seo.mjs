/**
 * Monitor de SEO contra o site publicado.
 *
 * POR QUE: a auditoria de 27/08/2026 achou coisas que nenhum teste pegaria,
 * porque nao sao propriedades do codigo e sim do site NO AR: titulo cortado no
 * resultado de busca, canonical duplicado, rota fora do sitemap, prerender que
 * parou de rodar no build do host. A suite local passa com todos eles quebrados.
 *
 * Este script fecha essa lacuna. Ele nao substitui os testes — complementa: os
 * testes guardam o que esta no repositorio, este guarda o que chegou no ar.
 *
 * POR QUE NAO ENTRA NO BUILD NEM NO CI: bate em producao pela rede. Travar
 * deploy por indisponibilidade momentanea do site seria trocar um problema por
 * outro. Rode sob demanda:
 *
 *   npm run monitorar:seo
 *   npm run monitorar:seo -- --json      (saida para pipeline)
 *
 * SAIDA: codigo 0 se tudo passa, 1 se ha regressao. O que ele checa:
 *
 *   1. prerender-status.json — se o passo de build rodou no host e com que
 *      resultado. Ausente significa que o host parou de rodar o script "build".
 *   2. Sitemap x rotas vivas — toda <loc> responde 200 e monta de verdade.
 *   3. Invariantes de cada pagina — 1 h1, 1 canonical auto-referente, titulo
 *      ate 60 caracteres, description entre 120 e 160, sem noindex, sem titulo
 *      ou description duplicados entre paginas.
 *   4. CrUX — LCP, FCP, TTFB e CLS de campo, comparados aos limiares do Google.
 *      Precisa de chave: variavel CRUX_API_KEY ou o arquivo de config do
 *      claude-seo. Sem chave, esta secao e pulada, nao falha.
 *
 * LIMITE: nao julga se o texto e bom, se a description descreve a pagina, nem
 * se o conteudo clinico esta correto. Isso continua sendo revisao humana.
 */

import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "https://drjulianomachado.com";
const JSON_SAIDA = process.argv.includes("--json");

// Titulo e description sao convencao de SERP; os de CWV sao os limiares do
// proprio Google (bom / precisa melhorar / ruim).
const LIMITES = {
  tituloMax: 60,
  descMin: 120,
  descMax: 160,
  lcpBom: 2500,
  lcpRuim: 4000,
  fcpBom: 1800,
  fcpRuim: 3000,
  ttfbBom: 800,
  ttfbRuim: 1800,
  clsBom: 0.1,
  clsRuim: 0.25,
};

const problemas = [];
const avisos = [];
const relatorio = { verificadoEm: new Date().toISOString(), base: BASE };

const falha = (msg) => problemas.push(msg);
const avisa = (msg) => avisos.push(msg);
const log = (msg) => { if (!JSON_SAIDA) console.log(msg); };

/** Le a chave da CrUX sem nunca embuti-la aqui. */
function chaveCrux() {
  if (process.env.CRUX_API_KEY) return process.env.CRUX_API_KEY;
  const cfg = join(homedir(), ".config", "claude-seo", "google-api.json");
  if (!existsSync(cfg)) return null;
  try {
    return JSON.parse(readFileSync(cfg, "utf-8")).api_key || null;
  } catch {
    return null;
  }
}

async function checarPrerender() {
  const r = await fetch(`${BASE}/prerender-status.json`).catch(() => null);
  if (!r || !r.ok) {
    falha(
      "prerender-status.json ausente (HTTP " +
        (r ? r.status : "sem resposta") +
        "). O host pode ter parado de rodar o script build do package.json.",
    );
    return;
  }
  const s = await r.json();
  relatorio.prerender = s;
  if (s.motivo === "ok") {
    log(`  prerender: ok, ${s.rotas} rota(s) em ${s.segundos}s`);
  } else {
    // Nao e falha: na Lovable o prerender nao roda por falta de bibliotecas de
    // sistema do Chromium, e a decisao registrada foi aceitar. Vira aviso para
    // continuar visivel sem sujar o codigo de saida.
    avisa(`prerender nao rodou no host: motivo "${s.motivo}" (esperado na Lovable)`);
  }
}

async function rotasDoSitemap() {
  const r = await fetch(`${BASE}/sitemap.xml`);
  if (!r.ok) {
    falha(`sitemap.xml devolveu HTTP ${r.status}`);
    return [];
  }
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function checarPaginas(urls) {
  const navegador = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const paginas = [];

  for (const url of urls) {
    const p = await navegador.newPage();
    const rota = url.replace(BASE, "") || "/";
    try {
      const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      if (resp?.status() !== 200) falha(`${rota}: HTTP ${resp?.status()}`);

      // Espera o app montar. Sem isso o HTML e casca e TUDO daria falso
      // negativo — foi exatamente o erro que a auditoria quase cometeu.
      await p.waitForSelector("h1", { timeout: 30000 });
      await p.waitForFunction(
        () => !!document.querySelector('link[rel="canonical"]'),
        { timeout: 20000 },
      );

      const m = await p.evaluate(() => {
        const qa = (s) => [...document.querySelectorAll(s)];
        const q = (s) => document.querySelector(s);
        return {
          title: document.title,
          desc: q('meta[name="description"]')?.content || "",
          canonical: q('link[rel="canonical"]')?.href || "",
          canonicais: qa('link[rel="canonical"]').length,
          descs: qa('meta[name="description"]').length,
          h1s: qa("h1").length,
          robots: q('meta[name="robots"]')?.content || "",
        };
      });

      if (m.h1s !== 1) falha(`${rota}: ${m.h1s} h1 (esperado 1)`);
      if (m.canonicais !== 1) falha(`${rota}: ${m.canonicais} canonical (esperado 1)`);
      if (m.descs !== 1) falha(`${rota}: ${m.descs} meta description (esperado 1)`);
      if (m.canonical !== url) falha(`${rota}: canonical aponta para ${m.canonical}`);
      if (/noindex/i.test(m.robots)) falha(`${rota}: marcada como noindex`);
      if (m.title.length > LIMITES.tituloMax)
        falha(`${rota}: titulo com ${m.title.length} caracteres (max ${LIMITES.tituloMax})`);
      if (m.desc.length > LIMITES.descMax || m.desc.length < LIMITES.descMin)
        avisa(
          `${rota}: description com ${m.desc.length} caracteres (ideal ${LIMITES.descMin}-${LIMITES.descMax})`,
        );

      paginas.push({ rota, ...m });
      log(`  ${rota} — titulo ${m.title.length}, desc ${m.desc.length}`);
    } catch (e) {
      falha(`${rota}: ${String(e).slice(0, 120)}`);
    }
    await p.close();
  }

  await navegador.close();
  relatorio.paginas = paginas;

  // Titulo ou description repetidos fazem as paginas competirem entre si.
  for (const campo of ["title", "desc"]) {
    const vistos = new Map();
    for (const p of paginas) {
      const v = p[campo];
      if (!v) continue;
      if (vistos.has(v)) falha(`${campo} duplicado entre ${vistos.get(v)} e ${p.rota}`);
      else vistos.set(v, p.rota);
    }
  }
}

async function checarCrux() {
  const chave = chaveCrux();
  if (!chave) {
    avisa("sem chave da CrUX (CRUX_API_KEY ou config do claude-seo); secao de campo pulada");
    return;
  }

  // queryHistoryRecord, nao queryRecord.
  //
  // POR QUE: o registro corrente exige trafego suficiente na janela de 28 dias,
  // e este site nao atinge. queryRecord devolve 404 "chrome ux report data not
  // found" em origin, url e em qualquer formFactor. A serie historica semanal
  // responde 200 e traz o que existe.
  //
  // E ela e ESPARSA: das ultimas 6 semanas, so uma tinha valor. Por isso o
  // codigo pega o ultimo ponto NAO nulo e informa a data da janela dele. Ler o
  // ultimo elemento do array daria null e o monitor diria "sem dados" tendo
  // dados de duas semanas atras.
  //
  // Os nomes tambem diferem deste lado: aqui e largest_contentful_paint, sem o
  // sufixo _ms que o queryRecord usa.
  const r = await fetch(
    `https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=${chave}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: BASE }),
    },
  ).catch(() => null);

  if (!r || !r.ok) {
    avisa("CrUX sem dados historicos para esta origem; secao de campo pulada");
    return;
  }

  const dados = await r.json();
  const met = dados?.record?.metrics || {};
  const janelas = dados?.record?.collectionPeriods || [];

  /** Ultimo p75 nao nulo, com a data da janela em que foi medido. */
  const ultimo = (nome) => {
    const serie = met[nome]?.percentilesTimeseries?.p75s;
    if (!Array.isArray(serie)) return null;
    for (let i = serie.length - 1; i >= 0; i--) {
      const v = serie[i];
      if (v === null || v === undefined) continue;
      const d = janelas[i]?.lastDate;
      return {
        valor: Number(v),
        data: d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "?",
        semanasAtras: serie.length - 1 - i,
      };
    }
    return null;
  };

  const METRICAS = [
    ["LCP", "largest_contentful_paint", LIMITES.lcpBom, LIMITES.lcpRuim, "ms"],
    ["FCP", "first_contentful_paint", LIMITES.fcpBom, LIMITES.fcpRuim, "ms"],
    ["TTFB", "experimental_time_to_first_byte", LIMITES.ttfbBom, LIMITES.ttfbRuim, "ms"],
    ["CLS", "cumulative_layout_shift", LIMITES.clsBom, LIMITES.clsRuim, ""],
    ["INP", "interaction_to_next_paint", 200, 500, "ms"],
  ];

  relatorio.crux = {};
  let algum = false;

  for (const [rotulo, nome, bom, ruim, un] of METRICAS) {
    const u = ultimo(nome);
    if (!u || !Number.isFinite(u.valor)) {
      log(`  CrUX ${rotulo}: sem dados`);
      continue;
    }
    algum = true;
    const faixa = u.valor <= bom ? "bom" : u.valor <= ruim ? "precisa melhorar" : "ruim";
    const idade = u.semanasAtras === 0 ? "semana atual" : `${u.semanasAtras} semana(s) atras`;
    relatorio.crux[rotulo] = { valor: u.valor, faixa, medidoEm: u.data };
    log(`  CrUX ${rotulo}: ${u.valor}${un} — ${faixa} (janela ate ${u.data}, ${idade})`);
    // Campo ruim vira aviso, nao falha: a causa conhecida e estrutural (SPA sem
    // prerender no host) e a decisao registrada foi aceitar. Falhar aqui faria
    // o monitor gritar todo dia por algo ja decidido.
    if (faixa === "ruim") avisa(`CrUX ${rotulo} em ${u.valor}${un}, faixa ruim (medido ate ${u.data})`);
  }

  if (!algum) {
    avisa("CrUX respondeu mas a serie esta vazia; trafego insuficiente na janela");
  } else {
    log("  nota: a serie e esparsa; semanas sem trafego suficiente vem vazias");
  }
}

async function main() {
  log(`Monitor de SEO — ${BASE}\n`);

  log("[1/4] prerender");
  await checarPrerender();

  log("\n[2/4] sitemap");
  const urls = await rotasDoSitemap();
  log(`  ${urls.length} rota(s) declaradas`);
  relatorio.rotas = urls.length;

  if (urls.length) {
    log("\n[3/4] paginas");
    await checarPaginas(urls);
  }

  log("\n[4/4] dados de campo");
  await checarCrux();

  relatorio.problemas = problemas;
  relatorio.avisos = avisos;

  if (JSON_SAIDA) {
    console.log(JSON.stringify(relatorio, null, 2));
  } else {
    log("\n" + "-".repeat(60));
    if (avisos.length) {
      log(`\n${avisos.length} aviso(s):`);
      avisos.forEach((a) => log(`  · ${a}`));
    }
    if (problemas.length) {
      log(`\n${problemas.length} REGRESSAO(OES):`);
      problemas.forEach((p) => log(`  x ${p}`));
    } else {
      log("\nNenhuma regressao.");
    }
  }

  process.exit(problemas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`monitor falhou: ${e}`);
  process.exit(2);
});
