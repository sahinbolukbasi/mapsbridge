// ui-audit istek politikası (saf fonksiyon; design §2.6 Leaflet yerel servisi, R5-3).
// Playwright route'ları kayıt sırasının tersine değerlendirdiği için Leaflet eşlemesi
// ayrı route olarak değil, catch-all handler'ın içinde external abort'tan önce yapılır.
import { join } from "node:path";

export const LEAFLET_PREFIX = "https://unpkg.com/leaflet@1.9.4/dist/";

export type Decision =
  { action: "continue" } | { action: "fulfill-file"; path: string } | { action: "abort" };

export function decide(
  url: string,
  opts: { baseOrigin: string; allowExternal: boolean; leafletDist: string },
): Decision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { action: "abort" };
  }
  const local =
    parsed.origin === opts.baseOrigin || parsed.protocol === "data:" || parsed.protocol === "blob:";
  if (opts.allowExternal || local) return { action: "continue" };
  const leafletPath = "/leaflet@1.9.4/dist/";
  // URL ayrıştırması ../ segmentlerini çözer; normalize edilmiş yol hâlâ dist altında olmalı.
  if (
    url.startsWith(LEAFLET_PREFIX) &&
    parsed.hostname === "unpkg.com" &&
    parsed.pathname.startsWith(leafletPath)
  ) {
    const rest = decodeURIComponent(parsed.pathname.slice(leafletPath.length));
    if (rest && !rest.split("/").includes("..")) {
      return { action: "fulfill-file", path: join(opts.leafletDist, rest) };
    }
  }
  return { action: "abort" };
}
