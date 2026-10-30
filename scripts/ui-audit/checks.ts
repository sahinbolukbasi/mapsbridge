/**
 * Chrome-check senaryoları: Leaflet anlık görüntüsü (C2.1; AC-31c, design §2.6 "Kapsam", "Ölçüm
 * öncesi kararlılık", "Anlık görüntü biçimi"; §17.-3 #1) ve chrome-check (C6; AC-9, 16, 17, 18,
 * 20, 31b, 32, 38 — dosyanın sonunda `runChromeCheck`).
 *
 * KURAL (§17.-3 #1c): senaryonun DOM kancasını (.pub-route-footer, .pub-route-cta-btn.secondary,
 * .stitch-pin-active-popup, divIcon className'leri) değiştiren commit, aşağıdaki LEAFLET_SCENARIOS
 * sabitini ve requirements AC-31c'yi aynı commit'te günceller. Seçiciler YALNIZCA burada yaşar.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { prepareContext, type ScanOptions } from "./scan.ts";

/** Ölçülecek hedef: kök + `depth` seviye alt öğe (`"all"` = tüm alt ağaç). */
export interface LeafletTarget {
  name: string;
  selector: string;
  depth: number | "all";
  /** false: bugün render edilmeyebilir; yoksa kayıt üretmez (anahtar kümesi iki tarafta da aynı kalır). */
  required: boolean;
}

export const STEP_TIMEOUT_MS = 10_000;

/** Tüm Leaflet senaryo seçicilerinin TEK kaynağı (§17.-3 #1b). */
export const LEAFLET_SCENARIOS = {
  "/gezgin/": {
    route: "/gezgin/",
    seed: false,
    steps: {
      // (1) fiyatı ₺ ile başlamayan ilk ücretsiz rotanın önizleme butonu (rota kartı kapsamı)
      openPreview: ".pub-route-footer .pub-route-cta-btn.secondary",
      // (2) §17.-3 #1a: .pub-modal-window KULLANILMAZ
      marker: ".leaflet-marker-icon.custom-map-pin",
      // (4) bindPopup ile açılan tek gerçek Leaflet popup'ı
      popup: ".leaflet-popup",
    },
    targets: [
      {
        name: "leaflet-marker-icon",
        selector: ".leaflet-marker-icon.custom-map-pin",
        depth: 2,
        required: true,
      },
      {
        name: "leaflet-popup-content-wrapper",
        selector: ".leaflet-popup-content-wrapper",
        depth: 0,
        required: true,
      },
      { name: "leaflet-popup-tip", selector: ".leaflet-popup-tip", depth: 0, required: true },
      {
        name: "leaflet-popup-content",
        selector: ".leaflet-popup-content",
        depth: "all",
        required: true,
      },
    ] satisfies LeafletTarget[],
  },
  "/maps/": {
    route: "/maps/",
    seed: true,
    steps: {
      anyMarker: ".leaflet-marker-icon",
      // iconSize [0,0] olduğu için marker kökü değil, görünür başı tıklanır (olay köke kabarcıklanır).
      clickMarker: ".leaflet-marker-icon.stitch-leaflet-marker-wrap .stitch-pin-head",
      activePopup: ".stitch-pin-active-popup",
    },
    markerTargets: [
      // desk/page.tsx renderGroupOnMap planlayıcı açıkken erken döner ve isPlannerOpen bugün
      // hiç false olmaz; bu yüzden rota durağı pin'i bugün /maps/'te render edilmez.
      {
        name: "custom-route-pin",
        selector: ".leaflet-marker-icon.custom-route-pin",
        depth: 2,
        required: false,
      },
      {
        name: "stitch-leaflet-marker-wrap",
        selector: ".leaflet-marker-icon.stitch-leaflet-marker-wrap",
        depth: 2,
        required: true,
      },
      {
        name: "custom-map-pin",
        selector: ".leaflet-marker-icon.custom-map-pin",
        depth: 2,
        required: true,
      },
    ] satisfies LeafletTarget[],
    popupTargets: [
      {
        name: "stitch-pin-active-popup",
        selector: ".stitch-pin-active-popup",
        depth: "all",
        required: true,
      },
    ] satisfies LeafletTarget[],
  },
} as const;

