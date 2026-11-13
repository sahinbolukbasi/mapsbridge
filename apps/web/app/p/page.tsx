"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { useLocale } from "../lib/locale-context";
import { decodePinCode, decodePinOrUrl, type PinPoint } from "../lib/share/pin-link";
import {
  buildDirections,
  defaultProvider,
  PROVIDERS,
  type LatLng,
  type MapProvider,
} from "../lib/share/map-directions";
import { normalizeShareCode } from "../lib/share/share-code";
import "./p.css";

type GeoState = "idle" | "asking" | "granted" | "denied";

/**
 * Durağa yol tarifi (D3): hesapsız açık, sunucusuz. `?c=<kod>` koddan {lat,lng,label} çözülür
 * (I1 gerçek koordinat; I12 istemci tarafı, ağ turu yok). Ziyaretçinin konumu istenir; izin
 * verilirse "buradan" rota, reddedilir/zaman aşımına uğrarsa yalnız-varış bağlantısı (zarif
 * düşüş). Kullanıcı sağlayıcıyı seçer; varsayılan işletim sistemine göre. TR varsayılan (I11).
 * Gerçek kullanım: yurt dışında taksiciye QR'ı okut ya da kodu söyle; şoför kendi haritasında
 * varışı ve rotayı görür.
 */
export default function PinDirectionsPage() {
  const { t } = useLocale();
  const codeRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pin, setPin] = useState<PinPoint | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [provider, setProvider] = useState<MapProvider>("google");

  // URL'den kodu çöz (kanonik `c` veya 6 haneli `code`). Geçersiz/eksikse kod giriş kartı açık kalır.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const decoded =
      decodePinOrUrl(window.location.search) ??
      decodePinCode(params.get("c")) ??
      decodePinCode(params.get("code"));
    const ua =
      typeof navigator !== "undefined"
        ? navigator.userAgent || (navigator as Navigator & { platform?: string }).platform
        : "";
    setProvider(defaultProvider(ua));
    if (decoded) {
      setPin(decoded);
      setCode(params.get("code") ?? params.get("c") ?? "");
      requestGeo();
    } else if (params.get("c") || params.get("code")) {
      setFieldError(
        t(
          "p.error.code",
          "Kod hatalı: Girdiğiniz 6 haneli konum kodu geçersiz veya süresi dolmuş.",
        ),
      );
      codeRef.current?.focus({ preventScroll: true });
    } else {
      codeRef.current?.focus({ preventScroll: true });
    }
    // Yalnız ilk yüklemede (URL okuma + varsayılan sağlayıcı + geo isteği).
  }, []);

  // Hatalı kodda kart sallanır (yalnız no-preference; .ui-shake primitives katmanı).
  useEffect(() => {
    if (!fieldError) return;
    const el = panelRef.current;
    if (!el) return;
    el.classList.remove("ui-shake");
    void el.offsetWidth;
    el.classList.add("ui-shake");
  }, [fieldError]);

  function requestGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("denied");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo("granted");
      },
      () => {
        // Reddedildi/zaman aşımı/kullanılamıyor: yalnız-varış bağlantısına düş.
        setOrigin(null);
        setGeo("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\s+/g, "").slice(0, 6);
    const decoded = cleaned.length === 6 ? decodePinOrUrl(cleaned) : null;
    if (!decoded) {
      setFieldError(
        t(
          "p.error.code",
          "Kod hatalı: Girdiğiniz 6 haneli konum kodu geçersiz veya süresi dolmuş.",
        ),
      );
      codeRef.current?.focus();
      return;
    }
    setFieldError(null);
    setPin(decoded);
    requestGeo();
  }

  const coordLabel = pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "";

  return (
    <PageShell className="pin-page">
      <PageHeader
        variant="hidden"
        title={t("p.title", "Durağa yol tarifi")}
        titleText={t("p.title", "Durağa yol tarifi")}
      />

      {!pin ? (
        <section
          ref={panelRef}
          className="pin-lookup"
          data-surface="inverse"
          aria-labelledby="pin-lookup-title"
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.classList.remove("ui-shake");
          }}
        >
          <div className="pin-lookup__head">
            <span className="pin-lookup__icon" aria-hidden="true">
              <Icon name="map" size={20} />
            </span>
            <div>
              <h2 id="pin-lookup-title" className="pin-lookup__title">
                {t("p.lookup.title", "Durak kodu")}
              </h2>
              <p className="pin-lookup__body">
                {t(
                  "p.lookup.body",
                  "Sana verilen durak kodunu gir; varış noktası açılır ve bulunduğun konumdan yol tarifi başlatılır. Hesap gerekmez.",
                )}
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="pin-form" noValidate data-surface="default">
            {fieldError && (
              <Alert tone="danger" live="assertive">
                {fieldError}
              </Alert>
            )}
            <Field label={t("p.lookup.label", "Durak kodu")} error={fieldError} required>
              {(ids) => (
                <Input
                  {...ids}
                  ref={codeRef}
                  size="lg"
                  iconStart="map"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 6);
                    setCode(sanitized);
                    if (
                      fieldError &&
                      sanitized.length === 6 &&
                      decodePinCode(normalizeShareCode(sanitized))
                    )
                      setFieldError(null);
                  }}
                />
              )}
            </Field>
            <Button type="submit" fullWidth size="lg" iconEnd={<Icon name="arrow" size={20} />}>
              {t("p.lookup.submit", "Yol tarifini aç")}
            </Button>
          </form>
        </section>
      ) : (
        <div className="pin-view">
          <Card className="pin-dest" padding="lg">
            <div className="pin-dest__head">
              <Badge tone="success">{t("p.dest.badge", "Varış noktası")}</Badge>
            </div>
            <p className="pin-dest__label">{pin.label || t("p.dest.unnamed", "Seçilen durak")}</p>
            <p className="pin-dest__coords">{coordLabel}</p>

            <div className="pin-geo" role="status">
              {geo === "asking" && (
                <p className="pin-geo__line">
                  <Icon name="map" size={16} aria-hidden="true" />
                  {t("p.geo.asking", "Yol tarifini buradan başlatmak için konumun isteniyor…")}
                </p>
              )}
              {geo === "granted" && (
                <p className="pin-geo__line pin-geo__line--ok">
                  <Icon name="check" size={16} aria-hidden="true" />
                  {t("p.geo.granted", "Rota bulunduğun konumdan başlar.")}
                </p>
              )}
              {geo === "denied" && (
                <Alert tone="info">
                  {t(
                    "p.geo.denied",
                    "Konum alınamadı. Yol tarifi yalnızca varış noktasına açılır; başlangıç noktasını haritada seçebilirsin.",
                  )}
                </Alert>
              )}
            </div>

            <p className="pin-providers__hint">
              {t("p.providers.hint", "Yol tarifini açmak için harita uygulamanı seç:")}
            </p>
            <div className="pin-providers">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.id}
                  href={buildDirections({ dest: pin, origin, provider: p.id })}
                  target="_blank"
                  rel="noreferrer"
                  variant={p.id === provider ? "primary" : "secondary"}
                  iconEnd={<Icon name="external" size={16} />}
                >
                  {t(p.labelKey, p.fallback)}
                </Button>
              ))}
            </div>

            {geo === "denied" && (
              <div className="pin-dest__retry">
                <Button
                  variant="ghost"
                  size="sm"
                  iconStart={<Icon name="map" size={16} />}
                  onClick={requestGeo}
                >
                  {t("p.geo.retry", "Konumu yeniden dene")}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </PageShell>
  );
}
