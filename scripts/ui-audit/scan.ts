/**
 * Tarayıcı taraması: her rota için verilen genişliklerde tam sayfa ekran görüntüsü,
 * tek genişlikte axe taraması ve çalışma anı header/footer tespiti.
 */
import { fileURLToPath } from "node:url";
import { decide } from "./route-policy.ts";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { isAdminRoute, routeSlug } from "./routes.ts";

const LEAFLET_DIST = fileURLToPath(new URL("../../node_modules/leaflet/dist/", import.meta.url));

export const PROD_API_ORIGIN = "https://0duy2hfjd2.execute-api.eu-central-1.amazonaws.com";
const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
type Impact = (typeof IMPACTS)[number];
type ImpactCounts = Record<Impact, number>;

export interface ScanOptions {
  baseUrl: string;
  routes: string[];
  widths: number[];
  axeWidth: number;
  screenshotsDir: string | null;
  runAxe: boolean;
  concurrency: number;
  settleMs: number;
  allowExternal: boolean;
  /** Admin mock API tabanı: API origin'lerine giden istekler buraya yönlendirilir. */
  adminApi: string | null;
  apiOrigins: string[];
  sessionToken: string | null;
  sessionEmail: string;
  sessionAll: boolean;
}

interface RuntimeChrome {
  sharedHeader: number;
  sharedFooter: number;
  otherBanners: string[];
  otherContentinfo: string[];
}

interface ViolationSummary {
  id: string;
  impact: Impact | "unknown";
  help: string;
  helpUrl: string;
  nodes: number;
  targets: string[];
}

export interface PageResult {
  route: string;
  url: string;
  finalUrl: string | null;
  httpStatus: number | null;
  title: string | null;
  authenticated: boolean;
  screenshots: string[];
  chrome: RuntimeChrome | null;
  consoleErrors: number;
  pageErrors: number;
  error: string | null;
  axe: {
    width: number;
    violationsByImpact: ImpactCounts;
    nodesByImpact: ImpactCounts;
    violations: ViolationSummary[];
    passes: number;
    incomplete: number;
  } | null;
}

const zero = (): ImpactCounts => ({ critical: 0, serious: 0, moderate: 0, minor: 0 });

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/** İmzasız sahte JWT — yalnızca istemci tarafı oturum kontrolünü geçmek için (mock API ile). */
export function fakeJwt(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: "none", typ: "JWT" }),
    b64url({
      sub: "ui-audit-admin",
      email,
      email_verified: true,
      "cognito:groups": ["admin"],
      iat: now,
      exp: now + 86400,
    }),
    "ui-audit",
  ].join(".");
}

async function prepareContext(
  ctx: BrowserContext,
  opts: ScanOptions,
  withSession: boolean,
): Promise<void> {
  const base = new URL(opts.baseUrl);
  const apiMatch = (url: string) => opts.apiOrigins.some((o) => url.startsWith(o));

  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (opts.adminApi && apiMatch(url)) {
      const origin = opts.apiOrigins.find((o) => url.startsWith(o)) as string;
      const cors = {
        "access-control-allow-origin": base.origin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": req.headers()["access-control-request-headers"] ?? "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      };
      if (req.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      try {
        const target = opts.adminApi.replace(/\/$/, "") + url.slice(origin.length);
        const response = await route.fetch({ url: target });
        await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
      } catch {
        await route.abort("connectionrefused");
      }
      return;
    }
    const decision = decide(url, {
      baseOrigin: base.origin,
      allowExternal: Boolean(opts.allowExternal),
      leafletDist: LEAFLET_DIST,
    });
    if (decision.action === "continue") await route.continue();
    else if (decision.action === "fulfill-file") await route.fulfill({ path: decision.path });
    else await route.abort("blockedbyclient");
  });

  if (!opts.allowExternal) {
    // Canlı WebSocket'e bağlanma; bağlantıyı yerelde kapat.
    await ctx.routeWebSocket(/.*/, (ws) => ws.close());
  }

  if (withSession) {
    const token = opts.sessionToken ?? fakeJwt(opts.sessionEmail);
    await ctx.addInitScript(
      ({ token, email }) => {
        try {
          localStorage.setItem("mapsbridge.accessToken", token);
          localStorage.setItem("mapsbridge.idToken", token);
          localStorage.setItem("mapsbridge.userEmail", email);
          localStorage.setItem("mapsbridge.loginTime", String(Date.now()));
        } catch {
          /* storage erişilemezse oturumsuz devam */
        }
      },
      { token, email: opts.sessionEmail },
    );
    await ctx.addCookies([{ name: "mb_session", value: "1", url: base.origin }]);
  }
}

async function settle(page: Page, settleMs: number): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => undefined);
  await page.waitForTimeout(settleMs);
}

async function runtimeChrome(page: Page): Promise<RuntimeChrome> {
  return page.evaluate(() => {
    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      [...el.classList]
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
    // Sectioning içeriği altındaki <header>/<footer> landmark değildir.
    const isLandmark = (el: Element) =>
      !el.parentElement?.closest("article, aside, main, nav, section");
    const others = (sel: string, role: string, shared: string) =>
      [...document.querySelectorAll(`${sel}, [role="${role}"]`)]
        .filter((el) => !el.closest(shared))
        .filter((el) => el.getAttribute("role") === role || isLandmark(el))
        .map(describe);
    return {
      sharedHeader: document.querySelectorAll("header.global-site-header").length,
      sharedFooter: document.querySelectorAll("footer.global-site-footer").length,
      otherBanners: others("header", "banner", ".global-site-header"),
      otherContentinfo: others("footer", "contentinfo", ".global-site-footer"),
    };
  });
}