export const GEOMETRY_PROPS = [
  "position",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  ...["top", "right", "bottom", "left"].flatMap((s) => [`border-${s}-width`, `border-${s}-style`]),
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "font-size",
  "opacity",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
];
export const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
];
export const INFO_PROPS = ["box-shadow"];

export interface LeafletItem {
  key: string;
  classes: string;
  geometry: Record<string, string>;
  color: Record<string, string>;
  info: Record<string, string>;
}

export interface LeafletSnapshot {
  schema: 2;
  build: { outDir: string; buildId: string | null; unlayered: boolean };
  scenarios: Record<string, LeafletItem[]>;
}

export interface LeafletOptions {
  scan: ScanOptions;
  outDir: string;
  seedFile: string;
}

/** `<outDir>/_next/static/` altındaki tek build dizini (chunks, media hariç); yoksa null. */
export function readBuildId(outDir: string): string | null {
  const dir = join(outDir, "_next/static");
  if (!existsSync(dir)) return null;
  const ids = readdirSync(dir).filter(
    (n) => n !== "chunks" && n !== "media" && statSync(join(dir, n)).isDirectory(),
  );
  return ids.length === 1 ? ids[0] : null;
}

class InvalidSnapshot extends Error {}

async function step<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    throw new InvalidSnapshot(`Leaflet senaryo adımı başarısız: ${label} (${reason})`);
  }
}

/** Ölçüm öncesi kararlılık (design §2.6, Rev 6); kaskada dokunmaz. */
async function stabilize(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".leaflet-container")].every(
        (el) => !el.classList.contains("leaflet-zoom-anim"),
      ),
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    const frame = () => new Promise((ok) => requestAnimationFrame(() => ok(undefined)));
    // Bir geçişi bitirmek alt öğelerde yeni geçiş başlatabilir (ör. leaflet.css geç yüklenince
    // .leaflet-container font-size geçişi, em tabanlı popup içeriğini de değiştirir). Bu yüzden
    // CSSTransition'lar kalmayana kadar (en çok 20 tur) bitirilir.
    for (let round = 0; round < 20; round++) {
      const running = document.getAnimations().filter((a) => a instanceof CSSTransition);
      if (running.length === 0) break;
      for (const t of running) t.finish();
      await frame();
    }
    for (const anim of document.getAnimations()) {
      if (anim instanceof CSSTransition) anim.finish();
      else {
        anim.pause();
        anim.currentTime = 0;
      }
    }
    await frame();
    await frame();
  });
}

async function measure(page: Page, scenario: string, targets: LeafletTarget[]) {
  const items: LeafletItem[] = await page.evaluate(
    ({ scenario, targets, props }) => {
      const out: LeafletItem[] = [];
      const pick = (cs: CSSStyleDeclaration, names: string[]) =>
        Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n)]));
      for (const t of targets) {
        const root = document.querySelector(t.selector);
        if (!root) continue;
        const visit = (el: Element, path: string, level: number) => {
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          out.push({
            key: `${scenario}|${t.name}#0|${path}`,
            classes: el.getAttribute("class") ?? "",
            geometry: {
              ...pick(cs, props.geometry),
              width: rect.width.toFixed(2),
              height: rect.height.toFixed(2),
            },
            color: pick(cs, props.color),
            info: pick(cs, props.info),
          });
          if (t.depth === "all" || level < t.depth)
            [...el.children].forEach((c, i) => visit(c, `${path}.${i}`, level + 1));
        };
        visit(root, "0", 0);
      }
      return out;
    },
    {
      scenario,
      targets,
      props: { geometry: GEOMETRY_PROPS, color: COLOR_PROPS, info: INFO_PROPS },
    },
  );
  for (const t of targets) {
    if (t.required && !items.some((i) => i.key.startsWith(`${scenario}|${t.name}#0|`)))
      throw new InvalidSnapshot(`Leaflet hedefi bulunamadı: ${scenario} ${t.selector}`);
    if (!t.required && !items.some((i) => i.key.startsWith(`${scenario}|${t.name}#0|`)))
      console.error(
        `[ui-audit] not: ${scenario} ${t.selector} bu build'de render edilmedi (isteğe bağlı)`,
      );
  }
  return items;
}

type Seed = { scoped?: Record<string, unknown>; plain?: Record<string, unknown> };

