/**
 * MapsBridge UI denetim aracı.
 *
 *   npm run ui:audit -- --metrics [--out metrics.json]
 *   npm run ui:audit -- --screenshots <dir> --axe-out <file.json> [--base-url http://localhost:3000]
 *
 * Varsayılan olarak apps/web/out statik export'unu 127.0.0.1'de sunar (önce `npm run build`).
 * Ayrıntılı seçenekler: `npm run ui:audit -- --help`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { collectMetrics } from "./metrics.ts";
import { allRoutes, discoverPages } from "./routes.ts";
import { PROD_API_ORIGIN, runScan } from "./scan.ts";
import { serveStatic } from "./static-server.ts";

const WEB_ROOT = resolve(import.meta.dirname, "../../apps/web");

const HELP = `MapsBridge UI denetimi

Kullanım:
  npm run ui:audit -- [seçenekler]

Modlar:
  --metrics                 Statik CSS/sayfa metriklerini JSON olarak yazdır (tarayıcı yok)
  (varsayılan)              Tüm rotaları ziyaret et: ekran görüntüsü + axe taraması

Seçenekler:
  --out <dosya>             --metrics çıktısını dosyaya da yaz
  --base-url <url>          Çalışan sunucu (ör. http://localhost:3000). Yoksa apps/web/out sunulur
  --out-dir <dizin>         Statik export dizini (varsayılan apps/web/out)
  --screenshots <dizin>     Ekran görüntüsü dizini (varsayılan .agents/ui-audit/latest/screenshots)
  --axe-out <dosya>         axe JSON özeti (varsayılan .agents/ui-audit/latest/axe.json)
  --widths <liste>          Ekran genişlikleri (varsayılan 375,1280)
  --axe-width <px>          axe taramasının yapılacağı genişlik (varsayılan 1280)
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
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      metrics: { type: "boolean", default: false },
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
      axeWidth: Number(values["axe-width"] ?? 1280),
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

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
