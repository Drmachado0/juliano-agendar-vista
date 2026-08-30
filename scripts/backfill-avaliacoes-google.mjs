// Backfill: raspa TODAS as avaliacoes publicas do perfil no Google Maps e gera
// um SQL de upsert para rodar no SQL Editor do Supabase (Lovable cloud).
//
// Por que assim: a Places API devolve no maximo 5 avaliacoes por chamada, entao
// o cron nunca passou de 17. O Maps mostra o historico completo na aba de
// avaliacoes; este script abre essa aba num navegador real, rola ate o fim,
// expande os textos truncados e extrai autor, foto, nota, data relativa e texto.
//
// Uso: node scripts/backfill-avaliacoes-google.mjs
//      node scripts/backfill-avaliacoes-google.mjs --from-json scripts/.reviews-raw.json
// Sai: scripts/backfill-avaliacoes-google.json e .sql
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const URL_MAPS =
  "https://www.google.com/maps/place/Dr+Juliano+Machado+-+Oftalmologista/@-2.9927566,-47.3578126,17z/data=!4m8!3m7!1s0x92b75df6a9424bcf:0xe65d9b7570a51339!8m2!3d-2.9927566!4d-47.3552377!9m1!1b1!16s%2Fg%2F11l2j4k6yb?hl=pt-BR";

const fromJson = process.argv.indexOf("--from-json");
let reviews;

if (fromJson !== -1) {
  reviews = JSON.parse(readFileSync(process.argv[fromJson + 1], "utf8"));
  console.log("reprocessando", reviews.length, "registros de", process.argv[fromJson + 1]);
} else {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(URL_MAPS, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  // clicar na nota abre a visao de avaliacoes
  const nota = page.locator('button[aria-label*="estrela"], div[aria-label*="5,0"]').first();
  await nota.click({ timeout: 15000 });
  await page.waitForSelector("[data-review-id]", { timeout: 20000 });
  console.log("visao de avaliacoes aberta");

  // rola ate estabilizar, expandindo os "Mais" dos textos longos
  let lastCount = 0;
  let estavel = 0;
  for (let i = 0; i < 80 && estavel < 4; i++) {
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll("button.w8nwRe")) {
        if (btn.offsetParent) btn.click();
      }
      for (const el of document.querySelectorAll('div[role="main"] div')) {
        if (el.scrollHeight > el.clientHeight + 100) el.scrollTop = el.scrollHeight;
      }
    });
    await page.waitForTimeout(1200);
    const count = await page.locator("[data-review-id]").count();
    if (i % 5 === 0 || count !== lastCount) console.log(`rodada ${i}: ${count} avaliacoes no DOM`);
    estavel = count === lastCount ? estavel + 1 : 0;
    lastCount = count;
  }

  reviews = await page.evaluate(() => {
    const out = [];
    // so o cartao raiz: elementos aninhados repetem o data-review-id
    const cards = [...document.querySelectorAll(".jftiEf[data-review-id]")].filter(
      (el) => !el.parentElement.closest("[data-review-id]"),
    );
    for (const card of cards) {
      const q = (sel) => card.querySelector(sel);
      const nome = q(".d4r55")?.textContent?.trim();
      if (!nome) continue;
      const starsEl = q(".kvMYJc");
      const m = starsEl?.getAttribute("aria-label")?.match(/(\d+(?:[.,]\d+)?)/);
      // texto do paciente fica em .MyEned; o .wiI7pd dentro de .CDe7pd e a
      // resposta do proprietario e nao entra no mural
      const textoEl =
        q(".MyEned .wiI7pd") ??
        [...card.querySelectorAll(".wiI7pd")].find((el) => !el.closest(".CDe7pd"));
      out.push({
        review_id: card.getAttribute("data-review-id"),
        author_name: nome,
        author_photo_url: q("img.NBa7we")?.getAttribute("src") || null,
        rating: m ? Math.round(parseFloat(m[1].replace(",", "."))) : null,
        relative_time: q(".rsqaWe")?.textContent?.trim().replace(/^Editado\s+/i, "") || null,
        text: textoEl?.textContent?.trim() || null,
      });
    }
    return out;
  });

  await browser.close();
  console.log("extraidas:", reviews.length);
  writeFileSync("scripts/.reviews-raw.json", JSON.stringify(reviews));
}

/*
  O Maps renderiza cada avaliacao em ate 3 elementos aninhados com o mesmo
  data-review-id, e nem todos com o texto ja expandido. Dedup pelo review_id
  ficando com a versao de texto mais longa.
*/
const byId = new Map();
for (const r of reviews) {
  const key = r.review_id || r.author_name;
  const prev = byId.get(key);
  if (!prev || (r.text?.length || 0) > (prev.text?.length || 0)) byId.set(key, r);
}
reviews = [...byId.values()];
console.log("unicas apos dedupe:", reviews.length);

