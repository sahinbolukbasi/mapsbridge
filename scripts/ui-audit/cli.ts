/**
 * MapsBridge UI denetim aracı.
 *
 *   npm run ui:audit -- --metrics [--out metrics.json]
 *   npm run ui:audit -- --screenshots <dir> --axe-out <file.json> [--base-url http://localhost:3000]
 *   npm run ui:audit -- --leaflet <snapshot.json> [--unlayer] [--session-all] [--out-dir <out>]
 *   npm run ui:audit -- --leaflet-compare <a.json> <b.json> --mode cascade|commits --report <rapor.json>
 *   npm run ui:audit -- --compare <before-dir> <after-dir> [--out compare.html]
 *   npm run ui:audit -- --chrome-check <rapor.json> [--session-all] [--strict]
 *
 * Varsayılan olarak apps/web/out statik export'unu 127.0.0.1'de sunar (önce `npm run build`).
 * Ayrıntılı seçenekler: `npm run ui:audit -- --help`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runChromeCheck, runLeaflet } from "./checks.ts";
import {
  compareLeaflet,
  LeafletCompareError,
  summarize,
  type ExpectedChange,
} from "./leaflet-compare.ts";
import { collectMetrics } from "./metrics.ts";
import { allRoutes, discoverPages } from "./routes.ts";
import { PROD_API_ORIGIN, runScan } from "./scan.ts";
import { serveStatic } from "./static-server.ts";

const WEB_ROOT = resolve(import.meta.dirname, "../../apps/web");
const FIXTURES = resolve(import.meta.dirname, "fixtures");

const HELP = `MapsBridge UI denetimi

Kullanım:
  npm run ui:audit -- [seçenekler]

Modlar:
  --metrics                 Statik CSS/sayfa metriklerini JSON olarak yazdır (tarayıcı yok)
  (varsayılan)              Tüm rotaları ziyaret et: ekran görüntüsü + axe taraması
  --leaflet <dosya>         Leaflet anlık görüntüsü (/gezgin/ popup + /maps/ marker'ları, schema 2)
                            dosyaya yazılır. Adım zaman aşımı ya da marker/popup yoksa exit 1
  --unlayer                 Yalnızca --leaflet ile: yerel _next/static CSS'i @layer sarmaları
                            açılmış servis edilir (K1 kaskad eşdeğerliği)
  --leaflet-compare <a> <b> İki anlık görüntüyü karşılaştır; fail varsa exit 1
  --mode <cascade|commits>  --leaflet-compare modu: cascade = K1 (aynı build, layer'lı ↔
                            layer'sız), commits = K2/K3 (iki layer'lı anlık görüntü)
  --report <dosya>          --leaflet-compare JSON raporu
  --expected-changes <dosya> K2 beklenen değişiklikler (varsayılan
                            scripts/ui-audit/fixtures/leaflet-expected-changes.json)
  --compare <önce> <sonra>  İki ekran görüntüsü dizinini yan yana gösteren statik HTML raporu
                            (yalnızca <img>; varsayılan <sonra>/../compare.html, --out ile değişir)
  --chrome-check <dosya>    Chrome-check (AC-9, 16, 17, 18, 20, 31b, 32, 38) JSON raporu. AC-38
                            başarısızsa exit 1; --strict ile herhangi bir fail de exit 1
  --strict                  Yalnızca --chrome-check ile: her fail exit 1

Seçenekler:
  --out <dosya>             --metrics çıktısını (ya da --compare raporunu) dosyaya yaz
  --base-url <url>          Çalışan sunucu (ör. http://localhost:3000). Yoksa apps/web/out sunulur
  --out-dir <dizin>         Statik export dizini (varsayılan apps/web/out)
  --screenshots <dizin>     Ekran görüntüsü dizini (varsayılan .agents/ui-audit/latest/screenshots)
  --axe-out <dosya>         axe JSON özeti (varsayılan .agents/ui-audit/latest/axe.json)
  --widths <liste>          Ekran genişlikleri (varsayılan 375,1280)
  --axe-width <liste>       axe genişlikleri, virgüllü (varsayılan 1280; ilki birincil, diğerleri
                            axeExtra). --chrome-check'te AC-38 region taraması bu genişliklerde
  --routes <liste>          Yalnızca bu rotalar (virgülle; ör. /,/about/,/u/admin/)
  --admin-only              Yalnızca admin rotaları (/admin/, /u/admin/)
  --no-screenshots          Ekran görüntüsü alma
  --no-axe                  axe taraması yapma
  --admin-api <url>         Admin mock API tabanı. API isteklerini buraya yönlendirir ve
                            admin rotalarına sahte oturum enjekte eder
  --api-origin <url>        Yönlendirilecek ek API origin'i (tekrarlanabilir; varsayılan
                            ${PROD_API_ORIGIN})
  --session-token <jwt>     Enjekte edilecek token (varsayılan imzasız sahte JWT)
  --session-email <e-posta> Oturum e-postası (varsayılan admin@example.com)
  --session-all             Oturumu tüm rotalara enjekte et
  --allow-external          Üçüncü taraf/canlı API isteklerine izin ver (varsayılan: engelli)
  --concurrency <n>         Paralel sayfa sayısı (varsayılan 4)
  --settle <ms>             Yükleme sonrası bekleme (varsayılan 600)
  -h, --help                Bu yardım
`;

function list(value: string | undefined, fallback: string[]): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;
}

function normalizeRoute(r: string): string {
  const withLead = r.startsWith("/") ? r : `/${r}`;
  // Query'li rota (ör. /u/admin/?alan=finans): eğik çizgi path'e eklenir, query korunur.
  const q = withLead.indexOf("?");
  const pathPart = q < 0 ? withLead : withLead.slice(0, q);
  const query = q < 0 ? "" : withLead.slice(q);
  return (pathPart.endsWith("/") ? pathPart : `${pathPart}/`) + query;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      metrics: { type: "boolean", default: false },
      leaflet: { type: "string" },
      unlayer: { type: "boolean", default: false },
      "leaflet-compare": { type: "string" },
      mode: { type: "string" },
      report: { type: "string" },
      "expected-changes": { type: "string" },
      compare: { type: "string" },
      "chrome-check": { type: "string" },
      strict: { type: "boolean", default: false },
      out: { type: "string" },
      "base-url": { type: "string" },
      "out-dir": { type: "string" },
      screenshots: { type: "string" },
      "no-screenshots": { type: "boolean", default: false },
      "axe-out": { type: "string" },
      widths: { type: "string" },
      "axe-width": { type: "string" },
      routes: { type: "string" },
      "admin-only": { type: "boolean", default: false },
      "no-axe": { type: "boolean", default: false },
      "admin-api": { type: "string" },
      "api-origin": { type: "string", multiple: true },
      "session-token": { type: "string" },
      "session-email": { type: "string" },
      "session-all": { type: "boolean", default: false },
      "allow-external": { type: "boolean", default: false },
      concurrency: { type: "string" },
      settle: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  if (values.strict && !values["chrome-check"]) {
    console.error("--strict yalnızca --chrome-check ile birlikte kullanılabilir.");
    process.exit(1);
  }
  const axeWidths = list(values["axe-width"], ["1280"]).map(Number);
  if (axeWidths.some((w) => !Number.isFinite(w) || w <= 0)) {
    console.error(`Geçersiz --axe-width: ${values["axe-width"]}`);
    process.exit(1);
  }
  if (values.unlayer && !values.leaflet) {
    console.error("--unlayer yalnızca --leaflet ile birlikte kullanılabilir.");
    process.exit(1);
  }

  if (values["leaflet-compare"]) {
    if (positionals.length !== 1) {
      console.error(
        "Kullanım: --leaflet-compare <a.json> <b.json> --mode cascade|commits --report <rapor.json>",
      );
      process.exit(1);
    }
    runLeafletCompare(
      resolve(values["leaflet-compare"]),
      resolve(positionals[0]),
      values.mode,
      values.report ? resolve(values.report) : null,
      resolve(values["expected-changes"] ?? `${FIXTURES}/leaflet-expected-changes.json`),
    );
    return;
  }

  if (values.compare) {
    if (positionals.length !== 1) {
      console.error("Kullanım: --compare <önce-dizini> <sonra-dizini> [--out compare.html]");
      process.exit(1);
    }
    const before = resolve(values.compare);
    const after = resolve(positionals[0]);
    const out = resolve(values.out ?? `${dirname(after)}/compare.html`);
    writeCompareHtml(before, after, out);
    console.error(`[ui-audit] karşılaştırma raporu: ${out}`);
    return;
  }

  if (positionals.length) {
    console.error(`Beklenmeyen argüman: ${positionals.join(" ")} (bkz. --help)`);
    process.exit(1);
  }

  if (values.leaflet) {
    const outDir = resolve(values["out-dir"] ?? `${WEB_ROOT}/out`);
    const server = await serveStatic(outDir);
    const unlayerErrors: string[] = [];
    const sessionEmail = values["session-email"] ?? "admin@example.com";
    console.error(
      `[ui-audit] Leaflet anlık görüntüsü · ${server.url} · ${outDir}${values.unlayer ? " · katmansız" : ""}`,
    );
    try {
      const snapshot = await runLeaflet({
        outDir,
        seedFile: `${FIXTURES}/workspace.json`,
        scan: {
          baseUrl: server.url,
          routes: [],
          widths: [1280],
          axeWidth: 1280,
          screenshotsDir: null,
          runAxe: false,
          concurrency: 1,
          settleMs: 0,
          allowExternal: values["allow-external"] === true,
          adminApi: null,
          apiOrigins: [PROD_API_ORIGIN, ...(values["api-origin"] ?? [])],
          sessionToken: values["session-token"] ?? null,
          sessionEmail,
          sessionAll: values["session-all"] === true,
          unlayer: values.unlayer === true,
          unlayerErrors,
        },
      });
      if (unlayerErrors.length) {
        for (const u of unlayerErrors) console.error(`Katmansız CSS servis edilemedi: ${u}`);
        process.exit(1);
      }
      writeJson(resolve(values.leaflet), snapshot);
      const counts = Object.entries(snapshot.scenarios)
        .map(([k, v]) => `${k} ${v.length} öğe`)
        .join(", ");
      console.error(
        `[ui-audit] Leaflet anlık görüntüsü yazıldı: ${values.leaflet} (buildId ${snapshot.build.buildId ?? "yok"}; ${counts})`,
      );
    } catch (err) {
      console.error(
        `[ui-audit] Leaflet anlık görüntüsü geçersiz: ${err instanceof Error ? err.message : err}`,
      );
      process.exit(1);
    } finally {
      await server.close();
    }
    return;
  }

  if (values["chrome-check"]) {
    await chromeCheck(values, axeWidths);
    return;
  }
  if (values.metrics) {
    const metrics = collectMetrics(WEB_ROOT);
    if (values.out) writeJson(resolve(values.out), metrics);
    process.stdout.write(JSON.stringify(metrics, null, 2) + "\n");
    return;
  }

  let routes = allRoutes(discoverPages(WEB_ROOT));
  if (values.routes) {
    const wanted = new Set(list(values.routes, []).map(normalizeRoute));
    routes = routes.filter((r) => wanted.has(r));
    for (const w of wanted) if (!routes.includes(w)) routes.push(w);
  }
  if (values["admin-only"])
    routes = routes.filter((r) => r === "/admin/" || r.startsWith("/u/admin/"));

  const screenshotsDir = values["no-screenshots"]
    ? null
    : resolve(values.screenshots ?? ".agents/ui-audit/latest/screenshots");
  const runAxe = !values["no-axe"];
  const axeOut = resolve(values["axe-out"] ?? ".agents/ui-audit/latest/axe.json");

  let server: { url: string; close: () => Promise<void> } | null = null;
  const baseUrl =
    values["base-url"] ??
    (server = await serveStatic(resolve(values["out-dir"] ?? `${WEB_ROOT}/out`))).url;
  console.error(
    `[ui-audit] ${routes.length} rota · ${baseUrl}${values["admin-api"] ? ` · admin mock API ${values["admin-api"]}` : ""}`,
  );

  try {
    const summary = await runScan({
      baseUrl,
      routes,
      widths: list(values.widths, ["375", "1280"]).map(Number),
      axeWidth: axeWidths[0],
      extraAxeWidths: axeWidths.slice(1),
      screenshotsDir,
      runAxe: runAxe,
      concurrency: Number(values.concurrency ?? 4),
      settleMs: Number(values.settle ?? 600),
      allowExternal: values["allow-external"] === true,
      adminApi: values["admin-api"] ?? null,
      apiOrigins: [PROD_API_ORIGIN, ...(values["api-origin"] ?? [])],
      sessionToken: values["session-token"] ?? null,
      sessionEmail: values["session-email"] ?? "admin@example.com",
      sessionAll: values["session-all"] === true,
    });
    if (runAxe) writeJson(axeOut, summary);
    const t = summary.totals;
    console.error(
      `[ui-audit] bitti · ihlal kuralı: critical ${t.violationsByImpact.critical}, serious ${t.violationsByImpact.serious}, ` +
        `moderate ${t.violationsByImpact.moderate}, minor ${t.violationsByImpact.minor} · hata veren sayfa ${t.pagesWithErrors}` +
        (runAxe ? ` · ${axeOut}` : ""),
    );
  } finally {
    await server?.close();
  }
}

/** Chrome-check rotaları: keşfedilen sayfalar − LEGACY (apps/web/app/lib/route-registry.ts LEGACY_REDIRECTS ile aynı liste). */
const LEGACY_PATHS = new Set([
  "/ai/",
  "/ai-asistan/",
  "/gezi-asistani/",
  "/desk/",
  "/harita/",
  "/haritalar/",
  "/mobil-uygulamalar/",
  "/forgot-password/",
  "/sifre-sifirla/",
  "/u/",
  "/admin/",
]);
async function chromeCheck(
  values: Record<string, string | boolean | string[] | undefined>,
  axeWidths: number[],
): Promise<void> {
  const outDir = resolve(String(values["out-dir"] ?? `${WEB_ROOT}/out`));
  let routes = allRoutes(discoverPages(WEB_ROOT)).filter((r) => !LEGACY_PATHS.has(r));
  if (typeof values.routes === "string") {
    const wanted = new Set(list(values.routes, []).map(normalizeRoute));
    routes = routes.filter((r) => wanted.has(r));
    for (const w of wanted) if (!routes.includes(w)) routes.push(w);
  }
  const server = values["base-url"] ? null : await serveStatic(outDir);
  const baseUrl = String(values["base-url"] ?? server?.url);
  const sessionAll = values["session-all"] === true;
  console.error(
    `[chrome-check] ${routes.length} rota · ${baseUrl}${sessionAll ? " · oturumlu (--session-all)" : " · kimliksiz"}`,
  );
  try {
    const report = await runChromeCheck({
      outDir,
      routes,
      chromeWidths: [375, 1280],
      reflowWidths: [640, 320, 768, 820, 900, 1024, 1100],
      axeWidths,
      systemStatusFixture: `${FIXTURES}/system-status.json`,
      scan: {
        baseUrl,
        routes,
        widths: [1280],
        axeWidth: axeWidths[0],
        screenshotsDir: null,
        runAxe: false,
        concurrency: Number(values.concurrency ?? 4),
        settleMs: Number(values.settle ?? 600),
        allowExternal: values["allow-external"] === true,
        adminApi: typeof values["admin-api"] === "string" ? values["admin-api"] : null,
        apiOrigins: [
          PROD_API_ORIGIN,
          ...(Array.isArray(values["api-origin"]) ? values["api-origin"] : []),
        ],
        sessionToken: typeof values["session-token"] === "string" ? values["session-token"] : null,
        sessionEmail:
          typeof values["session-email"] === "string"
            ? values["session-email"]
            : "admin@example.com",
        sessionAll,
      },
    });
    writeJson(resolve(String(values["chrome-check"])), report);
    const parts = Object.entries(report.summary).map(
      ([ac, s]) => `${ac} ${s.pass}✓/${s.fail}✗/${s["n/a"]}–`,
    );
    console.error(`[chrome-check] özet: ${parts.join(" · ")}`);
    for (const r of report.ac38)
      for (const s of r.steps)
        console.error(
          `[chrome-check] AC-38 ${r.route} ${s.name}: ${s.status} (${s.details.join("; ")})`,
        );
    console.error(
      `[chrome-check] AC-38 / → /en/ lang: ${report.ac38Lang.status} (${report.ac38Lang.details.join("; ")})`,
    );
    console.error(`[chrome-check] rapor: ${values["chrome-check"]}`);
    if (report.ac38Failed || (values.strict === true && report.failed)) process.exit(1);
  } finally {
    await server?.close();
  }
}
function runLeafletCompare(
  aPath: string,
  bPath: string,
  mode: string | undefined,
  reportPath: string | null,
  expectedPath: string,
): void {
  if (mode !== "cascade" && mode !== "commits") {
    console.error("--mode cascade ya da commits olmalı.");
    process.exit(1);
  }
  const a = JSON.parse(readFileSync(aPath, "utf8"));
  const b = JSON.parse(readFileSync(bPath, "utf8"));
  const expectedChanges = existsSync(expectedPath)
    ? (JSON.parse(readFileSync(expectedPath, "utf8")) as ExpectedChange[])
    : [];
  let result: ReturnType<typeof compareLeaflet>;
  try {
    result = compareLeaflet(a, b, { mode, expectedChanges });
  } catch (err) {
    if (err instanceof LeafletCompareError) {
      console.error(`[leaflet-compare] HATA: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  const summary = summarize(result.rows);
  const label = mode === "cascade" ? "K1 (kaskad)" : "K2/K3 (commit'ler)";
  const line =
    `${label}: eşit ${summary.equal} · expected-fold ${summary["expected-fold"]} · ` +
    `expected-change ${summary["expected-change"]} · info ${summary.info} · fail ${summary.fail}`;
  if (reportPath)
    writeJson(reportPath, {
      mode,
      a: aPath,
      b: bPath,
      summary,
      failed: result.failed,
      rows: result.rows,
    });
  for (const r of result.rows.filter((x) => x.verdict === "fail").slice(0, 40))
    console.log(
      `  FAIL ${r.key} ${r.property}: ${r.before} → ${r.after}${r.note ? ` (${r.note})` : ""}`,
    );
  console.log(`[leaflet-compare] ${line}${result.failed ? " → BAŞARISIZ" : ""}`);
  if (result.failed) process.exit(1);
}

/** §16: iki ekran görüntüsü dizinini slug bazında yan yana gösteren statik HTML (yalnızca <img>). */
function writeCompareHtml(before: string, after: string, out: string): void {
  const pngs = (dir: string) =>
    existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".png")) : [];
  const names = [...new Set([...pngs(before), ...pngs(after)])].sort();
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const cell = (dir: string, name: string, label: string) =>
    existsSync(`${dir}/${name}`)
      ? `<td><img src="${esc(relative(dirname(out), `${dir}/${name}`))}" alt="${esc(`${label}: ${name}`)}" width="600" loading="lazy"></td>`
      : `<td>Görüntü yok</td>`;
  const rows = names
    .map(
      (n) =>
        `<tr><th scope="row">${esc(n)}</th>${cell(before, n, "Önce")}${cell(after, n, "Sonra")}</tr>`,
    )
    .join("\n");
  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Ekran görüntüsü karşılaştırması</title>
</head>
<body>
<h1>Ekran görüntüsü karşılaştırması</h1>
<p>Önce: ${esc(basename(before))} · Sonra: ${esc(basename(after))} · ${names.length} görüntü</p>
<table>
<thead><tr><th scope="col">Görüntü</th><th scope="col">Önce</th><th scope="col">Sonra</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
