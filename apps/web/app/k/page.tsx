"use client";

import { readShare } from "../lib/api";

import { useEffect, useRef, useState } from "react";
import "./k.css";
import { Alert, Button, Field, Input, Modal, PageHeader, PageShell } from "../components/ui";
import { ensureLeafletCss, ensureLeafletScript } from "../lib/leaflet-loader";

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
  const codeInputRef = useRef<HTMLInputElement>(null);
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
    // Kanonik parametre `code`; eski bağlantılar için `kod` da okunur (design §5.4).
    const queryCode = params.get("code") || params.get("kod");
    if (queryCode && isMounted) {
      setInputCode(queryCode);
      fetchLocationByCode(queryCode);
    }

    if (!(window as Window & { L?: LeafletLib }).L) {
      ensureLeafletCss();
      ensureLeafletScript({
        onError: () =>
          setError("Harita yüklenemedi. Kodla adres sorgulamasını yine kullanabilirsiniz."),
        onLoad: () => {
          if (isMounted) initMap();
        },
      });
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
      if (sequence === requestSequence.current)
        setError((err instanceof Error ? err.message : null) || "Konum sorgulanamadı.");
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
    <PageShell layout="app" className="lookup-page">
      {/* AC-34: prerender HTML'inde tek h1 (başlık route-registry'den; görsel olarak gizli). */}
      <PageHeader variant="hidden" />
      {/* Full Screen Map */}
      <div ref={mapContainerRef} className="lookup-map" role="region" aria-label="Harita" />

      {/* Harita üstü eylem çubuğu (site header'ı SiteChrome'da; marka rozeti C6'da kaldırıldı) */}
      <div className="lookup-header">
        <span aria-hidden="true" />
        <button className="open-lookup-btn" onClick={() => setShowLookupModal(true)}>
          🔍 Yeni Kod Gir
        </button>
      </div>

      {/* Kod sorgulama penceresi (design §3 Modal; yerel <dialog>, odak kod alanında) */}
      <Modal
        open={showLookupModal}
        onClose={() => setShowLookupModal(false)}
        title="Kodla Konum Bul"
        description="Sizinle paylaşılan 6 haneli konum doğrulama kodunu girerek adresi ve haritadaki yerini anında görüntüleyin."
        size="sm"
        initialFocus={codeInputRef}
        className="lookup-dialog"
      >
        <div className="icon-wrap" aria-hidden="true">
          🔑
        </div>
        <form onSubmit={handleSubmit} className="code-form">
          <Field label="Paylaşım kodu">
            {(ids) => (
              <Input
                {...ids}
                ref={codeInputRef}
                type="text"
                placeholder="Örn: 849201"
                maxLength={32}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loading} disabled={!inputCode.trim()}>
            {loading ? "Konum Aranıyor…" : "Konumu Haritada Göster →"}
          </Button>
        </form>

        {error && (
          <Alert tone="danger" live="assertive">
            {error}
          </Alert>
        )}

        <Button variant="link" fullWidth onClick={() => setShowLookupModal(false)}>
          ← Haritayı İncele / Vazgeç
        </Button>
      </Modal>

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
    </PageShell>
  );
}
