// Rota haritası WebView belgesi (design §4.4, §9 "Planlayıcı": harita WebView, sheet native).
// Mevcut Leaflet + karo kaynağı korunur; pin'ler gün rengiyle (tokens.color.day1…7, beyaz
// numara), rota çizgisi mapRoute token'ıyla. Bacak süre/mesafeleri YALNIZCA OSRM yanıtından
// RN'e iletilir (ROUTE_LEGS); yanıt yoksa ya da 25 noktayı aşıyorsa `legs: null` gider ve bağlantı
// satırı "Süre hesaplanamadı" yazar (I1/I2). Saf modül: React Native yok.
import { tokens, withAlpha } from "../theme";

export type MapStopPayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  index: number;
  color: string;
  isSelected: boolean;
  visited: boolean;
};

/** OSRM demo sunucusuna tek istekte gönderilen en fazla nokta (design §6.3). */
export const OSRM_MAX_POINTS = 25;

/**
 * Leaflet betiği bu sürede yüklenmezse (çevrimdışı) RN'e MAP_LOAD_FAILED gider; WebView `onError`
 * satır içi `html` kaynağında tetiklenmez. Betik sonradan yüklenirse MAP_READY uyarıyı kaldırır.
 */
export const MAP_LOAD_TIMEOUT_MS = 8000;