async function runGezgin(page: Page, base: string): Promise<LeafletItem[]> {
  const s = LEAFLET_SCENARIOS["/gezgin/"];
  await step(`${s.route} açılışı`, () =>
    page.goto(base + s.route, { waitUntil: "load", timeout: 30_000 }),
  );
  await step(`(1) ${s.steps.openPreview}`, () =>
    page.locator(s.steps.openPreview).first().click({ timeout: STEP_TIMEOUT_MS }),
  );
  await step(`(2) ${s.steps.marker}`, () =>
    page.locator(s.steps.marker).first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
  );
  await step(`(3) ilk marker tıklaması`, () =>
    page.locator(s.steps.marker).first().click({ timeout: STEP_TIMEOUT_MS }),
  );
  await step(`(4) ${s.steps.popup}`, () =>
    page.locator(s.steps.popup).first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
  );
  await step("ölçüm öncesi kararlılık", () => stabilize(page));
  const items = await measure(page, s.route, [...s.targets]);
  if (!items.some((i) => i.key.startsWith(`${s.route}|leaflet-popup-content-wrapper#0|`)))
    throw new InvalidSnapshot(`${s.route}: en az 1 .leaflet-popup gerekli`);
  return items;
}

async function runMaps(page: Page, base: string): Promise<LeafletItem[]> {
  const s = LEAFLET_SCENARIOS["/maps/"];
  await step(`${s.route} açılışı`, () =>
    page.goto(base + s.route, { waitUntil: "load", timeout: 30_000 }),
  );
  await step(`${s.steps.anyMarker} (en az 1 marker)`, () =>
    page
      .locator(s.steps.anyMarker)
      .first()
      .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
  );
  await step(`${s.markerTargets[1].selector}`, () =>
    page
      .locator(s.markerTargets[1].selector)
      .first()
      .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS }),
  );
  await step("ölçüm öncesi kararlılık", () => stabilize(page));
  const markers = await measure(page, s.route, [...s.markerTargets]);
  await step(`marker tıklaması ${s.steps.clickMarker}`, () =>
    page.locator(s.steps.clickMarker).first().click({ timeout: STEP_TIMEOUT_MS }),
  );
  await step(`${s.steps.activePopup}`, () =>
    page
      .locator(s.steps.activePopup)
      .first()
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
  );
  await step("ölçüm öncesi kararlılık", () => stabilize(page));
  const popup = await measure(page, s.route, [...s.popupTargets]);
  return [...markers, ...popup];
}

/** Leaflet anlık görüntüsü; geçersizse (adım zaman aşımı, marker/popup yok) throw eder. */
export async function runLeaflet(opts: LeafletOptions): Promise<LeafletSnapshot> {
  const seed = JSON.parse(readFileSync(opts.seedFile, "utf8")) as Seed;
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      locale: "tr-TR",
      deviceScaleFactor: 1,
      viewport: { width: 1280, height: 900 },
    });
    await prepareContext(ctx, opts.scan, opts.scan.sessionAll);
    const base = opts.scan.baseUrl.replace(/\/$/, "");

    const gezginPage = await ctx.newPage();
    const gezgin = await runGezgin(gezginPage, base);
    await gezginPage.close();

    // /maps/ seed'i: scoped anahtarlar lib/user-storage.ts biçimine çevrilir, plain birebir.
    const owner = encodeURIComponent(opts.scan.sessionEmail.trim().toLowerCase());
    const entries: Array<[string, string]> = [
      ...Object.entries(seed.scoped ?? {}).map(
        ([k, v]) => [`mapsbridge.account.${owner}.${k}`, JSON.stringify(v)] as [string, string],
      ),
      ...Object.entries(seed.plain ?? {}).map(
        ([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string],
      ),
    ];
    const mapsCtx = await browser.newContext({
      reducedMotion: "reduce",
      locale: "tr-TR",
      deviceScaleFactor: 1,
      viewport: { width: 1280, height: 900 },
    });
    await prepareContext(mapsCtx, opts.scan, opts.scan.sessionAll);
    if (LEAFLET_SCENARIOS["/maps/"].seed)
      await mapsCtx.addInitScript((pairs) => {
        try {
          for (const [k, v] of pairs) localStorage.setItem(k, v);
        } catch {
          /* depolama yoksa seed'siz devam; geçerlilik kontrolü yakalar */
        }
      }, entries);
    const mapsPage = await mapsCtx.newPage();
    const maps = await runMaps(mapsPage, base);
    await mapsCtx.close();
    await ctx.close();

    return {
      schema: 2,
      build: {
        outDir: opts.outDir,
        buildId: readBuildId(opts.outDir),
        unlayered: Boolean(opts.scan.unlayer),
      },
      scenarios: { "/maps/": maps, "/gezgin/": gezgin },
    };
  } finally {
    await browser.close();
  }
}