// data relativa pt-BR -> epoch aproximado (para ordenacao no mural)
function relToEpoch(rel) {
  if (!rel) return null;
  const s = rel.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const num = (() => {
    if (/^(um|uma|há um|há uma)\b/.test(s) || /^um\b/.test(s)) return 1;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  })();
  const unidade = s.includes("ano")
    ? 31557600
    : s.includes("mês") || s.includes("mes")
      ? 2629800
      : s.includes("semana")
        ? 604800
        : s.includes("dia") || s.includes("ontem")
          ? 86400
          : s.includes("hora")
            ? 3600
            : s.includes("minuto")
              ? 60
              : null;
  return unidade ? now - num * unidade : null;
}

const norm = reviews.map((r) => ({
  google_review_id: `maps_${r.review_id || `${r.author_name.replace(/\s+/g, "_")}_${r.rating}`}`,
  author_name: r.author_name,
  author_photo_url: r.author_photo_url,
  rating: Math.max(1, Math.min(5, r.rating ?? 5)),
  text: r.text,
  relative_time_description: r.relative_time,
  time_epoch: relToEpoch(r.relative_time),
  language: "pt-BR",
}));

writeFileSync("scripts/backfill-avaliacoes-google.json", JSON.stringify(norm, null, 2));

/*
  Quantos caracteres de texto entram na identidade de uma avaliacao. Precisa ser
  o mesmo ASSINATURA_TEXTO de src/lib/testimonialsPool.ts. Ver a nota no DELETE
  gerado logo abaixo.
*/
const ASSINATURA_TEXTO = 60;

const esc = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const values = norm
  .map(
    (r) =>
      `  (${esc(r.google_review_id)}, ${esc(r.author_name)}, ${esc(r.author_photo_url)}, ${r.rating}, ${esc(r.text)}, ${esc(r.relative_time_description)}, ${r.time_epoch ?? "NULL"}, ${esc(r.language)}, true)`,
  )
  .join(",\n");

const sql = `-- Backfill das avaliacoes do Google Maps (${norm.length} avaliacoes extraidas em ${new Date().toISOString()})
-- Rodar no SQL Editor do Supabase. Idempotente: pode rodar mais de uma vez.

INSERT INTO public.avaliacoes_google
  (google_review_id, author_name, author_photo_url, rating, text, relative_time_description, time_epoch, language, ativo)
VALUES
${values}
ON CONFLICT (google_review_id) DO UPDATE SET
  author_photo_url = EXCLUDED.author_photo_url,
  rating = EXCLUDED.rating,
  text = EXCLUDED.text,
  relative_time_description = EXCLUDED.relative_time_description,
  time_epoch = COALESCE(EXCLUDED.time_epoch, public.avaliacoes_google.time_epoch),
  ativo = true,
  updated_at = now();

-- Remove as linhas antigas (formato Autor_timestamp do Places API) que tem uma
-- gemea nova, ou seja, mesmo autor e mesmo comeco de texto.
--
-- ESTA REGRA E ESPELHO de identidade() em src/lib/testimonialsPool.ts, e as
-- duas PRECISAM normalizar igual. O JS faz trim, colapsa espaco, minuscula e
-- corta em ${ASSINATURA_TEXTO}, nessa ordem. Se voce mexer em ASSINATURA_TEXTO
-- ou na normalizacao de um lado sem mexer no outro, sobram duplicatas no mural.
--
-- Duas copias sao inevitaveis aqui: o SQL precisa calcular a identidade das
-- linhas ANTIGAS, que so existem no banco e que este script nunca teve em maos.
--
-- btrim() sozinho NAO serve: ele tira espaco e nao tira quebra de linha, e o
-- .trim() do JS tira as duas. Um \\n no inicio deslocaria a janela em um
-- caractere e as chaves deixariam de bater.
DELETE FROM public.avaliacoes_google antiga
WHERE antiga.google_review_id NOT LIKE 'maps\\_%'
  AND EXISTS (
    SELECT 1 FROM public.avaliacoes_google nova
    WHERE nova.google_review_id LIKE 'maps\\_%'
      AND lower(regexp_replace(COALESCE(nova.author_name, ''), '^\\s+|\\s+$', '', 'g'))
        = lower(regexp_replace(COALESCE(antiga.author_name, ''), '^\\s+|\\s+$', '', 'g'))
      AND left(lower(regexp_replace(regexp_replace(COALESCE(nova.text, ''), '^\\s+|\\s+$', '', 'g'), '\\s+', ' ', 'g')), ${ASSINATURA_TEXTO})
        = left(lower(regexp_replace(regexp_replace(COALESCE(antiga.text, ''), '^\\s+|\\s+$', '', 'g'), '\\s+', ' ', 'g')), ${ASSINATURA_TEXTO})
  );
`;

writeFileSync("scripts/backfill-avaliacoes-google.sql", sql);
console.log("gravados scripts/backfill-avaliacoes-google.json e .sql");
const comTexto = norm.filter((r) => r.text).length;
console.log(`total: ${norm.length}, com texto: ${comTexto}, sem texto: ${norm.length - comTexto}`);
