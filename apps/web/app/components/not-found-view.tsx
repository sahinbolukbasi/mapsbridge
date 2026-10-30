"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./not-found-view.css";

interface NotFoundViewProps {
  isError?: boolean;
  errorCode?: string | number;
  errorMessage?: string;
  onRetry?: () => void;
}

export function NotFoundView({
  isError = false,
  errorCode = "404",
  errorMessage,
  onRetry,
}: NotFoundViewProps) {
  const [currentCoords, setCurrentCoords] = useState("LAT: 41.0082° N • LON: 28.9784° E");
  const [attemptedPath, setAttemptedPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path && path !== "/" && path !== "/404") {
        setAttemptedPath(path);
      }
    }
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lon = pos.coords.longitude.toFixed(4);
          const latDir = pos.coords.latitude >= 0 ? "N" : "S";
          const lonDir = pos.coords.longitude >= 0 ? "E" : "W";
          setCurrentCoords(
            `LAT: ${Math.abs(Number(lat))}° ${latDir} • LON: ${Math.abs(Number(lon))}° ${lonDir}`,
          );
        },
        () => {},
        { timeout: 4000 },
      );
    }
  }, []);

  return (
    <div className="not-found-page-wrapper not-found-topography">
      {/* Main 404 Hero Section */}
      <main className="not-found-main">
        <div className="not-found-content-box">
          {/* Status Badge */}
          <div className="not-found-badge">
            <span className="material-symbols-outlined">{isError ? "warning" : "explore_off"}</span>
            <span>
              {isError ? "SİSTEM UYARISI • BAĞLANTI KESİNTİSİ" : "404 • ROTA DIŞINA ÇIKILDI"}
            </span>
          </div>

          {/* Attempted path pill */}
          {attemptedPath && (
            <div className="not-found-path-pill">
              <span className="material-symbols-outlined">link_off</span>
              <code>{attemptedPath}</code>
              <span className="not-found-path-status">bulunamadı</span>
            </div>
          )}

          {/* Centerpiece Map/Coordinates Graphic & Giant Typography */}
          <div className="not-found-graphic-container">
            <div className="not-found-number-wrapper">
              <span className="not-found-giant-number">{errorCode}</span>

              {/* Overlaying Route Path SVG */}
              <div className="not-found-svg-overlay">
                <div className="not-found-svg-box">
                  <svg viewBox="0 0 280 130" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Animated Dashed Emerald Route Line */}
                    <path
                      d="M10 95 C 65 125, 90 20, 140 60 C 180 85, 210 25, 270 45"
                      stroke="#10B981"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      className="not-found-route-path"
                    />
                    {/* Outer Pulsing Beacon */}
                    <circle
                      cx="140"
                      cy="60"
                      r="16"
                      fill="#ba1a1a"
                      fillOpacity="0.2"
                      className="not-found-ping-circle"
                    />
                    {/* Middle Point Target Circle */}
                    <circle
                      cx="140"
                      cy="60"
                      r="9"
                      fill="#faf8ff"
                      stroke="#ba1a1a"
                      strokeWidth="2.5"
                    />
                    <circle cx="140" cy="60" r="3.5" fill="#ba1a1a" />
                    {/* X Target Miss Marker */}
                    <path
                      d="M134 54 L146 66 M146 54 L134 66"
                      stroke="#ba1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Floating Coordinate Pill Card */}
            <div className="not-found-coord-card">
              <div className="not-found-coord-icon-box">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  explore
                </span>
              </div>
              <div className="not-found-coord-info">
                <div className="not-found-coord-label">Son Bilinen Koordinat</div>
                <div className="not-found-coord-value">
                  <span>{currentCoords}</span>
                  <span className="not-found-signal-badge">
                    {isError ? "Bağlantı Hatası" : "Sinyal Yok"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="not-found-text-block">
            <h1 className="not-found-title">
              {isError
                ? "Rotada Beklenmedik Bir Sinyal Kesintisi Oluştu"
                : "Aradığınız Durak Haritada Bulunamadı"}
            </h1>
            <p className="not-found-desc">
              {errorMessage ||
                (isError
                  ? "Sistem verilerine ulaşılırken geçici bir aksaklık meydana geldi. Sayfayı yenileyebilir veya rotanızı ana sayfadan yeniden başlatabilirsiniz."
                  : "Görünüşe göre rotanızdan saptınız veya aradığınız sayfa başka bir koordinata taşınmış olabilir. Endişelenmeyin, sizi güvenle ana rotaya geri döndürebiliriz.")}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="not-found-actions">
            {isError && onRetry ? (
              <button type="button" className="not-found-btn-primary" onClick={onRetry}>
                <span className="material-symbols-outlined">refresh</span>
                <span>Tekrar Dene</span>
              </button>
            ) : (
              <Link href="/" className="not-found-btn-primary" prefetch={false}>
                <span className="material-symbols-outlined">home</span>
                <span>Ana Sayfaya Dön</span>
              </Link>
            )}

            <Link href="/ai/" className="not-found-btn-secondary" prefetch={false}>
              <span
                className="material-symbols-outlined"
                style={{ color: "#10b981", fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span>AI Asistan ile Yeni Rota</span>
            </Link>
          </div>

          {/* Secondary Explorer Hub / Popular Coordinates */}
          <div className="not-found-destinations">
            <div className="not-found-destinations-header">
              <div className="not-found-destinations-title-wrap">
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "22px" }}
                >
                  near_me
                </span>
                <h2 className="not-found-destinations-title">Popüler Koordinatlara Göz Atın</h2>
              </div>
              <span className="not-found-destinations-subtitle">
                Güvenli ve aktif yönlendirmeler
              </span>
            </div>

            <div className="not-found-cards-grid">
              {/* Card 1: Harita Masası */}
              <Link href="/maps/" className="not-found-card" prefetch={false}>
                <div>
                  <div className="not-found-card-icon">
                    <span className="material-symbols-outlined">map</span>
                  </div>
                  <div className="not-found-card-head">
                    <h3 className="not-found-card-name">Harita</h3>
                    <span className="not-found-card-path">/desk/</span>
                  </div>
                  <p className="not-found-card-desc">
                    Canlı harita ve durak planlama çalışma alanı ile rotanızı anında çizin.
                  </p>
                </div>
                <div className="not-found-card-foot">
                  <span>Masayı Aç</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    arrow_forward
                  </span>
                </div>
              </Link>

              {/* Card 2: AI Seyahat Asistanı */}
              <Link href="/ai/" className="not-found-card" prefetch={false}>
                <div>
                  <div className="not-found-card-icon">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      smart_toy
                    </span>
                  </div>
                  <div className="not-found-card-head">
                    <h3 className="not-found-card-name">AI Asistan</h3>
                    <span className="not-found-card-path">/ai/</span>
                  </div>
                  <p className="not-found-card-desc">
                    Kişiselleştirilmiş durak önerileri ve anında akıllı rota oluşturucu.
                  </p>
                </div>
                <div className="not-found-card-foot">
                  <span>Sohbet Başlat</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    arrow_forward
                  </span>
                </div>
              </Link>

              {/* Card 3: Gezginler Topluluğu */}
              <Link href="/community/" className="not-found-card" prefetch={false}>
                <div>
                  <div className="not-found-card-icon">
                    <span className="material-symbols-outlined">diversity_3</span>
                  </div>
                  <div className="not-found-card-head">
                    <h3 className="not-found-card-name">Topluluk</h3>
                    <span className="not-found-card-path">/topluluk/</span>
                  </div>
                  <p className="not-found-card-desc">
                    Diğer kâşiflerin paylaştığı onaylı rotalar ve popüler koordinat akışı.
                  </p>
                </div>
                <div className="not-found-card-foot">
                  <span>Keşfe Katıl</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    arrow_forward
                  </span>
                </div>
              </Link>

              {/* Card 4: Yardım & Destek */}
              <Link href="/support/" className="not-found-card" prefetch={false}>
                <div>
                  <div className="not-found-card-icon">
                    <span className="material-symbols-outlined">help_center</span>
                  </div>
                  <div className="not-found-card-head">
                    <h3 className="not-found-card-name">Yardım & Destek</h3>
                    <span className="not-found-card-path">/destek/</span>
                  </div>
                  <p className="not-found-card-desc">
                    Kayıp bağlantılar rehberi, SSS ve MapsBridge yol haritası kılavuzu.
                  </p>
                </div>
                <div className="not-found-card-foot">
                  <span>Çözümleri Gör</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    arrow_forward
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* GPS Node Status */}
          <div className="not-found-node-status">
            <span className="not-found-node-dot"></span>
            <span>MapsBridge Core GPS Node: v3.12-tr // Durum: Aktif</span>
          </div>
        </div>
      </main>
    </div>
  );
}