// =============================================================================================
// Chrome-check (C6; design §4.1, §4.5, §6, §16; AC-9, 16, 17, 18, 20, 31b, 32, 38)
// =============================================================================================

export type CheckStatus = "pass" | "fail" | "n/a";
export interface CheckResult {
  status: CheckStatus;
  details: string[];
}
export const CHROME_ACS = ["AC-9", "AC-16", "AC-17", "AC-18", "AC-20", "AC-31b", "AC-32"] as const;
export type ChromeAc = (typeof CHROME_ACS)[number];
export interface ChromeRouteResult {
  route: string;
  error: string | null;
  headerHeight: Record<string, number | null>;
  checks: Record<ChromeAc, CheckResult>;
}
export interface Ac38Result {
  route: string;
  steps: { name: string; status: CheckStatus; details: string[] }[];
}
export interface ChromeReport {
  schema: 1;
  generatedAt: string;
  build: { outDir: string; buildId: string | null };
  session: boolean;
  widths: { chrome: number[]; reflow: number[]; axe: number[] };
  routes: ChromeRouteResult[];
  ac38: Ac38Result[];
  ac38Lang: { status: CheckStatus; details: string[] };
  summary: Record<string, { pass: number; fail: number; "n/a": number }>;
  /** AC-38 (üç durum + lang) başarısızsa true (design §4.1: araç exit 1). */
  ac38Failed: boolean;
  /** Herhangi bir kontrol fail ise true (`--strict` ile exit 1). */
  failed: boolean;
}
export interface ChromeCheckOptions {
  scan: ScanOptions;
  outDir: string;
  routes: string[];
  /** AC-9 genişlikleri (375 ve 1280). */
  chromeWidths: number[];
  /** AC-20 reflow genişlikleri (640/320 + 768/820/900/1024/1100). */
  reflowWidths: number[];
  /** AC-38 axe region taraması genişlikleri (`--axe-width` virgüllü liste). */
  axeWidths: number[];
  systemStatusFixture: string;
}
/** AC-9 beklenen header yüksekliği (safe-area 0): 1280 → 76px, 375 → 64px. */
export const EXPECTED_HEADER_HEIGHT: Record<number, number> = { 1280: 76, 375: 64 };
/** AC-38 senaryo rotaları (design §4.1). */
export const AC38_ROUTES = ["/", "/support/"] as const;
const SYSTEM_NOTICE = "Sistem duyurusu";
const ok = (details: string[] = []): CheckResult => ({ status: "pass", details });
const fail = (details: string[]): CheckResult => ({ status: "fail", details });
const na = (why: string): CheckResult => ({ status: "n/a", details: [why] });

async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => undefined);
  await page.evaluate(
    () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  );
}

/** AC-9 sayımları + header yüksekliği (tek genişlik). */
async function landmarkCounts(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector("header.global-site-header");
    return {
      header: document.querySelectorAll("header.global-site-header").length,
      footer: document.querySelectorAll("footer.global-site-footer").length,
      main: document.querySelectorAll("main#main-content").length,
      anyMain: document.querySelectorAll("main").length,
      h1: document.querySelectorAll("h1").length,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height * 100) / 100 : null,
    };
  });
}

/** Odaklanan öğenin halka ölçüsü + halka/arka plan kontrastı (AC-16, AC-32). */
async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    // Odakla başlayan geçişler (ör. `transition: all`) halkayı ara değerde gösterir; önce bitir.
    for (const a of el.getAnimations()) if (a instanceof CSSTransition) a.finish();
    const cs = getComputedStyle(el);
    const parse = (c: string): [number, number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg: number[] = [255, 255, 255];
    for (let n: Element | null = el.parentElement; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) {
        bg = c[3] < 1 ? c.slice(0, 3).map((v) => v * c[3] + 255 * (1 - c[3])) : c.slice(0, 3);
        break;
      }
    }
    const ring = parse(cs.outlineColor);
    const l1 = ring ? lum(ring) : 0;
    const l2 = lum(bg);
    const contrast = ring ? (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) : 0;
    const describe =
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      [...el.classList]
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
    return {
      describe,
      isSkipLink: el.classList.contains("ui-skip-link"),
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth) || 0,
      outlineColor: cs.outlineColor,
      contrast: Math.round(contrast * 100) / 100,
    };
  });
}

