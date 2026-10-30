/**
 * Chrome-check senaryoları. C2.1'de yalnızca Leaflet anlık görüntüsü (AC-31c, design §2.6
 * "Kapsam", "Ölçüm öncesi kararlılık", "Anlık görüntü biçimi"; §17.-3 #1). Chrome-check'in geri
 * kalanı C6'da bu dosyaya eklenir.
 *
 * KURAL (§17.-3 #1c): senaryonun DOM kancasını (.pub-route-footer, .pub-route-cta-btn.secondary,
 * .stitch-pin-active-popup, divIcon className'leri) değiştiren commit, aşağıdaki LEAFLET_SCENARIOS
 * sabitini ve requirements AC-31c'yi aynı commit'te günceller. Seçiciler YALNIZCA burada yaşar.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
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
