/**
 * Sayfa/rota keşfi: apps/web/app altındaki her page.tsx dosyasından rota listesi üretir.
 * Dinamik segmentler ([param]) generateStaticParams içindeki sabit değerlerden çözülür.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface PageEntry {
  /** apps/web'e göre göreli page.tsx yolu */
  file: string;
  /** Kaynak rota şablonu, ör. "/[username]/" */
  pattern: string;
  /** Somut, ziyaret edilebilir rotalar (trailingSlash: true) */
  routes: string[];
  /** Kök → yaprak sırasıyla rotaya uygulanan layout.tsx dosyaları (apps/web'e göre göreli) */
  layouts: string[];
}

const IGNORED_DIRS = new Set(["node_modules", ".next", "out"]);

function walk(dir: string, match: (name: string) => boolean, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, match, acc);
    else if (match(name)) acc.push(full);
  }
  return acc;
}

export function findFiles(dir: string, match: (name: string) => boolean): string[] {
  return walk(dir, match).sort();
}

/** generateStaticParams içindeki `{ key: "value" }` sabitlerini toplar. */
function staticParamValues(source: string, param: string): string[] {
  const block = source.match(/generateStaticParams\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!block) return [];
  const re = new RegExp(`${param}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`, "g");
  return [...block[1].matchAll(re)].map((m) => m[1]);
}

export function discoverPages(webRoot: string): PageEntry[] {
  const appDir = join(webRoot, "app");
  const pageFiles = findFiles(appDir, (n) => n === "page.tsx");
  const layoutSet = new Set(
    findFiles(appDir, (n) => n === "layout.tsx").map((f) => relative(webRoot, f)),
  );

  return pageFiles.map((abs) => {
    const relDir = relative(appDir, join(abs, ".."));
    const segments = relDir === "" ? [] : relDir.split(sep);
    // Route group'lar "(grup)" URL'de görünmez.
    const urlSegments = segments.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
    const pattern = "/" + urlSegments.map((s) => `${s}/`).join("");

    const layouts: string[] = [];
    for (let i = 0; i <= segments.length; i++) {
      const candidate = join("app", ...segments.slice(0, i), "layout.tsx");
      if (layoutSet.has(candidate)) layouts.push(candidate);
    }

    let routes = [pattern];
    const dynamic = urlSegments.filter((s) => /^\[[^\]]+\]$/.test(s));
    if (dynamic.length) {
      const source = readFileSync(abs, "utf8");
      for (const seg of dynamic) {
        const param = seg.slice(1, -1).replace(/^\.\.\./, "");
        const values = staticParamValues(source, param);
        routes = routes.flatMap((r) => values.map((v) => r.replace(`${seg}/`, `${v}/`)));
      }
    }

    return { file: relative(webRoot, abs), pattern, routes, layouts };
  });
}

/** Tüm somut rotalar (tekrarsız, sıralı). /en varyantları kendi page.tsx'lerinden gelir. */
export function allRoutes(pages: PageEntry[]): string[] {
  return [...new Set(pages.flatMap((p) => p.routes))].sort();
}

export function isAdminRoute(route: string): boolean {
  return route === "/admin/" || route.startsWith("/admin/") || route.startsWith("/u/admin/");
}

/** Ekran görüntüsü dosya adı için rota → slug: "/" → "home", "/u/admin/" → "u__admin". */
export function routeSlug(route: string): string {
  const trimmed = route.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "home" : trimmed.replace(/\//g, "__");
}