async function scanRoute(
  ctx: BrowserContext,
  route: string,
  opts: ScanOptions,
  authenticated: boolean,
): Promise<PageResult> {
  const url = opts.baseUrl.replace(/\/$/, "") + route;
  const result: PageResult = {
    route,
    url,
    finalUrl: null,
    httpStatus: null,
    title: null,
    authenticated,
    screenshots: [],
    chrome: null,
    consoleErrors: 0,
    pageErrors: 0,
    error: null,
    axe: null,
  };
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") result.consoleErrors++;
  });
  page.on("pageerror", () => result.pageErrors++);

  // axe genişliği en son taranır ki sonuç sayfası o genişlikte kalsın.
  const widths = [...new Set([...opts.widths, ...(opts.runAxe ? [opts.axeWidth] : [])])].sort(
    (a, b) => Number(a === opts.axeWidth) - Number(b === opts.axeWidth),
  );
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await settle(page, opts.settleMs);
      // Meta veriler ve çalışma anı header/footer tespiti son (axe) genişlikte alınır.
      if (width === widths[widths.length - 1]) {
        result.httpStatus = response?.status() ?? null;
        result.finalUrl = page.url();
        result.title = await page.title();
        result.chrome = await runtimeChrome(page);
      }
      if (opts.screenshotsDir && opts.widths.includes(width)) {
        const file = join(opts.screenshotsDir, `${routeSlug(route)}@${width}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
        result.screenshots.push(file);
      }
      if (opts.runAxe && width === opts.axeWidth) {
        const axe = await new AxeBuilder({ page }).analyze();
        const violationsByImpact = zero();
        const nodesByImpact = zero();
        const violations: ViolationSummary[] = axe.violations.map((v) => {
          const impact = (v.impact ?? "unknown") as Impact | "unknown";
          if (impact !== "unknown") {
            violationsByImpact[impact]++;
            nodesByImpact[impact] += v.nodes.length;
          }
          return {
            id: v.id,
            impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.length,
            targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
          };
        });
        result.axe = {
          width,
          violationsByImpact,
          nodesByImpact,
          violations,
          passes: axe.passes.length,
          incomplete: axe.incomplete.length,
        };
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
  } finally {
    await page.close();
  }
  return result;
}

export async function runScan(opts: ScanOptions) {
  if (opts.screenshotsDir) mkdirSync(opts.screenshotsDir, { recursive: true });
  const browser = await chromium.launch();
  const contextOptions = {
    reducedMotion: "reduce" as const,
    locale: "tr-TR",
    deviceScaleFactor: 1,
  };
  const publicCtx = await browser.newContext(contextOptions);
  await prepareContext(publicCtx, opts, opts.sessionAll);
  const sessionCtx =
    opts.adminApi || opts.sessionToken || opts.sessionAll
      ? await browser.newContext(contextOptions)
      : null;
  if (sessionCtx) await prepareContext(sessionCtx, opts, true);

  const results: PageResult[] = new Array(opts.routes.length);
  let next = 0;
  const worker = async () => {
    while (next < opts.routes.length) {
      const i = next++;
      const route = opts.routes[i];
      const useSession = !!sessionCtx && (opts.sessionAll || isAdminRoute(route));
      results[i] = await scanRoute(
        useSession ? (sessionCtx as BrowserContext) : publicCtx,
        route,
        opts,
        useSession,
      );
      const r = results[i];
      const v = r.axe
        ? IMPACTS.map((k) => `${k[0]}${r.axe?.violationsByImpact[k]}`).join(" ")
        : "-";
      console.error(
        `[ui-audit] ${String(i + 1).padStart(3)}/${opts.routes.length} ${route} → ${r.error ? `HATA: ${r.error}` : `${r.httpStatus} axe ${v}`}`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  await browser.close();

  const totals = {
    violationsByImpact: zero(),
    nodesByImpact: zero(),
    pagesWithViolations: 0,
    pagesWithErrors: 0,
  };
  const rules = new Map<
    string,
    { id: string; impact: string; help: string; helpUrl: string; pages: number; nodes: number }
  >();
  for (const r of results) {
    if (r.error) totals.pagesWithErrors++;
    if (!r.axe) continue;
    if (r.axe.violations.length) totals.pagesWithViolations++;
    for (const k of IMPACTS) {
      totals.violationsByImpact[k] += r.axe.violationsByImpact[k];
      totals.nodesByImpact[k] += r.axe.nodesByImpact[k];
    }
    for (const v of r.axe.violations) {
      const agg = rules.get(v.id) ?? {
        id: v.id,
        impact: v.impact,
        help: v.help,
        helpUrl: v.helpUrl,
        pages: 0,
        nodes: 0,
      };
      agg.pages++;
      agg.nodes += v.nodes;
      rules.set(v.id, agg);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: opts.baseUrl,
    widths: opts.widths,
    axeWidth: opts.axeWidth,
    adminApi: opts.adminApi,
    externalRequests: opts.allowExternal ? "allowed" : "blocked",
    pageCount: results.length,
    totals: {
      ...totals,
      violations: IMPACTS.reduce((s, k) => s + totals.violationsByImpact[k], 0),
      nodes: IMPACTS.reduce((s, k) => s + totals.nodesByImpact[k], 0),
    },
    rules: [...rules.values()].sort((a, b) => b.pages - a.pages || b.nodes - a.nodes),
    pages: results,
  };
}
