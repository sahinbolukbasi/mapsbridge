"use client";
// Durak ayrıntısındaki "Yer bilgisi" (Increment 1.7, bug 3, P5). Yalnız pin bir yer kaydına
// bağlıysa (proxy aramasından eklenmiş: placeId+provider ya da googlePlaceId) yer proxy'sinden
// ayrıntı ister. Yalnız dönen alanlar çizilir (I1/I10): saat/puan/telefon yoksa satır yok.
// Google kaynaklıysa GoogleLogo atfı görünür; yorumlar yalnız "Yorumları göster" ile istenir.
import { useEffect, useState } from "react";
import { useLocale } from "../../lib/locale-context";
import type { Pin } from "../../lib/trip/models";
import { pinPopupModel, showsGoogleAttribution } from "../../lib/trip/pin-popup";
import { placesApi, type ApiPlace, type PlaceProvider } from "../../lib/trip/places-api";
import { Button, GoogleLogo, Icon, Media, Skeleton } from "../ui";

/** Pinin yer kaynağı; yoksa null (ayrıntı istenmez, alan uydurulmaz). */
export function placeRefOf(pin: Pin): { id: string; provider: PlaceProvider } | null {
  if (pin.placeId && (pin.placeProvider === "amazon" || pin.placeProvider === "google"))
    return { id: pin.placeId, provider: pin.placeProvider };
  if (pin.googlePlaceId) return { id: pin.googlePlaceId, provider: "google" };
  return null;
}

export function PlaceFacts({ pin }: { pin: Pin }) {
  const { t, locale } = useLocale();
  const ref = placeRefOf(pin);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [detail, setDetail] = useState<ApiPlace | null>(null);
  const [reviews, setReviews] = useState<"hidden" | "loading" | "shown" | "error">("hidden");
  const lang = locale === "en" ? "en" : "tr";

  const load = (withReviews = false) => {
    if (!ref) return;
    if (withReviews) setReviews("loading");
    else setState("loading");
    placesApi
      .detail(ref.id, ref.provider, { reviews: withReviews, lang })
      .then(({ places }) => {
        setDetail(places[0] ?? null);
        if (withReviews) setReviews("shown");
        else setState("ok");
      })
      .catch(() => {
        if (withReviews) setReviews("error");
        else setState("error");
      });
  };
  useEffect(() => {
    setDetail(null);
    setReviews("hidden");
    setState("idle");
    if (ref) load(false);
  }, [pin.id, ref?.id]);

  if (!ref) return null;
  if (state === "loading")
    return (
      <section className="planner-detail__section" aria-busy="true">
        <Skeleton lines={3} />
      </section>
    );
  if (state === "error")
    return (
      <section className="planner-detail__section">
        <p className="planner-detail__muted" role="status">
          {t("planner.facts.failed", "Yer bilgisi şu an alınamadı.")}{" "}
          <Button size="sm" variant="link" onClick={() => load(false)}>
            {t("ui.retry", "Tekrar dene")}
          </Button>
        </p>
      </section>
    );
  if (state !== "ok" || !detail) return null;
  const m = pinPopupModel(pin, detail);
  const hasFacts = m.openingHours || m.phone || m.website || m.rating !== undefined;
  const google = showsGoogleAttribution(m);
  return (
    <section className="planner-detail__section" aria-labelledby="planner-detail-facts">
      <h4 id="planner-detail-facts" className="planner-detail__title">
        {t("planner.facts.title", "Yer bilgisi")}
      </h4>
      {m.photos && m.photos.length > 0 && (
        <ul className="planner-facts__photos" aria-label={t("planner.facts.photos", "Fotoğraflar")}>
          {m.photos.map((photo, i) => (
            <li key={photo.url} className="planner-facts__photo">
              <Media
                src={photo.url}
                ratio="4/3"
                alt={
                  photo.attribution
                    ? t("planner.facts.photoAltBy", "{name} fotoğrafı: {author}")
                        .replace("{name}", m.title)
                        .replace("{author}", photo.attribution)
                    : t("planner.facts.photoAlt", "{name} fotoğrafı {n}")
                        .replace("{name}", m.title)
                        .replace("{n}", String(i + 1))
                }
              />
              {photo.attribution && (
                <span className="planner-facts__photo-credit">{photo.attribution}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasFacts ? (
        <dl className="planner-facts">
          {m.rating !== undefined && (
            <div className="planner-facts__row">
              <dt>{t("planner.facts.rating", "Puan")}</dt>
              <dd>
                {m.rating.toLocaleString(lang === "en" ? "en-GB" : "tr-TR", {
                  maximumFractionDigits: 1,
                })}{" "}
                / 5
                {m.userRatingCount !== undefined &&
                  ` · ${t("planner.facts.ratingCount", "{n} değerlendirme").replace(
                    "{n}",
                    m.userRatingCount.toLocaleString(lang === "en" ? "en-GB" : "tr-TR"),
                  )}`}
              </dd>
            </div>
          )}
          {m.openingHours && (
            <div className="planner-facts__row">
              <dt>{t("planner.facts.hours", "Açılış saatleri")}</dt>
              <dd>
                <ul className="planner-facts__hours">
                  {m.openingHours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {m.phone && (
            <div className="planner-facts__row">
              <dt>{t("planner.facts.phone", "İletişim telefonu")}</dt>
              <dd>
                <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}>{m.phone}</a>
              </dd>
            </div>
          )}
          {m.website && (
            <div className="planner-facts__row">
              <dt>{t("planner.facts.website", "Web sitesi")}</dt>
              <dd>
                <a href={m.website} target="_blank" rel="noopener noreferrer">
                  {new URL(m.website).hostname}
                  <Icon name="external" size={16} />
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="planner-detail__muted">
          {t("planner.facts.none", "Kaynakta bu yer için ek bilgi yok.")}
        </p>
      )}
      {google && reviews === "hidden" && (
        <Button size="sm" variant="secondary" onClick={() => load(true)}>
          {t("planner.facts.showReviews", "Yorumları göster")}
        </Button>
      )}
      {reviews === "loading" && <Skeleton lines={2} />}
      {reviews === "error" && (
        <p className="planner-detail__muted" role="status">
          {t("planner.facts.reviewsFailed", "Yorumlar şu an alınamadı.")}
        </p>
      )}
      {reviews === "shown" && (
        <ul className="planner-facts__reviews">
          {(detail.reviews ?? []).map((r, i) => (
            <li key={i} className="planner-facts__review">
              <p className="planner-facts__review-head">
                {[r.author, r.rating !== undefined ? `${r.rating}/5` : null, r.time]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {r.text && <p className="planner-facts__review-text">{r.text}</p>}
            </li>
          ))}
          {(detail.reviews ?? []).length === 0 && (
            <li className="planner-detail__muted">
              {t("planner.facts.noReviews", "Kaynakta yorum yok.")}
            </li>
          )}
        </ul>
      )}
      {m.attribution && (
        <p className="planner-facts__attribution">
          {google && <GoogleLogo size={16} />}
          {t("planner.facts.source", "Kaynak: {name}").replace("{name}", m.attribution.text)}
        </p>
      )}
    </section>
  );
}
