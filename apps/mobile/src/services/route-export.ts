// Rotayı dosya olarak dışa aktarma (K4 paylaşım): GPX 1.1, yalnız kayıttaki ad ve koordinatlar
// (I1; süre/mesafe yazılmaz). Saf (test: apps/web/tests/mobile/deep-links.test.cjs).
export type ExportStop = { name: string; lat: number; lng: number; address?: string };
const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );
export function routeToGpx(name: string, stops: readonly ExportStop[]): string {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const wpt = pts
    .map(
      (s) =>
        `  <wpt lat="${s.lat.toFixed(6)}" lon="${s.lng.toFixed(6)}"><name>${xml(s.name)}</name>${
          s.address ? `<desc>${xml(s.address)}</desc>` : ""
        }</wpt>`,
    )
    .join("\n");
  const rte = pts
    .map(
      (s) =>
        `    <rtept lat="${s.lat.toFixed(6)}" lon="${s.lng.toFixed(6)}"><name>${xml(s.name)}</name></rtept>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Maps Bridge" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(name)}</name></metadata>
${wpt}
  <rte><name>${xml(name)}</name>
${rte}
  </rte>
</gpx>
`;
}
/** Dosya adı: harf/rakam/tire, ≤ 40 karakter. */
export function gpxFileName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  return `${base || "rota"}.gpx`;
}