/** AC-17: 375px'te chrome + primitive kontrollerinin kutusu ≥44×44 (satır içi metin linkleri hariç). */
async function touchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sel = [
      "header.global-site-header a",
      "header.global-site-header button",
      "footer.global-site-footer a",
      "footer.global-site-footer button",
      ".mobile-primary-nav a",
      ".ui-button",
      ".ui-icon-button",
      ".ui-input",
      ".ui-select",
      ".ui-textarea",
    ].join(",");
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.tagName === "A" && cs.display === "inline") continue; // satır içi metin linki
      if (el.closest(".ui-skip-link") || el.classList.contains("ui-skip-link")) continue;
      // size="sm": görsel 36px, ::before tıklama alanı 44px (design §3 "Dokunma hedefi").
      const before = getComputedStyle(el, "::before");
      const expanded = /--sm\b/.test(el.className) && before.content !== "none";
      if (expanded) continue;
      if (r.width + 0.5 < 44 || r.height + 0.5 < 44)
        out.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} ` +
            `"${(el.textContent ?? "").trim().slice(0, 24)}" ${r.width.toFixed(1)}×${r.height.toFixed(1)}`,
        );
    }
    return out;
  });
}

/** AC-18: reduced-motion emülasyonunda header/Modal/Skeleton süreleri ≤ 0.01ms. */
async function reducedMotion(page: Page): Promise<CheckResult> {
  const rows = await page.evaluate(() => {
    const ms = (v: string) =>
      v.split(",").map((x) => {
        const t = x.trim();
        return t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1000;
      });
    return [...document.querySelectorAll(".global-site-header, .ui-modal, .ui-skeleton")]
      .slice(0, 20)
      .map((el) => {
        const cs = getComputedStyle(el);
        return {
          el: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 1).join("")}`,
          max: Math.max(...ms(cs.animationDuration), ...ms(cs.transitionDuration)),
        };
      });
  });
  if (!rows.length) return na("header/Modal/Skeleton yok");
  const bad = rows.filter((r) => r.max > 0.01).map((r) => `${r.el} ${r.max}ms`);
  return bad.length ? fail(bad) : ok();
}

async function reflow(page: Page, widths: number[]): Promise<CheckResult> {
  const bad: string[] = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await settlePage(page);
    const { sw, iw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    if (sw > iw + 1) bad.push(`${w}px: scrollWidth ${sw} > ${iw}`);
  }
  return bad.length ? fail(bad) : ok([`${widths.join("/")}px`]);
}

const PRIMARY_PROPS = [
  "background-color",
  "color",
  "padding-top",
  "padding-left",
  "border-top-left-radius",
  "font-size",
  "font-weight",
  "min-height",
];
async function primaryStyle(page: Page): Promise<Record<string, string> | null> {
  return page.evaluate((props) => {
    const el = document.querySelector(".ui-button--primary");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  }, PRIMARY_PROPS);
}

/** AC-31b: ilk .ui-button--primary, doğrudan açılışta ve chrome linkiyle istemci navigasyonunda eşit. */
async function navigationEquality(
  ctx: BrowserContext,
  base: string,
  route: string,
  direct: Record<string, string> | null,
): Promise<CheckResult> {
  if (!direct) return na("sayfada .ui-button--primary yok");
  const from = route === "/" ? "/about/" : "/";
  const page = await ctx.newPage();
  try {
    await page.goto(base + from, { waitUntil: "load", timeout: 30_000 });
    await settlePage(page);
    const link = page.locator(
      `header.global-site-header a[href="${route}"], footer.global-site-footer a[href="${route}"], .mobile-primary-nav a[href="${route}"]`,
    );
    if ((await link.count()) === 0) return na(`${from} chrome'unda ${route} bağlantısı yok`);
    await link.first().click({ timeout: STEP_TIMEOUT_MS, force: true });
    await page.waitForURL((u) => u.pathname === route, { timeout: STEP_TIMEOUT_MS });
    await settlePage(page);
    const after = await primaryStyle(page);
    if (!after) return fail([`${from} → ${route} sonrası .ui-button--primary yok`]);
    const diff = PRIMARY_PROPS.filter((p) => after[p] !== direct[p]).map(
      (p) => `${p}: ${direct[p]} → ${after[p]}`,
    );
    return diff.length ? fail(diff) : ok([`${from} → ${route}`]);
  } finally {
    await page.close();
  }
}

