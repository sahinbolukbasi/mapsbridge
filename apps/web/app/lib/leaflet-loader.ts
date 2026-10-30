// Leaflet SDK'sının tek yükleme noktası (design §4.4 satır 17, C14). URL'ler bugünküyle aynıdır
// (ui-audit route-policy bu adresleri yerel kopyaya yönlendirir). Fonksiyonlar idempotenttir:
// aynı id'li <link>/<script> varsa yenisi eklenmez.

export const LEAFLET_VERSION = "1.9.4";
export const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
export const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const CSS_ID = "leaflet-css";
const JS_ID = "leaflet-js";

/** leaflet.css'i <head>'e bir kez ekler. */
export function ensureLeafletCss(doc: Document = document): void {
  if (doc.getElementById(CSS_ID)) return;
  const link = doc.createElement("link");
  link.id = CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  doc.head.appendChild(link);
}

/**
 * leaflet.js <script>'ini döndürür; yoksa oluşturup <body>'ye ekler. Dinleyiciler eklemeden ÖNCE
 * bağlanır. `reload: true` (harita yeniden deneme, mapAttempt > 0) mevcut betiği kaldırıp yeniden
 * yükler. Dönen öğe temizlikte removeEventListener için kullanılır.
 */
export function ensureLeafletScript({
  onLoad,
  onError,
  reload = false,
  doc = document,
}: {
  onLoad?: () => void;
  onError?: () => void;
  reload?: boolean;
  doc?: Document;
} = {}): HTMLScriptElement {
  let script = doc.getElementById(JS_ID) as HTMLScriptElement | null;
  if (reload && script) {
    script.remove();
    script = null;
  }
  const isNew = !script;
  script ||= doc.createElement("script");
  script.id = JS_ID;
  script.src = LEAFLET_JS_URL;
  script.async = true;
  if (onLoad) script.addEventListener("load", onLoad);
  if (onError) script.addEventListener("error", onError);
  if (isNew) doc.body.appendChild(script);
  return script;
}
