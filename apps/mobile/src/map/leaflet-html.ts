// Rota haritası WebView belgesi (design §4.4, §9 "Planlayıcı": harita WebView, sheet native).
// Mevcut Leaflet + karo kaynağı korunur; pin'ler gün rengiyle (tokens.color.day1…7, beyaz
// numara), rota çizgisi mapRoute token'ıyla. Bacak süre/mesafeleri YALNIZCA OSRM yanıtından
// RN'e iletilir (ROUTE_LEGS); yanıt yoksa ya da 25 noktayı aşıyorsa `legs: null` gider ve bağlantı
// satırı "Süre hesaplanamadı" yazar (I1/I2). Saf modül: React Native yok.
import { tokens, withAlpha } from "../theme";
import { iconPaths } from "../theme/icon-paths";
import { TILE_CACHE } from "../services/tile-logic";

/** OSM standart karoları (web planlayıcı "Standart" katmanıyla aynı kaynak; atıf zorunlu). */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Pin popup'ı (Increment 4.4, web pin-popup modeli): metinler RN'de hazırlanır (I11), WebView
 * yalnızca kaçışlayarak çizer. Alanlar yalnız durak kaydından (I1); boş alan gönderilmez (I10).
 */
export type MapPopupPayload = {
  category: string;
  day?: string;
  title: string;
  address?: string;
  note?: string;
  /** Gezildi ise görünen etiket ("Tamamlandı"). */
  visited?: string;
  details: string;
  toggle: string;
};

export type MapPoolPayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  popup: MapPopupPayload;
};

