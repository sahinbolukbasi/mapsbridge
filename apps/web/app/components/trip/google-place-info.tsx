"use client";
import { useEffect, useState } from "react";
import {
  googleMapsEnabled,
  googlePlace,
  searchGooglePlaces,
  safeGoogleLink,
} from "../../lib/google/maps-client";
import { interactionTracker } from "../../lib/analytics/tracker";

export function GooglePlaceInfo({
  placeId,
  label,
  lat,
  lng,
  onLink,
  activeTab = "info",
}: {
  placeId?: string;
  label: string;
  lat: number;
  lng: number;
  onLink: (id: string) => void;
  activeTab?: "info" | "reviews";
}) {
  const [place, setPlace] = useState<google.maps.places.Place>();
  const [candidates, setCandidates] = useState<google.maps.places.Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showHours, setShowHours] = useState(false);

  useEffect(() => {
    let active = true;
    setPlace(undefined);
    setCandidates([]);
    setError("");
    setShowAllReviews(false);
    setShowHours(false);

    if (!placeId || !googleMapsEnabled) return;

    setBusy(true);
    void googlePlace(placeId)
      .then((value) => {
        if (active && value) {
          setPlace(value);
          interactionTracker.logPlaceView({
            label: value.displayName || label,
            placeId: value.id,
            source: "map_pin",
          });
        }
      })
      .catch(() => {
        if (active) setError("Google mekan bilgileri alınamadı.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [placeId, label]);

  if (!googleMapsEnabled) return null;

  const link = safeGoogleLink(place?.googleMapsURI);

  // Build Google Maps directions URL
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${placeId || ""}&travelmode=walking`;

  return (
    <section className="gpi-block" aria-label="Google mekan bilgileri">
      {/* Header */}
      <div className="gpi-header">
        <div className="gpi-header-badge">
          <span className="material-symbols-outlined gpi-verified-icon">verified</span>
          <span>Google Maps Detayları</span>
        </div>
        <div className="gpi-header-links">
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="gpi-ext-link">
              <span className="material-symbols-outlined">open_in_new</span>
              <span>Google Maps</span>
            </a>
          )}
        </div>
      </div>

      {/* No placeId - Show match prompt */}
      {!placeId && (
        <div className="gpi-match-prompt">
          <p className="gpi-match-desc">
            Google fotoğraflarını, puanını ve çalışma saatlerini görmek için mekanı eşleştirin:
          </p>
          <button
            type="button"
            className="gpi-match-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const matches = await searchGooglePlaces(label, { lat, lng });
                setCandidates(matches || []);
                if (!matches || !matches.length) setError("Eşleşen Google mekanı bulunamadı.");
              } catch {
                setError("Mekanlar alınamadı.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <span className="material-symbols-outlined">search</span>
            Google'da Bu Mekanı Bul
          </button>

          {candidates.length > 0 && (
            <div className="gpi-candidates-list">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="gpi-candidate-card"
                  onClick={() => onLink(p.id)}
                >
                  <strong className="gpi-candidate-name">{p.displayName}</strong>
                  <span className="gpi-candidate-addr">{p.formattedAddress}</span>
                  <span className="gpi-candidate-cta">✓ Bu mekanla eşleştir</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading / Error States */}
      {busy && <p className="gpi-loading">Google bilgileri yükleniyor…</p>}
      {error && <p className="gpi-error">{error}</p>}

      {/* Place Details */}
      {place && activeTab === "info" && (
        <div className="gpi-details">
          {/* Rating & Status Row */}
          {place.rating != null && (
            <div className="gpi-rating-row">
              <span className="gpi-rating-badge">★ {place.rating.toFixed(1)}</span>
              <span className="gpi-rating-count">({place.userRatingCount || 0} değerlendirme)</span>
              {place.businessStatus === "CLOSED_PERMANENTLY" && (
                <span className="gpi-status-closed">Kalıcı Kapalı</span>
              )}
              {place.businessStatus === "CLOSED_TEMPORARILY" && (
                <span className="gpi-status-temp-closed">Geçici Kapalı</span>
              )}
            </div>
          )}

          {/* Photos Grid */}
          {place.photos && place.photos.length > 0 && (
            <div className="gpi-photos-grid">
              {place.photos.slice(0, 4).map((photo, i) => (
                <a
                  key={i}
                  href={safeGoogleLink(photo.googleMapsURI) || link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gpi-photo-card"
                >
                  <img
                    src={photo.getURI({ maxWidth: 400, maxHeight: 280 })}
                    alt={`${place.displayName || "Mekan"} ${i + 1}`}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="gpi-actions-row">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gpi-action-btn gpi-action-directions"
            >
              <span className="material-symbols-outlined">directions</span>
              <span>Yol Tarifi</span>
            </a>

            {place.nationalPhoneNumber && (
              <a
                href={`tel:${place.nationalPhoneNumber}`}
                className="gpi-action-btn gpi-action-call"
              >
                <span className="material-symbols-outlined">call</span>
                <span>Ara</span>
              </a>
            )}

            {safeGoogleLink(place.websiteURI) && (
              <a
                href={safeGoogleLink(place.websiteURI)}
                target="_blank"
                rel="noopener noreferrer"
                className="gpi-action-btn gpi-action-web"
              >
                <span className="material-symbols-outlined">language</span>
                <span>Web</span>
              </a>
            )}

            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="gpi-action-btn gpi-action-share"
              >
                <span className="material-symbols-outlined">share</span>
                <span>Paylaş</span>
              </a>
            )}
          </div>

          {/* Opening Hours */}
          {place.regularOpeningHours?.weekdayDescriptions?.length && (
            <div className="gpi-section-card">
              <button
                type="button"
                className="gpi-section-toggle"
                onClick={() => setShowHours(!showHours)}
                aria-expanded={showHours}
              >
                <div className="gpi-section-toggle-left">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>Çalışma Saatleri</span>
                </div>
                <span
                  className={`material-symbols-outlined gpi-chevron ${showHours ? "open" : ""}`}
                >
                  expand_more
                </span>
              </button>
              {showHours && (
                <div className="gpi-hours-list">
                  {place.regularOpeningHours.weekdayDescriptions.map((day) => (
                    <p key={day} className="gpi-hour-row">
                      {day}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Phone */}
          {place.nationalPhoneNumber && (
            <div className="gpi-info-chip">
              <span className="material-symbols-outlined">call</span>
              <a href={`tel:${place.nationalPhoneNumber}`} className="gpi-phone-link">
                {place.nationalPhoneNumber}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Reviews Tab */}
      {place && activeTab === "reviews" && (
        <div className="gpi-details">
          {place.reviews && place.reviews.length > 0 ? (
            <div className="gpi-section-card">
              <div className="gpi-section-toggle-left" style={{ padding: "0.5rem 0" }}>
                <span className="material-symbols-outlined">reviews</span>
                <span>Google Yorumları ({place.reviews.length})</span>
              </div>

              <div className="gpi-reviews-list">
                {(showAllReviews ? place.reviews : place.reviews.slice(0, 3)).map((review, i) => (
                  <div key={i} className="gpi-review-card">
                    <div className="gpi-review-header">
                      <span className="gpi-review-author">
                        {review.authorAttribution?.displayName || "Google Kullanıcısı"}
                      </span>
                      {review.rating != null && (
                        <span className="gpi-review-stars">★ {review.rating}</span>
                      )}
                    </div>
                    <p className="gpi-review-text">
                      {review.text?.slice(0, showAllReviews ? 500 : 200)}
                      {review.text && review.text.length > (showAllReviews ? 500 : 200) ? "…" : ""}
                    </p>
                  </div>
                ))}
              </div>

              {place.reviews.length > 3 && !showAllReviews && (
                <button
                  type="button"
                  className="gpi-show-more-btn"
                  onClick={() => setShowAllReviews(true)}
                >
                  Tüm Yorumları Gör ({place.reviews.length})
                </button>
              )}
            </div>
          ) : (
            <p className="gpi-loading">Bu mekan için henüz yorum bulunmuyor.</p>
          )}
        </div>
      )}
    </section>
  );
}
