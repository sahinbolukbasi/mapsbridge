"use client";

import { readShare } from "../lib/api";

import { useEffect, useRef, useState } from "react";
import "./k.css";
import { PageHeader } from "../components/ui";

interface LeafletMap {
  remove(): void;
  flyTo(latlng: [number, number], zoom: number, opts?: Record<string, unknown>): void;
}

interface LeafletMarker {
  remove(): void;
}

interface LeafletLib {
  map(el: HTMLElement, opts?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, opts?: Record<string, unknown>): { addTo(map: LeafletMap): void };
  divIcon(opts: Record<string, unknown>): unknown;
  marker(latlng: [number, number], opts?: Record<string, unknown>): LeafletMarker;
}

interface ShareData {
  code: string;
  lat: number;
  lng: number;
  address: string;
  hours: number;
  expiresAt: number;
}

export default function FindByCodePage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const latestShare = useRef<ShareData | null>(null);
  const requestSequence = useRef(0);

  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [showLookupModal, setShowLookupModal] = useState(true);

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    function initMap() {
      const L = (window as Window & { L?: LeafletLib }).L;
      if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }) as any;
      map.setView([41.0082, 28.9784], 12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      if (latestShare.current) renderShare(latestShare.current);
    }

    // Read the address independently of the map SDK.
    const params = new URLSearchParams(window.location.search);
    const queryCode = params.get("kod") || params.get("code");
    if (queryCode && isMounted) {
      setInputCode(queryCode);
      fetchLocationByCode(queryCode);
    }

    if (!(window as Window & { L?: LeafletLib }).L) {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onerror = () =>
        setError("Harita yüklenemedi. Kodla adres sorgulamasını yine kullanabilirsiniz.");
      script.onload = () => {
        if (isMounted) initMap();
      };
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      isMounted = false;
      requestSequence.current += 1;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  async function fetchLocationByCode(rawCode: string) {
    const cleanCode = rawCode.trim().replace(/\s+/g, "");
    if (!cleanCode) return;

    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    setShareData(null);
    latestShare.current = null;
    markerRef.current?.remove();
    markerRef.current = null;

    try {
      const data: ShareData = await readShare(cleanCode);

      if (sequence !== requestSequence.current) return;
      latestShare.current = data;
      setShareData(data);
      setShowLookupModal(false);

      renderShare(data);
    } catch (err: unknown) {
      if (sequence === requestSequence.current) setError((err instanceof Error ? err.message : null) || "Konum sorgulanamadı.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  function renderShare(data: ShareData) {
    // Render marker and fly on map
    const L = (window as Window & { L?: LeafletLib }).L;
    if (mapInstanceRef.current && L) {
      const customPin = L.divIcon({
        className: "custom-map-pin",
        html: `<div class="pin-pulse"></div><div class="pin-marker"><svg width="32" height="42" viewBox="0 0 28 36" fill="none"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.732-6.268-14-14-14z" fill="#ef6b5b"/><circle cx="14" cy="14" r="6" fill="#ffffff"/></svg></div>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const marker = (L.marker([data.lat, data.lng], { icon: customPin }) as any).addTo(
        mapInstanceRef.current,
      );
      markerRef.current = marker;

      mapInstanceRef.current.flyTo([data.lat, data.lng], 16, { animate: true, duration: 1.5 });
    }
  }

  useEffect(() => {
    if (!shareData) return;
    const timer = setTimeout(
      () => {
        latestShare.current = null;
        setShareData(null);
        markerRef.current?.remove();
        markerRef.current = null;
        setError("Paylaşımın süresi doldu. Yeni bir kod isteyin.");
        setShowLookupModal(true);
      },
      Math.max(0, shareData.expiresAt * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [shareData]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchLocationByCode(inputCode);
  }

  return (
    <main className="lookup-page">
      {/* AC-34: prerender HTML'inde tek h1 (başlık route-registry'den; görsel olarak gizli). */}
      <PageHeader variant="hidden" />
      {/* Full Screen Map */}
      <div ref={mapContainerRef} className="lookup-map" />

      {/* Harita üstü eylem çubuğu (site header'ı SiteChrome'da; marka rozeti C6'da kaldırıldı) */}
      <div className="lookup-header">
        <span aria-hidden="true" />
        <button className="open-lookup-btn" onClick={() => setShowLookupModal(true)}>
          🔍 Yeni Kod Gir
        </button>
      </div>

      {/* Lookup Modal / Dialog */}
      {showLookupModal && (
        <div className="modal-backdrop" onClick={() => setShowLookupModal(false)}>
          <div className="lookup-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-btn"
              type="button"
              onClick={() => setShowLookupModal(false)}
              aria-label="Kapat ve Haritaya Dön"
              title="Haritaya Dön"
            >
              ✕
            </button>
            <div className="icon-wrap">🔑</div>
            <h2>Kodla Konum Bul</h2>
            <p>
              Sizinle paylaşılan 6 haneli konum doğrulama kodunu girerek adresi ve haritadaki yerini
              anında görüntüleyin.
            </p>

            <form onSubmit={handleSubmit} className="code-form">
              <input
                type="text"
                placeholder="Örn: 849201"
                maxLength={32}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                autoFocus
                className="code-input"
                aria-label="Paylaşım kodu"
              />
              <button type="submit" disabled={loading || !inputCode.trim()} className="submit-btn">
                {loading ? "Konum Aranıyor…" : "Konumu Haritada Göster →"}
              </button>
            </form>

            {error && (
              <p role="alert" className="error-msg">
                {error}
              </p>
            )}

            <button
              type="button"
              className="return-map-action"
              onClick={() => setShowLookupModal(false)}
            >
              ← Haritayı İncele / Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Card When Location Found */}
      {shareData && !showLookupModal && (
        <section className="found-sheet">
          <div className="found-header">
            <span className="badge">✓ DOĞRULANMIŞ PAYLAŞIM</span>
            <span className="code-pill">Kod: {shareData.code}</span>
          </div>

          <strong className="found-address">{shareData.address}</strong>
          <small className="found-coords">
            {shareData.lat.toFixed(5)}, {shareData.lng.toFixed(5)}
          </small>

          <div className="nav-actions">
            <a
              className="nav-btn google"
              href={`https://www.google.com/maps/dir/?api=1&destination=${shareData.lat},${shareData.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              🗺️ Google Haritalar
            </a>
            <a
              className="nav-btn apple"
              href={`https://maps.apple.com/?daddr=${shareData.lat},${shareData.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              🧭 Apple Haritalar
            </a>
            <a
              className="nav-btn yandex"
              href={`https://yandex.com.tr/harita/?rtext=~${shareData.lat},${shareData.lng}&rtt=auto`}
              target="_blank"
              rel="noreferrer"
            >
              🚗 Yandex Navigasyon
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