/** HTML içine gömülecek JSON (</script> kaçışı). */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildLeafletHtml(initialStops: MapStopPayload[], reducedMotion: boolean): string {
  const c = tokens.color;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: ${c.surfaceSunken}; }
  .leaflet-control-zoom { display: none !important; }
  .pin { display: flex; flex-direction: column; align-items: center; }
  .pin-num {
    width: 32px; height: 32px; border-radius: 16px; color: ${c.onDay};
    border: 2px solid ${c.surface}; font: 700 13px -apple-system, Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px ${withAlpha(c.black, 0.25)};
  }
  .pin-sel .pin-num { width: 40px; height: 40px; border-radius: 20px; border-width: 3px; }
  .pin-label {
    margin-top: 2px; padding: 1px 6px; border-radius: 999px; background: ${c.surface};
    color: ${c.text}; font: 600 10px -apple-system, Roboto, sans-serif; white-space: nowrap;
    max-width: 120px; overflow: hidden; text-overflow: ellipsis;
  }
  .pin-done .pin-num { opacity: 0.6; }
  .pin-temp .pin-num { background: ${c.surfaceInverse}; color: ${c.textInverse}; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="window.__leafletFailed = true"></script>
<script>
  var REDUCED = ${reducedMotion ? "true" : "false"};
  var INIT = ${embed(initialStops)};
  var map, markers, line, temp, userMarker, legsKey = "";
  var started = Date.now(), failed = false, tileLoaded = false;
  function post(msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function fail() { if (!failed) { failed = true; post({ type: "MAP_LOAD_FAILED" }); } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function(ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function focus(lat, lng, zoom) {
    if (!map) return;
    if (REDUCED) map.setView([lat, lng], zoom); else map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }
  function init() {
    if (typeof L === "undefined") {
      if (window.__leafletFailed || Date.now() - started > ${MAP_LOAD_TIMEOUT_MS}) fail();
      setTimeout(init, failed ? 1000 : 50);
      return;
    }
    map = L.map("map", { zoomControl: false }).setView([41.0082, 28.9784], 13);
    L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=tr", {
      maxZoom: 20, subdomains: ["0", "1", "2", "3"]
    }).on("tileload", function() { tileLoaded = true; })
      .on("tileerror", function() { if (!tileLoaded) fail(); })
      .addTo(map);
    markers = L.layerGroup().addTo(map);
    map.on("click", function(e) { post({ type: "MAP_CLICK", lat: e.latlng.lat, lng: e.latlng.lng }); });
    window.focusStop = function(lat, lng, zoom) { focus(lat, lng, zoom || 16); };
    window.fitAll = function() {
      var pts = [];
      markers.eachLayer(function(m) { pts.push(m.getLatLng()); });
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], animate: !REDUCED });
    };
    window.setTempPin = function(lat, lng, label) {
      if (temp) map.removeLayer(temp);
      if (lat === null) { temp = null; return; }
      temp = L.marker([lat, lng], { icon: L.divIcon({ className: "", iconSize: [120, 56], iconAnchor: [60, 18],
        html: '<div class="pin pin-temp"><div class="pin-num">+</div><div class="pin-label">' + esc(label) + "</div></div>" }) }).addTo(map);
      focus(lat, lng, 16);
    };
    window.updateStops = function(stops) {
      markers.clearLayers();
      if (line) { map.removeLayer(line); line = null; }
      var pts = [];
      (stops || []).forEach(function(s) {
        pts.push([s.lat, s.lng]);
        var cls = "pin" + (s.isSelected ? " pin-sel" : "") + (s.visited ? " pin-done" : "");
        var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [120, 60], iconAnchor: [60, 20],
          html: '<div class="' + cls + '"><div class="pin-num" style="background:' + s.color + '">' + s.index + '</div><div class="pin-label">' + esc(s.name) + "</div></div>" }) });
        m.on("click", function(e) { L.DomEvent.stopPropagation(e); post({ type: "PIN_SELECT", id: s.id }); });
        m.addTo(markers);
      });
      if (pts.length > 1) {
        line = L.polyline(pts, { color: "${c.mapRoute}", weight: 4, opacity: 0.5, dashArray: "6 6" }).addTo(map);
      }
      var key = pts.map(function(p) { return p[1].toFixed(5) + "," + p[0].toFixed(5); }).join(";");
      if (key === legsKey) return;
      legsKey = key;
      if (pts.length < 2) { post({ type: "ROUTE_LEGS", key: key, legs: [] }); return; }
      if (pts.length > ${OSRM_MAX_POINTS}) { post({ type: "ROUTE_LEGS", key: key, legs: null }); return; }
      fetch("https://router.project-osrm.org/route/v1/walking/" + key + "?overview=full&geometries=geojson")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (key !== legsKey) return;
          var route = data && data.routes && data.routes[0];
          if (!route) { post({ type: "ROUTE_LEGS", key: key, legs: null }); return; }
          if (route.geometry) {
            if (line) map.removeLayer(line);
            line = L.polyline(route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; }),
              { color: "${c.mapRoute}", weight: 5, opacity: 0.95 }).addTo(map);
          }
          post({ type: "ROUTE_LEGS", key: key, legs: (route.legs || []).map(function(l) {
            return { duration: l.duration, distance: l.distance };
          }) });
        })
        .catch(function() { if (key === legsKey) post({ type: "ROUTE_LEGS", key: key, legs: null }); });
    };
    window.requestUserLocation = function() {
      if (!navigator.geolocation) { post({ type: "LOCATION_ERROR" }); return; }
      navigator.geolocation.getCurrentPosition(function(pos) {
        var ll = [pos.coords.latitude, pos.coords.longitude];
        if (userMarker) userMarker.setLatLng(ll);
        else userMarker = L.circleMarker(ll, { radius: 8, color: "${c.surface}", weight: 3, fillColor: "${c.infoIcon}", fillOpacity: 1 }).addTo(map);
        focus(ll[0], ll[1], 15);
      }, function() { post({ type: "LOCATION_ERROR" }); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
    };
    window.updateStops(INIT);
    window.fitAll();
    failed = false;
    post({ type: "MAP_READY" });
  }
  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else window.addEventListener("DOMContentLoaded", init);
</script>
</body>
</html>`;
}

/** OSRM bacak anahtarı (WebView ile aynı: "lng,lat;…", 5 basamak). */
export function legsKeyOf(stops: ReadonlyArray<{ lat: number; lng: number }>): string {
  return stops.map((s) => `${s.lng.toFixed(5)},${s.lat.toFixed(5)}`).join(";");
}