async function forcedColors(
  ctx: BrowserContext,
  base: string,
  route: string,
): Promise<CheckResult> {
  const page = await ctx.newPage();
  try {
    await page.goto(base + route, { waitUntil: "load", timeout: 30_000 });
    await settlePage(page);
    const bad: string[] = [];
    let seen = 0;
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      const f = await focusRing(page);
      if (!f) continue;
      seen++;
      if (f.outlineStyle === "none" || f.outlineWidth < 2)
        bad.push(`${f.describe}: outline ${f.outlineStyle} ${f.outlineWidth}px`);
    }
    const marks = await page.evaluate(() => {
      const canvas = getComputedStyle(document.body).backgroundColor;
      const pick = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return (
          cs.backgroundColor !== canvas ||
          ["Top", "Right", "Bottom", "Left"].some(
            (s) =>
              cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== "none" &&
              cs.getPropertyValue(`border-${s.toLowerCase()}-color`) !== canvas,
          )
        );
      };
      return {
        tab: pick('[role="tab"][aria-selected="true"]'),
        checkbox: pick(".ui-checkbox input:checked, .ui-checkbox__box"),
      };
    });
    if (marks.tab === false) bad.push("seçili sekme Canvas'tan ayırt edilmiyor");
    if (marks.checkbox === false) bad.push("işaretli checkbox Canvas'tan ayırt edilmiyor");
    if (!seen) return na("odaklanabilir öğe yok");
    return bad.length ? fail(bad) : ok([`${seen} odak durağı`]);
  } finally {
    await page.close();
  }
}

async function checkRoute(
  ctx: BrowserContext,
  forcedCtx: BrowserContext,
  base: string,
  route: string,
  opts: ChromeCheckOptions,
): Promise<ChromeRouteResult> {
  const result: ChromeRouteResult = {
    route,
    error: null,
    headerHeight: {},
    checks: Object.fromEntries(CHROME_ACS.map((a) => [a, na("koşulmadı")])) as Record<
      ChromeAc,
      CheckResult
    >,
  };
  const page = await ctx.newPage();
  try {
    const [desktop, mobile] = [Math.max(...opts.chromeWidths), Math.min(...opts.chromeWidths)];
    await page.setViewportSize({ width: desktop, height: 900 });
    await page.goto(base + route, { waitUntil: "load", timeout: 30_000 });
    await settlePage(page);
    // AC-9 + AC-16: ilk Tab skip link'e gider; ilk 3 odak durağının halkası ölçülür.
    const nine: string[] = [];
    const sixteen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      const f = await focusRing(page);
      if (i === 0 && !f?.isSkipLink) nine.push(`ilk Tab skip link değil (${f?.describe ?? "yok"})`);
      if (!f) continue;
      if (f.outlineStyle === "none" || f.outlineWidth < 2)
        sixteen.push(`${f.describe}: outline ${f.outlineStyle} ${f.outlineWidth}px`);
      else if (f.contrast < 3) sixteen.push(`${f.describe}: halka kontrastı ${f.contrast} < 3`);
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    result.checks["AC-16"] = sixteen.length ? fail(sixteen) : ok();
    result.checks["AC-18"] = await reducedMotion(page);
    const direct = await primaryStyle(page);
    for (const w of [desktop, mobile]) {
      if (w !== desktop) {
        await page.setViewportSize({ width: w, height: 900 });
        await settlePage(page);
      }
      const c = await landmarkCounts(page);
      result.headerHeight[String(w)] = c.headerHeight;
      if (c.header !== 1) nine.push(`${w}px: header.global-site-header ${c.header}`);
      if (c.footer !== 1) nine.push(`${w}px: footer.global-site-footer ${c.footer}`);
      if (c.main !== 1) nine.push(`${w}px: main#main-content ${c.main} (main ${c.anyMain})`);
      if (c.h1 !== 1) nine.push(`${w}px: h1 ${c.h1}`);
      const expected = EXPECTED_HEADER_HEIGHT[w];
      if (
        expected !== undefined &&
        c.headerHeight !== null &&
        Math.abs(c.headerHeight - expected) > 1
      )
        nine.push(`${w}px: header yüksekliği ${c.headerHeight} (beklenen ${expected}±1)`);
    }
    result.checks["AC-9"] = nine.length ? fail(nine) : ok();
    const small = await touchTargets(page);
    result.checks["AC-17"] = small.length ? fail(small.slice(0, 15)) : ok();
    result.checks["AC-20"] = await reflow(page, opts.reflowWidths);
    result.checks["AC-31b"] = await navigationEquality(ctx, base, route, direct);
    result.checks["AC-32"] = await forcedColors(forcedCtx, base, route);
  } catch (err) {
    result.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
  } finally {
    await page.close();
  }
  return result;
}