export type MapStopPayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  index: number;
  color: string;
  isSelected: boolean;
  visited: boolean;
  popup?: MapPopupPayload;
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
  .leaflet-control-attribution { font: 400 10px -apple-system, Roboto, sans-serif; }
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
  /* Gezildi pini haritada kalır: kesik kenar + onay rozeti (renk tek başına anlam taşımaz). */
  .pin-done .pin-num { opacity: 0.75; border-style: dashed; border-color: ${c.text}; }
  .pin-check { position: absolute; margin-left: 26px; margin-top: -4px; width: 16px; height: 16px;
    border-radius: 8px; background: ${c.surface}; display: flex; align-items: center; justify-content: center; }
  .pin-pool .pin-num { background: ${c.surface}; color: ${c.text}; border: 2px dashed ${c.textMuted}; }
  .leaflet-popup-content-wrapper { border-radius: 14px; }
  .leaflet-popup-content { margin: 12px 14px; min-width: 200px; }
  .pp p { margin: 0 0 4px; color: ${c.text}; font: 400 13px -apple-system, Roboto, sans-serif; }
  .pp .pp-cat { color: ${c.textMuted}; font-size: 12px; font-weight: 600; }
  .pp .pp-title { font-size: 15px; font-weight: 700; }
  .pp .pp-addr, .pp .pp-note { color: ${c.textMuted}; }
  .pp .pp-done { display: flex; align-items: center; gap: 4px; color: ${c.success}; font-weight: 600; }
  .pp-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pp-actions button { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid ${c.buttonSecondaryBorder};
    background: ${c.buttonSecondaryBg}; color: ${c.buttonSecondaryFg}; font: 700 13px -apple-system, Roboto, sans-serif; }
  .pp-actions button.pp-primary { background: ${c.buttonPrimaryBg}; color: ${c.buttonPrimaryFg}; border-color: ${c.buttonPrimaryBg}; }
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
  var CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${iconPaths.check}" stroke="${c.success}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var pool, byId = {};
  function popupHtml(id, p) {
    if (!p) return null;
    var h = '<div class="pp"><p class="pp-cat">' + esc(p.category) + (p.day ? " · " + esc(p.day) : "") + "</p>" +
      '<p class="pp-title">' + esc(p.title) + "</p>";
    if (p.address) h += '<p class="pp-addr">' + esc(p.address) + "</p>";
    if (p.note) h += '<p class="pp-note">' + esc(p.note) + "</p>";
    if (p.visited) h += '<p class="pp-done">' + CHECK + esc(p.visited) + "</p>";
    h += '<div class="pp-actions"><button type="button" class="pp-primary" data-act="details" data-id="' + esc(id) + '">' + esc(p.details) + "</button>" +
      '<button type="button" data-act="toggle" data-id="' + esc(id) + '">' + esc(p.toggle) + "</button></div></div>";
    return h;
  }
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
    map.attributionControl.setPrefix(false);
    // Çevrimdışı karo önbelleği (I12, OSM politikası): yalnız GÖRÜLEN karo, zaten indirilmiş
    // görüntüden (ek istek yok) RN'e iletilir; ağ yokken hata olan karo RN önbelleğinden döner.
    var saved = {}, pending = {};
    function keyOf(c) { return c.z + "-" + c.x + "-" + c.y; }
    window.provideTile = function(key, uri) {
      var img = pending[key];
      delete pending[key];
      if (uri && img) { img.src = uri; tileLoaded = true; failed = false; }
      else if (!tileLoaded) fail();
    };
    L.tileLayer("${TILE_URL}", {
      maxZoom: 19, crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).on("tileload", function(e) {
        tileLoaded = true;
        var c = e.coords, img = e.tile, key = keyOf(c);
        if (saved[key] || c.z > ${TILE_CACHE.maxZoom} || !img || String(img.src).indexOf("data:") === 0) return;
        saved[key] = true;
        try {
          var cv = document.createElement("canvas");
          cv.width = img.naturalWidth || 256; cv.height = img.naturalHeight || 256;
          cv.getContext("2d").drawImage(img, 0, 0);
          var data = cv.toDataURL("image/png").split(",")[1];
          if (data) post({ type: "TILE_SAVE", key: key, data: data });
        } catch (err) {}
      })
      .on("tileerror", function(e) {
        var key = keyOf(e.coords);
        pending[key] = e.tile;
        post({ type: "TILE_MISS", key: key });
      })
      .addTo(map);
    markers = L.layerGroup().addTo(map);
    pool = L.layerGroup().addTo(map);
    map.on("click", function(e) { post({ type: "MAP_CLICK", lat: e.latlng.lat, lng: e.latlng.lng }); });
    map.on("moveend", function() { var ctr = map.getCenter(); post({ type: "MAP_MOVED", lat: ctr.lat, lng: ctr.lng }); });
    map.on("popupopen", function(e) {
      var el = e.popup.getElement();
      if (!el) return;
      Array.prototype.forEach.call(el.querySelectorAll("button[data-act]"), function(b) {
        b.addEventListener("click", function(ev) {
          ev.stopPropagation();
          post({ type: "POPUP_ACTION", act: b.getAttribute("data-act"), id: b.getAttribute("data-id") });
          map.closePopup();
        });
      });
    });
    window.openPopup = function(id) { var m = byId[id]; if (m && m.getPopup()) m.openPopup(); };
    window.updatePool = function(list) {
      pool.clearLayers();
      (list || []).forEach(function(s) {
        var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [120, 60], iconAnchor: [60, 20],
          html: '<div class="pin pin-pool"><div class="pin-num">+</div><div class="pin-label">' + esc(s.name) + "</div></div>" }) });
        var html = popupHtml(s.id, s.popup);
        if (html) m.bindPopup(html, { maxWidth: 260, autoPan: true });
        m.on("click", function(e) { L.DomEvent.stopPropagation(e); });
        m.addTo(pool);
      });
    };
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
      byId = {};
      if (line) { map.removeLayer(line); line = null; }
      var pts = [];
      (stops || []).forEach(function(s) {
        pts.push([s.lat, s.lng]);
        var cls = "pin" + (s.isSelected ? " pin-sel" : "") + (s.visited ? " pin-done" : "");
        var m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", iconSize: [120, 60], iconAnchor: [60, 20],
          html: '<div class="' + cls + '"><div class="pin-num" style="background:' + s.color + '">' + s.index + "</div>" +
            (s.visited ? '<div class="pin-check">' + CHECK + "</div>" : "") + '<div class="pin-label">' + esc(s.name) + "</div></div>" }) });
        var html = popupHtml(s.id, s.popup);
        if (html) m.bindPopup(html, { maxWidth: 260, autoPan: true });
        m.on("click", function(e) { L.DomEvent.stopPropagation(e); post({ type: "PIN_SELECT", id: s.id }); });
        m.addTo(markers);
        byId[s.id] = m;
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
    // Konum RN'den (expo-location, izin gerekçesiyle) gelir; WebView geolocation yalnız yedek.
    window.showUser = function(lat, lng) {
      var ll = [lat, lng];
      if (userMarker) userMarker.setLatLng(ll);
      else userMarker = L.circleMarker(ll, { radius: 8, color: "${c.surface}", weight: 3, fillColor: "${c.infoIcon}", fillOpacity: 1 }).addTo(map);
      focus(lat, lng, 15);
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
