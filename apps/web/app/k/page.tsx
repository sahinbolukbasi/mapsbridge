"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CopyRouteButton } from "../components/copy-route-button";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Input,
  PageHeader,
  PageShell,
} from "../components/ui";
import { readShare } from "../lib/api";
import { ensureLeafletCss, ensureLeafletScript } from "../lib/leaflet-loader";
import { useLocale } from "../lib/locale-context";
import { normalizeShareCode, readShareCode } from "../lib/share/share-code";
import { toCopyStops } from "../lib/trip/copy-stops";
import "./k.css";

interface LeafletMap {
  remove(): void;
  setView(latlng: [number, number], zoom: number): void;
  flyTo(latlng: [number, number], zoom: number, opts?: Record<string, unknown>): void;
}

interface LeafletMarker {
  remove(): void;
  addTo(map: LeafletMap): LeafletMarker;
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

function leaflet(): LeafletLib | undefined {
  return (window as Window & { L?: LeafletLib }).L;
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Paylaşılan konum (design §5.1, §5.5 J5, §6.4, §12): hesapsız açık. Kod tek kuraldan
 * (lib/share/share-code.ts, karar S16) geçer; geçersizse alan hatası verilir ve istek atılmaz.
 * URL'de geçerli `code` (ya da eski `kod`) varsa pencere açılmadan doğrudan sorgulanır. Sunucu
 * hata mesajları (bulunamadı/süresi dolmuş/çok deneme) olduğu gibi `Alert danger` ile gösterilir.
 */
export default function SharedLocationPage() {
  const { t } = useLocale();
  const mapRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const marker = useRef<LeafletMarker | null>(null);
  const latest = useRef<ShareData | null>(null);
  const sequence = useRef(0);

  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState(false);
  const [share, setShare] = useState<ShareData | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  // Hata (alan ya da sunucu) gelince kart sallanır.
  useEffect(() => {
    if (!fieldError && !error) return;
    const el = panelRef.current;
    if (!el) return;
    el.classList.remove("ui-shake");
    void el.offsetWidth;
    el.classList.add("ui-shake");
  }, [fieldError, error]);
  useEffect(() => {
    if (lookupOpen) codeRef.current?.focus({ preventScroll: true });
  }, [lookupOpen]);

  function renderShare(data: ShareData) {
    const L = leaflet();
    const map = mapInstance.current;
    if (!map || !L) return;
    marker.current?.remove();
    const icon = L.divIcon({
      className: "planner-point-pin",
      html: `<span class="planner-point-pin__dot"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    marker.current = L.marker([data.lat, data.lng], { icon, keyboard: false }).addTo(map);
    if (reducedMotion()) map.setView([data.lat, data.lng], 16);
    else map.flyTo([data.lat, data.lng], 16, { animate: true, duration: 1.2 });
  }

  async function lookup(valid: string) {
    const seq = ++sequence.current;
    setLoading(true);
    setError("");
    setShare(null);
    latest.current = null;
    marker.current?.remove();
    marker.current = null;
    try {
      const data: ShareData = await readShare(valid);
      if (seq !== sequence.current) return;
      latest.current = data;
      setShare(data);
      setLookupOpen(false);
      renderShare(data);
    } catch (err: unknown) {
      if (seq !== sequence.current) return;
      setError(
        (err instanceof Error ? err.message : "") ||
          t("share.error.generic", "Konum sorgulanamadı."),
      );
      setLookupOpen(true);
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    function initMap() {
      const L = leaflet();
      if (!L || !mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, { zoomControl: false });
      map.setView([41.0082, 28.9784], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
        maxZoom: 19,
      }).addTo(map);
      mapInstance.current = map;
      if (latest.current) renderShare(latest.current);
    }

    // Kanonik `code`; eski bağlantılar için `kod` da okunur (design §5.4).
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("code") ?? params.get("kod");
    const valid = readShareCode(raw);
    if (valid) {
      setCode(valid);
      void lookup(valid);
    } else {
      // Kod yoksa ya da URL'deki kod geçersizse pencere boş açılır (design §12.2).
      setLookupOpen(true);
    }

    if (!leaflet()) {
      ensureLeafletCss();
      ensureLeafletScript({
        onError: () => {
          if (mounted) setMapError(true);
        },
        onLoad: () => {
          if (mounted) initMap();
        },
      });
    } else {
      initMap();
    }
    return () => {
      mounted = false;
      sequence.current += 1;
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
    // Yalnızca ilk yüklemede (URL okuma + harita kurulumu).
  }, []);

  // Paylaşım süresi dolunca konum kaldırılır.
  useEffect(() => {
    if (!share) return;
    const timer = setTimeout(
      () => {
        latest.current = null;
        setShare(null);
        marker.current?.remove();
        marker.current = null;
        setError(t("share.expired", "Paylaşımın süresi doldu. Yeni bir kod iste."));
        setLookupOpen(true);
      },
      Math.max(0, share.expiresAt * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [share, t]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const valid = readShareCode(code);
    if (!valid) {
      setFieldError(t("home.share.error", "Kod 4–64 harf, rakam veya tireden oluşur"));
      codeRef.current?.focus();
      return;
    }
    setFieldError(null);
    setCode(valid);
    void lookup(valid);
  }

  const dest = share ? `${share.lat},${share.lng}` : "";
  const stops = share
    ? toCopyStops([
        { label: share.address, address: share.address, lat: share.lat, lng: share.lng },
      ])
    : [];

  return (
    <PageShell className="share-page">
      <PageHeader
        variant="hidden"
        title={t("share.title", "Paylaşılan konum")}
        titleText={t("share.title", "Paylaşılan konum")}
      />
      <div ref={mapRef} className="share-map" role="region" aria-label={t("share.map", "Harita")} />

      {!lookupOpen && (
        <div className="share-toolbar">
          <Button
            variant="secondary"
            onClick={() => setLookupOpen(true)}
            iconStart={<Icon name="search" size={16} />}
          >
            {t("share.newCode", "Yeni kod gir")}
          </Button>
        </div>
      )}

      {mapError && (
        <div className="share-map-error">
          <Alert tone="warning">
            {t(
              "share.mapError",
              "Harita yüklenemedi. Kodla adres sorgulamasını yine kullanabilirsin.",
            )}
          </Alert>
        </div>
      )}

      {lookupOpen && (
        // Yüzen cam kod kartı (Increment 3.7, R13): harita üstünde, data-surface="inverse".
        // Hatalı kodda kart sallanır (yalnız no-preference); Esc bulunan konuma geri döner.
        <section
          ref={panelRef}
          className="share-lookup"
          data-surface="inverse"
          aria-labelledby="share-lookup-title"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.classList.remove("ui-shake");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && share) setLookupOpen(false);
          }}
        >
          <div className="share-lookup__head">
            <span className="share-lookup__icon" aria-hidden="true">
              <Icon name="key" size={20} />
            </span>
            <div>
              <h2 id="share-lookup-title" className="share-lookup__title">
                {t("share.lookup.title", "Paylaşım kodu")}
              </h2>
              <p className="share-lookup__body">
                {t(
                  "share.lookup.body",
                  "Sana gönderilen kodu gir; süresi dolmamış ve onaylanmışsa konum haritada açılır. Görüntülemek için hesap gerekmez.",
                )}
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="share-form" noValidate data-surface="default">
            <Field label={t("share.lookup.label", "Paylaşım kodu")} error={fieldError} required>
              {(ids) => (
                <Input
                  {...ids}
                  ref={codeRef}
                  size="lg"
                  iconStart="key"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={80}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (fieldError && readShareCode(normalizeShareCode(e.target.value)))
                      setFieldError(null);
                  }}
                />
              )}
            </Field>
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              loadingLabel={t("share.lookup.loading", "Konum aranıyor…")}
              iconEnd={<Icon name="arrow" size={20} />}
            >
              {t("share.lookup.submit", "Konumu göster")}
            </Button>
            {error && (
              <Alert tone="danger" live="assertive">
                {error}
              </Alert>
            )}
            {share && (
              <Button variant="ghost" fullWidth onClick={() => setLookupOpen(false)}>
                {t("share.lookup.back", "Bulunan konuma dön")}
              </Button>
            )}
          </form>
        </section>
      )}

      {loading && !lookupOpen && (
        <p className="share-status" role="status" data-surface="default">
          {t("share.lookup.loading", "Konum aranıyor…")}
        </p>
      )}

      {share && !lookupOpen && (
        <Card className="share-found" padding="lg">
          <div className="share-found__head">
            <Badge tone="success">{t("share.found.badge", "Paylaşılan konum")}</Badge>
            <span className="share-found__code">
              {t("share.found.code", "Kod")}: {share.code}
            </span>
          </div>
          <p className="share-found__address">{share.address}</p>
          <p className="share-found__coords">
            {share.lat.toFixed(5)}, {share.lng.toFixed(5)}
          </p>
          <div className="share-found__nav">
            <Button
              href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              iconEnd={<Icon name="external" size={16} />}
            >
              {t("share.nav.google", "Google Haritalar")}
            </Button>
            <Button
              href={`https://maps.apple.com/?daddr=${dest}`}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              iconEnd={<Icon name="external" size={16} />}
            >
              {t("share.nav.apple", "Apple Haritalar")}
            </Button>
            <Button
              href={`https://yandex.com.tr/harita/?rtext=~${dest}&rtt=auto`}
              target="_blank"
              rel="noreferrer"
              variant="secondary"
              iconEnd={<Icon name="external" size={16} />}
            >
              {t("share.nav.yandex", "Yandex Navigasyon")}
            </Button>
          </div>
          <div className="share-found__copy">
            <CopyRouteButton
              title={share.address}
              stops={stops}
              next={`/k/?code=${encodeURIComponent(share.code)}`}
              variant="primary"
              fullWidth
            />
          </div>
        </Card>
      )}
    </PageShell>
  );
}