const regionCount = (page: Page) => page.getByRole("region", { name: SYSTEM_NOTICE }).count();

/** AC-38 (design §4.1 R5-5): duyurusuz 0 region + kalıcı kap 1; fixture ile 1; kapatınca 0. */
async function checkAc38(
  ctx: BrowserContext,
  base: string,
  route: string,
  fixture: unknown,
  axeWidths: number[],
): Promise<Ac38Result> {
  const steps: Ac38Result["steps"] = [];
  const baseOrigin = new URL(base).origin;
  // (1) duyurusuz: /system/status ui-audit'te abort edilir → status null
  {
    const page = await ctx.newPage();
    try {
      await page.goto(base + route, { waitUntil: "load", timeout: 30_000 });
      await page.waitForTimeout(1000);
      const regions = await regionCount(page);
      const outer = await page.evaluate(() => {
        const all = [...document.querySelectorAll('.operations-banners[aria-live="polite"]')];
        return { n: all.length, role: all[0]?.getAttribute("role") ?? null };
      });
      const d = [`region ${regions}`, `.operations-banners[aria-live] ${outer.n}`];
      steps.push({
        name: "(1) duyurusuz",
        status: regions === 0 && outer.n === 1 && outer.role === null ? "pass" : "fail",
        details: outer.role ? [...d, `dış kap role="${outer.role}"`] : d,
      });
    } finally {
      await page.close();
    }
  }
  // (2) fixture ile + axe region, (3) kapatınca 0
  const page = await ctx.newPage();
  try {
    await page.route("**/system/status", (r) => {
      const cors = {
        "access-control-allow-origin": baseOrigin,
        "access-control-allow-credentials": "true",
        "access-control-allow-headers":
          r.request().headers()["access-control-request-headers"] ?? "*",
        "access-control-allow-methods": "GET,OPTIONS",
      };
      if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify(fixture),
      });
    });
    await page.goto(base + route, { waitUntil: "load", timeout: 30_000 });
    const region = page.getByRole("region", { name: SYSTEM_NOTICE });
    const appeared = await region
      .first()
      .waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    const n = await regionCount(page);
    const text = appeared ? ((await region.first().textContent()) ?? "") : "";
    const outerRole = await page.evaluate(
      () => document.querySelector(".operations-banners")?.getAttribute("role") ?? null,
    );
    const axeDetails: string[] = [];
    let axeOk = true;
    for (const w of axeWidths) {
      await page.setViewportSize({ width: w, height: 900 });
      await settlePage(page);
      const axe = await new AxeBuilder({ page }).withRules(["region"]).analyze();
      const nodes = axe.violations.flatMap((v) => v.nodes.map((nd) => nd.target.join(" ")));
      const banner = nodes.filter((t) => /operations-banner/.test(t));
      if (banner.length) axeOk = false;
      axeDetails.push(
        `axe region @${w}: duyuru düğümü ${banner.length}, sayfa geneli ${nodes.length}`,
      );
    }
    steps.push({
      name: "(2) fixture ile",
      status:
        n === 1 && text.includes("Test duyurusu") && outerRole === null && axeOk ? "pass" : "fail",
      details: [
        `region ${n}`,
        `metin ${text.includes("Test duyurusu") ? "var" : "yok"}`,
        ...axeDetails,
      ],
    });
    if (appeared) {
      await page.getByRole("button", { name: "Duyuruyu kapat" }).first().click();
      await page.waitForTimeout(300);
    }
    const after = await regionCount(page);
    steps.push({
      name: "(3) kapatınca",
      status: appeared && after === 0 ? "pass" : "fail",
      details: [`region ${after}`],
    });
  } finally {
    await page.close();
  }
  return { route, steps };
}

/** AC-38 son cümlesi: / → /en/ istemci navigasyonundan sonra <html lang="en">. */
async function checkLang(ctx: BrowserContext, base: string): Promise<CheckResult> {
  const page = await ctx.newPage();
  try {
    await page.goto(base + "/", { waitUntil: "load", timeout: 30_000 });
    await settlePage(page);
    const before = await page.evaluate(() => document.documentElement.lang);
    // Native History API Next router'ına entegredir (04-linking-and-navigating.md "Native
    // History API"): usePathname güncellenir, HTML yeniden yüklenmez.
    await page.evaluate(() => window.history.pushState(null, "", "/en/"));
    const ok38 = await page
      .waitForFunction(() => document.documentElement.lang === "en", undefined, {
        timeout: STEP_TIMEOUT_MS,
      })
      .then(() => true)
      .catch(() => false);
    const after = await page.evaluate(() => document.documentElement.lang);
    return ok38 ? ok([`lang ${before} → ${after}`]) : fail([`lang ${before} → ${after}`]);
  } finally {
    await page.close();
  }
}

/** Chrome-check: rota başına AC-9/16/17/18/20/31b/32 + AC-38 senaryoları. */
export async function runChromeCheck(opts: ChromeCheckOptions): Promise<ChromeReport> {
  const fixture = JSON.parse(readFileSync(opts.systemStatusFixture, "utf8")) as Record<
    string,
    unknown
  >;
  delete fixture._note;
  const browser: Browser = await chromium.launch();
  try {
    const common = { locale: "tr-TR", deviceScaleFactor: 1 } as const;
    const ctx = await browser.newContext({ ...common, reducedMotion: "reduce" });
    await prepareContext(ctx, opts.scan, opts.scan.sessionAll);
    const forcedCtx = await browser.newContext({
      ...common,
      reducedMotion: "reduce",
      forcedColors: "active",
      viewport: { width: 1280, height: 900 },
    });
    await prepareContext(forcedCtx, opts.scan, opts.scan.sessionAll);
    const base = opts.scan.baseUrl.replace(/\/$/, "");
    const routes: ChromeRouteResult[] = [];
    let next = 0;
    const worker = async () => {
      while (next < opts.routes.length) {
        const i = next++;
        routes[i] = await checkRoute(ctx, forcedCtx, base, opts.routes[i], opts);
        const r = routes[i];
        const line = r.error
          ? `HATA: ${r.error}`
          : CHROME_ACS.map((a) => `${a} ${r.checks[a].status}`).join(" · ");
        console.error(
          `[chrome-check] ${String(i + 1).padStart(3)}/${opts.routes.length} ${r.route} → ${line}`,
        );
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.scan.concurrency) }, worker));
    const ac38: Ac38Result[] = [];
    for (const route of AC38_ROUTES)
      ac38.push(await checkAc38(ctx, base, route, fixture, opts.axeWidths));
    const ac38Lang = await checkLang(ctx, base);
    await forcedCtx.close();
    await ctx.close();
    const summary: ChromeReport["summary"] = {};
    for (const a of CHROME_ACS) {
      summary[a] = { pass: 0, fail: 0, "n/a": 0 };
      for (const r of routes) summary[a][r.error ? "fail" : r.checks[a].status]++;
    }
    summary["AC-38"] = { pass: 0, fail: 0, "n/a": 0 };
    for (const s of ac38.flatMap((x) => x.steps)) summary["AC-38"][s.status]++;
    summary["AC-38"][ac38Lang.status]++;
    const ac38Failed = summary["AC-38"].fail > 0;
    return {
      schema: 1,
      generatedAt: new Date().toISOString(),
      build: { outDir: opts.outDir, buildId: readBuildId(opts.outDir) },
      session: opts.scan.sessionAll,
      widths: { chrome: opts.chromeWidths, reflow: opts.reflowWidths, axe: opts.axeWidths },
      routes,
      ac38,
      ac38Lang,
      summary,
      ac38Failed,
      failed: ac38Failed || Object.values(summary).some((s) => s.fail > 0),
    };
  } finally {
    await browser.close();
  }
}
