"use client";

import React, { useState } from "react";
import Link from "next/link";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import "./harita.css";

export function HaritaClient() {
  const [activeDay, setActiveDay] = useState<number>(1);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const daysData = [
    {
      day: 1,
      name: "Tarihi Yarımada",
      dist: "5.2 km",
      time: "5s 56d",
      stopsCount: 4,
      stops: [
        {
          id: 1,
          name: "Sultanahmet Meydanı",
          time: "09:30",
          note: "Kalış: 45 dk • Fotoğraf & Tarih",
          walk: "~6 dk yürüme (420m) • Düz zemin",
        },
        {
          id: 2,
          name: "Ayasofya-i Kebîr",
          time: "10:40",
          note: "Müze Girişi (E-bilet #4829) • 75 dk",
          walk: "~4 dk yürüme (310m)",
        },
        {
          id: 3,
          name: "Yerebatan Sarnıcı",
          time: "12:10",
          note: "Kalış: 40 dk • Ses Rehberi Aktif",
          walk: "~8 dk yürüme (560m)",
        },
        {
          id: 4,
          name: "Gülhane Parkı & Hamdi",
          time: "13:30",
          note: "Öğle Yemeği & Manzara Molası • 90 dk",
          walk: "Günün Sonu",
        },
      ],
      elevation: { max: "58 m", gain: "+42m", grade: "%4.2 (Hafif)" },
    },
    {
      day: 2,
      name: "Galata & Beyoğlu",
      dist: "3.8 km",
      time: "4s 15d",
      stopsCount: 3,
      stops: [
        {
          id: 1,
          name: "Karaköy Sahil & Vapur",
          time: "10:00",
          note: "Kahve & Boğaz Esintisi • 30 dk",
          walk: "~5 dk yürüme (350m)",
        },
        {
          id: 2,
          name: "Galata Kulesi",
          time: "11:00",
          note: "Panoramik 360° Seyir • 60 dk",
          walk: "~10 dk yokuş yukarı (650m)",
        },
        {
          id: 3,
          name: "İstiklal Caddesi & Pera",
          time: "12:45",
          note: "Sanat Galerileri & Tarihi Pasajlar • 120 dk",
          walk: "Günün Sonu",
        },
      ],
      elevation: { max: "74 m", gain: "+65m", grade: "%7.5 (Orta Yokuş)" },
    },
    {
      day: 3,
      name: "Boğaziçi & Beşiktaş",
      dist: "6.1 km",
      time: "6s 20d",
      stopsCount: 4,
      stops: [
        {
          id: 1,
          name: "Dolmabahçe Sarayı",
          time: "09:30",
          note: "Rehberli Saray Turu • 90 dk",
          walk: "~12 dk sahil yürüyüşü (900m)",
        },
        {
          id: 2,
          name: "Akaretler Sıraevler",
          time: "11:30",
          note: "Tasarım Butikleri & Kahve • 45 dk",
          walk: "~8 dk yürüme (550m)",
        },
        {
          id: 3,
          name: "Yıldız Parkı Korusu",
          time: "13:00",
          note: "Doğa Yürüyüşü & Malta Köşkü • 75 dk",
          walk: "~15 dk yürüme (1.1 km)",
        },
        {
          id: 4,
          name: "Ortaköy Meydanı & Kumpir",
          time: "15:00",
          note: "Boğaz Manzarası ve Gün Batımı • 90 dk",
          walk: "Günün Sonu",
        },
      ],
      elevation: { max: "62 m", gain: "+50m", grade: "%5.1 (Hafif)" },
    },
    {
      day: 4,
      name: "Kadıköy & Moda",
      dist: "4.0 km",
      time: "4s 40d",
      stopsCount: 3,
      stops: [
        {
          id: 1,
          name: "Kadıköy Tarihi Çarşı",
          time: "10:30",
          note: "Gastronomi & Baharatçılar • 60 dk",
          walk: "~7 dk yürüme (480m)",
        },
        {
          id: 2,
          name: "Moda Caddesi & Çay Bahçesi",
          time: "12:00",
          note: "Deniz Kıyısı & Sakin Dinlenme • 80 dk",
          walk: "~10 dk yürüme (700m)",
        },
        {
          id: 3,
          name: "Fenerbahçe Parkı",
          time: "14:00",
          note: "Gün Batımı & Piknik • 90 dk",
          walk: "Günün Sonu",
        },
      ],
      elevation: { max: "28 m", gain: "+18m", grade: "%2.0 (Düz)" },
    },
  ];

  const currentDay = daysData[activeDay - 1] || daysData[0];

  const _toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="harita-page-container">
      <HeaderNav />

      <main className="harita-page-main">
        {/* SECTION 1: HERO */}
        <section className="harita-hero">
          <div className="harita-hero-glow-1" />
          <div className="harita-hero-glow-2" />

          <div className="harita-hero-inner">
            <div className="harita-eyebrow-pill">
              <span className="harita-live-dot" />
              <span className="harita-eyebrow-text">
                MAPSBRIDGE WORKSPACE • HARİTA MASASI KULLANIM KILAVUZU &amp; ÖZELLİKLER
              </span>
            </div>

            <h1 className="harita-hero-title">
              Büyük Ekranda Mimari Hassasiyetle Çiz,{" "}
              <span className="harita-hero-title-highlight">Duraklarını Özgürce Yönet.</span>
            </h1>

            <p className="harita-hero-desc">
              Karmaşık Excel tabloları, onlarca açık tarayıcı sekmesi ve kaybolan dağınık notlar
              geride kaldı. MapsBridge Harita Masası; çoklu gün katmanları, akıllı durak havuzu ve
              topografik irtifa analizleriyle seyahatinizi bir mimar titizliğiyle haritalandırır.
            </p>

            <div className="harita-hero-actions">
              <Link href="/maps/" className="btn-harita-primary" prefetch={false}>
                <span>Harita Masasını Aç (Giriş Yapmadan Dene)</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  arrow_forward
                </span>
              </Link>
              <a href="#canli-anatomi" className="btn-harita-secondary">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px", color: "#286954" }}
                >
                  map
                </span>
                <span>Örnek Rotayı İncele (İstanbul Keşfi - RM-841)</span>
              </a>
            </div>

            <div className="harita-telemetry-strip">
              <div className="telemetry-chip">
                <span className="material-symbols-outlined">layers</span>
                <span>5 Gün Katmanı Desteği</span>
              </div>
              <div className="telemetry-chip">
                <span className="material-symbols-outlined">drag_indicator</span>
                <span>Sürükle-Bırak Durak Havuzu</span>
              </div>
              <div className="telemetry-chip">
                <span className="material-symbols-outlined">show_chart</span>
                <span>Topografik İrtifa &amp; Eğim Analizi</span>
              </div>
              <div className="telemetry-chip">
                <span className="material-symbols-outlined">phonelink_ring</span>
                <span>Sıfır Kablo Telefona Senkron</span>
              </div>
              <div className="telemetry-chip">
                <span className="material-symbols-outlined">file_download</span>
                <span>GPX / KML / Google Maps Dışa Aktar</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: INTERACTIVE LIVE MAP DESK ANATOMY SHOWCASE */}
        <section className="harita-anatomy-section" id="canli-anatomi">
          <div className="harita-anatomy-inner">
            <div className="harita-anatomy-header">
              <div>
                <span className="harita-anatomy-label">ÇALIŞMA ALANI ANATOMİSİ</span>
                <h2 className="harita-anatomy-title">Harita Masası Çalışma Alanı Arayüzü</h2>
              </div>
              <p className="harita-anatomy-desc">
                Aşağıdaki interaktif tuval, gerçek MapsBridge panelinin mimari bileşenlerini
                gösterir. Gün sekmelerini değiştirerek rota katmanlarını canlı deneyimleyin.
              </p>
            </div>

            {/* Simulated Desktop Window Frame */}
            <div className="desk-frame">
              {/* Window Header */}
              <div className="desk-window-bar">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="window-dots">
                    <span className="window-dot dot-red" />
                    <span className="window-dot dot-amber" />
                    <span className="window-dot dot-green" />
                  </div>
                  <span className="window-url">mapsbridge.app/desk/istanbul-rm841</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="window-status-pill">ÇEVRİMİÇİ • SENKRONİZE</span>
                  <span style={{ fontSize: "11px", color: "#dae2fd" }}>Ölçek 1:15.000</span>
                </div>
              </div>

              {/* Desk Split Canvas Grid */}
              <div className="desk-canvas-grid">
                {/* Left Sidebar */}
                <div className="desk-sidebar">
                  <div className="anatomy-marker-badge" title="[01] Plan Katmanları">
                    01
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#717974" }}>
                        PLAN KATMANLARI (4 GÜN)
                      </span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#286954" }}>
                        Toplam 14 Durak
                      </span>
                    </div>

                    {/* Day Tabs */}
                    <div className="day-tabs-grid">
                      {daysData.map((d) => (
                        <button
                          key={d.day}
                          type="button"
                          className={`day-tab-btn ${activeDay === d.day ? "active" : ""}`}
                          onClick={() => setActiveDay(d.day)}
                        >
                          <span
                            className="day-dot"
                            style={{
                              background:
                                d.day === 1
                                  ? "#10b981"
                                  : d.day === 2
                                    ? "#3b82f6"
                                    : d.day === 3
                                      ? "#f59e0b"
                                      : "#ef4444",
                            }}
                          />
                          <span className="day-tab-name">{d.day}. Gün</span>
                          <span className="day-tab-dist">{d.dist}</span>
                        </button>
                      ))}
                    </div>

                    {/* Current Day Info */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        background: "#f1f5f9",
                        borderRadius: "6px",
                        marginBottom: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {activeDay}. Gün: {currentDay.name}
                      </span>
                      <span style={{ color: "#286954" }}>
                        {currentDay.time} • {currentDay.stopsCount} Durak
                      </span>
                    </div>

                    {/* Stops List */}
                    <div style={{ position: "relative" }}>
                      <div
                        className="anatomy-marker-badge"
                        style={{
                          top: "0px",
                          left: "-10px",
                          width: "22px",
                          height: "22px",
                          fontSize: "10px",
                        }}
                        title="[02] Durak Listesi"
                      >
                        02
                      </div>
                      {currentDay.stops.map((stop, idx) => (
                        <div key={stop.id}>
                          <div className="stop-item-card">
                            <div className="stop-item-top">
                              <span className="stop-item-name">
                                {idx + 1}. {stop.name}
                              </span>
                              <span className="stop-item-time">{stop.time}</span>
                            </div>
                            <div className="stop-item-meta">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "13px", color: "#10b981" }}
                              >
                                schedule
                              </span>
                              <span>{stop.note}</span>
                            </div>
                          </div>
                          {idx < currentDay.stops.length - 1 && (
                            <div className="stop-walk-connector">
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: "12px", color: "#10b981" }}
                              >
                                directions_walk
                              </span>
                              <span>{stop.walk}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pin Pool Drawer */}
                  <div className="pool-drawer-box">
                    <div
                      className="anatomy-marker-badge"
                      style={{
                        top: "-6px",
                        left: "-6px",
                        width: "22px",
                        height: "22px",
                        fontSize: "10px",
                      }}
                      title="[03] Durak Havuzu"
                    >
                      03
                    </div>
                    <div className="pool-drawer-title">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#013628",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "15px", color: "#286954" }}
                        >
                          inbox
                        </span>
                        <span>DURAK HAVUZU (PİN POOL)</span>
                      </div>
                      <span style={{ fontSize: "10px", color: "#717974" }}>3 Bekleyen</span>
                    </div>
                    <div className="pool-chips-row">
                      <span className="pool-chip">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px", color: "#286954" }}
                        >
                          drag_handle
                        </span>
                        Galata Kulesi
                      </span>
                      <span className="pool-chip">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px", color: "#286954" }}
                        >
                          drag_handle
                        </span>
                        Karaköy Güllüoğlu
                      </span>
                      <span className="pool-chip">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "12px", color: "#286954" }}
                        >
                          drag_handle
                        </span>
                        Mandabatmaz Kahvesi
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Main Canvas & Elevation */}
                <div className="desk-main-canvas">
                  <div style={{ position: "relative" }}>
                    <div
                      className="anatomy-marker-badge"
                      style={{ top: "8px", left: "8px" }}
                      title="[04] Vektörel Harita Tuvali"
                    >
                      04
                    </div>

                    {/* Canvas Viewport */}
                    <div className="canvas-viewport">
                      <div className="canvas-map-image">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7CTnbwW9iKHyp33pl3lZHeqJovoXMaiUy2od-YdGB30SXS111zDXEbjBjJi-m0njRxXe0RTEEUDLO07HZjHlFCJoW2OrFfumxUfspkYG4VFxvC91tTCr-bguzzQoNT8WS6_CLv0FJ9dFBVyqXUDLaGDQ8gs1rQuyvRlIIw8tqgvnXLvUulelm-USJLZ0SU8o-EVml0ffmzXi3R-TPOywEziZhkqbcD-NA7-brLUma0Ln5hhz2vrR8Qg"
                          alt="İstanbul harita masası önizlemesi"
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>

                      {/* Map HUD Controls */}
                      <div className="canvas-hud-controls">
                        <button type="button" className="hud-btn" title="Katmanlar">
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            layers
                          </span>
                        </button>
                        <button type="button" className="hud-btn" title="Yakınlaştır">
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            add
                          </span>
                        </button>
                        <button type="button" className="hud-btn" title="Uzaklaştır">
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            remove
                          </span>
                        </button>
                        <button type="button" className="hud-btn" title="Pusula">
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            explore
                          </span>
                        </button>
                      </div>

                      {/* Dynamic Simulated Pins */}
                      <div className="canvas-pin" style={{ top: "35%", left: "28%" }}>
                        <div className="pin-label-pill">
                          1. {currentDay.stops[0]?.name || "Başlangıç"}
                        </div>
                        <div className="pin-arrow" />
                      </div>
                      <div className="canvas-pin" style={{ bottom: "32%", right: "32%" }}>
                        <div className="pin-label-pill" style={{ background: "#286954" }}>
                          2. {currentDay.stops[1]?.name || "Durak"}
                        </div>
                        <div className="pin-arrow" style={{ background: "#286954" }} />
                      </div>

                      {/* Vector Route Line */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                        }}
                        viewBox="0 0 600 360"
                      >
                        <path
                          d="M 160 140 Q 280 180 380 230 T 490 280"
                          stroke="#10b981"
                          strokeDasharray="8 6"
                          strokeLinecap="round"
                          strokeWidth="4"
                        />
                        <circle
                          cx="160"
                          cy="140"
                          fill="#013628"
                          r="6"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <circle
                          cx="380"
                          cy="230"
                          fill="#286954"
                          r="6"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <circle
                          cx="490"
                          cy="280"
                          fill="#10b981"
                          r="6"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </svg>

                      {/* Coordinates Rose */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "10px",
                          left: "10px",
                          background: "rgba(255,255,255,0.9)",
                          backdropFilter: "blur(4px)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#013628",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "#286954" }}
                        >
                          near_me
                        </span>
                        <span>41.0082° K, 28.9784° D • İstanbul</span>
                      </div>
                    </div>
                  </div>

                  {/* Altitude Profile Card */}
                  <div className="altitude-card">
                    <div
                      className="anatomy-marker-badge"
                      style={{
                        top: "-6px",
                        left: "-6px",
                        width: "22px",
                        height: "22px",
                        fontSize: "10px",
                      }}
                      title="[05] Eşyükselti Grafiği"
                    >
                      05
                    </div>
                    <div className="altitude-card-header">
                      <div className="altitude-card-title">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", color: "#286954" }}
                        >
                          altitude
                        </span>
                        <span>TOPOGRAFİK İRTİFA PROFİLİ ({currentDay.day}. GÜN)</span>
                      </div>
                      <div className="altitude-stats">
                        <span>
                          Maks: <strong>{currentDay.elevation.max}</strong>
                        </span>
                        <span style={{ color: "#286954", fontWeight: 700 }}>
                          Kazanç: {currentDay.elevation.gain}
                        </span>
                        <span>Eğim: {currentDay.elevation.grade}</span>
                      </div>
                    </div>

                    <div className="altitude-chart-box">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 600 64"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="altGrad2" x1="0%" x2="0%" y1="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <polygon
                          fill="url(#altGrad2)"
                          points="0,64 0,48 100,42 220,52 340,24 450,30 520,18 600,38 600,64"
                        />
                        <polyline
                          fill="none"
                          points="0,48 100,42 220,52 340,24 450,30 520,18 600,38"
                          stroke="#286954"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                        <circle cx="100" cy="42" fill="#013628" r="3.5" />
                        <circle cx="340" cy="24" fill="#013628" r="3.5" />
                        <circle cx="520" cy="18" fill="#013628" r="3.5" />
                      </svg>
                      <div className="altitude-axis">
                        <span>0 km ({currentDay.stops[0]?.name || "Başlangıç"})</span>
                        <span>
                          {currentDay.dist} (
                          {currentDay.stops[currentDay.stops.length - 1]?.name || "Varış"})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Anatomy Explainer Pills Below Frame */}
              <div className="anatomy-legend-grid">
                <div className="legend-pill-box">
                  <span className="legend-tag">[01] Sol Panel &amp; Sekmeler</span>
                  <p className="legend-desc">
                    Her güne özel renk katmanı, toplam kilometre ve süre göstergeleri.
                  </p>
                </div>
                <div className="legend-pill-box">
                  <span className="legend-tag">[02] Durak Listesi</span>
                  <p className="legend-desc">
                    Varış saatleri, kalış süreleri ve aradaki yürüme süreleri dakikasıyla.
                  </p>
                </div>
                <div className="legend-pill-box">
                  <span className="legend-tag">[03] Durak Havuzu</span>
                  <p className="legend-desc">
                    Henüz güne atanmamış fikirleri saklayan serbest sürükle-bırak çekmecesi.
                  </p>
                </div>
                <div className="legend-pill-box">
                  <span className="legend-tag">[04] Vektörel Tuval</span>
                  <p className="legend-desc">
                    Canlı rota çizgileri, özel pinler ve 1:15.000 hassas ölçekli sokak haritası.
                  </p>
                </div>
                <div className="legend-pill-box">
                  <span className="legend-tag">[05] İrtifa Grafiği</span>
                  <p className="legend-desc">
                    Yokuş ve dik merdivenleri önceden gösteren dinamik eşyükselti analizi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: 6 CORE CAPABILITIES */}
        <section className="harita-capabilities-section">
          <div className="harita-cap-inner">
            <div className="cap-header">
              <span className="cap-tag">MİMARİ ARAÇLAR</span>
              <h2 className="cap-title">Harita Masası Neler Sunar?</h2>
              <p className="cap-desc">
                Geleneksel haritaların sunamadığı çok katmanlı düzenleme, irtifa simülasyonu ve
                serbest keşif modülleri tek bir akıcı ekranda toplandı.
              </p>
            </div>

            <div className="cap-cards-grid">
              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      inbox
                    </span>
                  </div>
                  <span className="cap-card-sub">SERBEST PLANLAMA</span>
                  <h3 className="cap-card-h">Akıllı Durak Havuzu (Pin Pool)</h3>
                  <p className="cap-card-p">
                    İnternette veya Instagram'da gördüğünüz mekanları kaydetmek için seyahat gününü
                    bilmenize gerek yok. Havuza atın; masaya oturduğunuzda dilediğiniz güne tek
                    tıkla veya sürükleyerek dahil edin.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>Günsüz serbest notlandırma</span>
                </div>
              </div>

              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      palette
                    </span>
                  </div>
                  <span className="cap-card-sub">GÖRSEL AYRIŞTIRMA</span>
                  <h3 className="cap-card-h">Çoklu Gün Katmanları &amp; Renk Kodlama</h3>
                  <p className="cap-card-p">
                    Her günü farklı renkle ayrıştırın. 1. Gün Zümrüt Yeşili, 2. Gün Gece Mavisi...
                    Haritayı tek bakışta anlayın, hangi mahallede ne kadar zaman geçireceğinizi
                    milimetrik planlayın.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>Ayrı ayrı gizle / göster katmanları</span>
                </div>
              </div>

              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      landscape
                    </span>
                  </div>
                  <span className="cap-card-sub">FİZİKSEL EFOR KONTROLÜ</span>
                  <h3 className="cap-card-h">Topografik İrtifa &amp; Eğim Simülatörü</h3>
                  <p className="cap-card-p">
                    Lizbon, Roma veya Edinburgh sokaklarında beklenmedik dik merdivenlerle sürpriz
                    yaşamayın. Yürüme rotanızın eğim profilini öncesinde görün, en az yorucu yönü
                    seçin.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>Merdiven &amp; yokuş uyarısı</span>
                </div>
              </div>

              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      sticky_note_2
                    </span>
                  </div>
                  <span className="cap-card-sub">ZENGİN METADATA</span>
                  <h3 className="cap-card-h">Durak Notları, Biletler &amp; Saatler</h3>
                  <p className="cap-card-p">
                    Müzelerin son giriş saatleri, rezervasyon kodları, önerilen yerel menü
                    tavsiyeleri ('Trattoria da Enzo'da Cacio e Pepe deneyin') her durağın kendi
                    kartında güvenle saklanır.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>PDF &amp; rezervasyon iliştirme imkanı</span>
                </div>
              </div>

              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      alt_route
                    </span>
                  </div>
                  <span className="cap-card-sub">AKILLI ALGORİTMA</span>
                  <h3 className="cap-card-h">Sıfır Çapraz Geçiş Optimizasyonu</h3>
                  <p className="cap-card-p">
                    Durakları rastgele ekleseniz bile akıllı optimizasyon butonu yürüme sıralamasını
                    baştan düzenler; şehirde zikzak çizmeden en mantıklı sıralamayla gezmenizi
                    sağlar.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>%35'e varan yürüme tasarrufu</span>
                </div>
              </div>

              <div className="cap-card">
                <div>
                  <div className="cap-card-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      sync_alt
                    </span>
                  </div>
                  <span className="cap-card-sub">TAM UYUMLULUK</span>
                  <h3 className="cap-card-h">Çok Formatlı Dışa Aktarım</h3>
                  <p className="cap-card-p">
                    Hazırladığınız rotayı doğrudan Google Maps listelerinize aktarın, akıllı
                    saatinize yüklemek için GPX/KML indirin veya MapsBridge Saha Modu ile tek kodla
                    telefona yansıtın.
                  </p>
                </div>
                <div className="cap-card-bottom">
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    check_circle
                  </span>
                  <span>Google Maps, GPX, KML &amp; GeoJSON</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: STEP BY STEP GUIDE */}
        <section className="harita-guide-section">
          <div className="harita-guide-inner">
            <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <span className="cap-tag">ADIM ADIM REHBER</span>
              <h2 className="cap-title">Harita Masası Nasıl Kullanılır?</h2>
              <p className="cap-desc">
                Fikirden sahaya adım adım rotanızı kurgulayın. Karmaşık menüler olmadan, 4 sade
                aşamada kusursuz bir gezi haritası oluşturun.
              </p>
            </div>

            <div className="guide-cards-grid">
              <div className="guide-step-card">
                <span className="guide-num-bg">01</span>
                <div>
                  <div className="guide-step-badge">1</div>
                  <h3 className="guide-step-h">Rota Oluştur veya AI'dan İçe Aktar</h3>
                  <p className="guide-step-p">
                    Sıfırdan şehir seçip başlayın ya da MapsBridge AI Asistanı'nın önerdiği özel
                    konsept planını tek tıkla Harita Masası'na indirin.
                  </p>
                </div>
                <span className="guide-step-tag">Süre: ~30 saniye</span>
              </div>

              <div className="guide-step-card">
                <span className="guide-num-bg">02</span>
                <div>
                  <div className="guide-step-badge">2</div>
                  <h3 className="guide-step-h">Durakları Belirle &amp; Havuzu Doldur</h3>
                  <p className="guide-step-p">
                    Arama çubuğundan mekan arayın veya haritada tıkladığınız yere "Noktayı Ekle"
                    deyin. Emin olmadıklarınızı Pin Pool havuzunda bekletin.
                  </p>
                </div>
                <span className="guide-step-tag">Sürükle-bırak destekli</span>
              </div>

              <div className="guide-step-card">
                <span className="guide-num-bg">03</span>
                <div>
                  <div className="guide-step-badge">3</div>
                  <h3 className="guide-step-h">Sıralamayı &amp; Zamanı İnce Ayarla</h3>
                  <p className="guide-step-p">
                    Kalış sürelerini girin. "Rotayı Optimize Et" butonuna basarak gereksiz adımları
                    eleyin ve alt paneldeki irtifa profilini gözden geçirin.
                  </p>
                </div>
                <span className="guide-step-tag">Yapay zeka rota sıralama</span>
              </div>

              <div className="guide-step-card">
                <span className="guide-num-bg">04</span>
                <div>
                  <div className="guide-step-badge">4</div>
                  <h3 className="guide-step-h">Sahaya Çık &amp; Arkadaşlarınla Paylaş</h3>
                  <p className="guide-step-p">
                    6 haneli paylaşım kodunu (
                    <span style={{ fontFamily: "monospace", color: "#286954" }}>#MB-8492</span>)
                    gezi arkadaşlarına gönderin veya mobil uygulamada anında açın.
                  </p>
                </div>
                <span className="guide-step-tag">Çevrimdışı saha modu</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: COMPARISON TABLE */}
        <section className="harita-compare-section">
          <div className="harita-compare-inner">
            <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto 3rem" }}>
              <span className="cap-tag">METODOLOJİ FARKI</span>
              <h2 className="cap-title">Klasik Haritalar vs. MapsBridge Harita Masası</h2>
              <p className="cap-desc">
                Neden geleneksel uygulamalarla günlerce uğraşmak yerine seyahat mimarisi için
                geliştirilmiş bir masaya oturmalısınız?
              </p>
            </div>

            <div className="compare-table-card">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Planlama Kriteri</th>
                    <th style={{ width: "20%", textAlign: "center" }}>Standart Google Maps</th>
                    <th style={{ width: "20%", textAlign: "center" }}>Not Defteri &amp; Excel</th>
                    <th className="col-brand" style={{ width: "20%" }}>
                      MapsBridge Harita Masası
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="crit-title">Gün bazlı katman ayrımı (Farklı renkler)</span>
                      <span className="crit-sub">
                        Her günün rotasını ayrı ayrı renklendirip inceleme
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td style={{ textAlign: "center", color: "#717974" }}>Yalnızca Metin</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="crit-title">
                        Durak havuzu &amp; serbest planlama (Pin Pool)
                      </span>
                      <span className="crit-sub">
                        Günsüz mekanları kenarda bekletip sonradan atama
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="crit-title">
                        Topografik irtifa &amp; yokuş merdiven grafiği
                      </span>
                      <span className="crit-sub">
                        Rotadaki dikey tırmanışları ve fiziksel zorluk seviyesini görme
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="crit-title">
                        Kalış süresi, bilet saatleri ve toplam gün hesabı
                      </span>
                      <span className="crit-sub">
                        Durak içi geçirilen vakti hesaba katan akıllı saat planlaması
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td style={{ textAlign: "center", color: "#717974" }}>Manuel Formül</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="crit-title">
                        Çevrimdışı saha senkronizasyonu (Mobil Saha Modu)
                      </span>
                      <span className="crit-sub">
                        Yurtdışında internet yokken harita ve notları eksiksiz çalıştırma
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#717974" }}>Kısmi (Büyük veri)</td>
                    <td style={{ textAlign: "center", color: "#717974" }}>Haritasız Metin</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="crit-title">
                        6 haneli gezi kodu ile anında arkadaş paylaşımı
                      </span>
                      <span className="crit-sub">
                        Uzun linkler olmadan tek kodla ortak rota yönetimi
                      </span>
                    </td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td style={{ textAlign: "center", color: "#ba1a1a" }}>✕</td>
                    <td className="col-brand">
                      <span
                        className="material-symbols-outlined"
                        style={{ color: "#10b981", fontSize: "20px" }}
                      >
                        check_circle
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* SECTION 6: FAQ */}
        <section className="harita-anatomy-section">
          <div className="harita-anatomy-inner">
            <div style={{ maxWidth: "600px", marginBottom: "2.5rem" }}>
              <span className="cap-tag">MERAK EDİLENLER</span>
              <h2 className="cap-title">Sıkça Sorulan Sorular</h2>
              <p className="cap-desc">
                Harita Masası kullanım prensipleri, uyumluluk ve veri güvenliği hakkında net
                yanıtlar.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#013628",
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#286954", fontSize: "18px" }}
                  >
                    help
                  </span>
                  Harita Masasını kullanmak için ücret ödemem gerekir mi?
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Hayır, temel Harita Masası; durak ekleme, 5 güne kadar katman oluşturma, mesafe
                  hesaplama ve standart dışa aktarma araçları tamamen <strong>ücretsizdir</strong>.
                  Giriş yapmadan hemen bir çalışma alanı açıp taslağınızı oluşturabilirsiniz.
                </p>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#013628",
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#286954", fontSize: "18px" }}
                  >
                    help
                  </span>
                  Oluşturduğum rotayı telefonda internetsiz açabilir miyim?
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Evet. MapsBridge Mobil uygulamasında ya da mobil tarayıcınızda "Saha Modu"nu
                  etkinleştirdiğinizde rotanız, durak notları ve vektörel harita verisi cihazınıza
                  kaydedilir. Yurt dışı seyahatlerinizde hücresel veriyi kapatıp rahatlıkla
                  kullanabilirsiniz.
                </p>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#013628",
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#286954", fontSize: "18px" }}
                  >
                    help
                  </span>
                  Google Maps'teki kayıtlı yerlerimi haritaya aktarabilir miyim?
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Evet. Google Haritalar'dan dışa aktardığınız KML, GeoJSON veya CSV dosyalarını
                  Harita Masası'ndaki "İçe Aktar" düğmesine sürükleyerek tüm kayıtlı yıldızlı
                  noktalarınızı anında Pin Pool (Durak Havuzu) içine alabilirsiniz.
                </p>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  padding: "1.5rem",
                  borderRadius: "1rem",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#013628",
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "#286954", fontSize: "18px" }}
                  >
                    help
                  </span>
                  Arkadaşlarımla ortak çalışma yapabilir miyiz?
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Kesinlikle. Oluşturduğunuz masanın 6 haneli gezi kodunu veya iş birliği
                  bağlantısını paylaştığınızda seyahat ortaklarınız kendi cihazlarından durak
                  ekleyebilir, ziyaret notları bırakabilir veya durak sıralamasını birlikte
                  değiştirebilir.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: FINAL HIGH-CONTRAST CTA BANNER */}
        <section className="harita-final-banner-section">
          <div className="harita-anatomy-inner">
            <div className="harita-final-banner">
              <div className="final-banner-glow" />
              <div className="final-banner-content">
                <div className="final-banner-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    bolt
                  </span>
                  <span>SIFIR KURULUM • TARAYICINIZDA ANINDA HAZIR</span>
                </div>
                <h2 className="final-banner-h">
                  Seyahat Masanızı Şimdi Açın, İlk Rotanızı Saniyeler İçinde Çizin.
                </h2>
                <p className="final-banner-p">
                  Kredi kartı gerekmez. İndirme gerekmez. Tüm modern masaüstü ve tablet
                  tarayıcılarında akıcı ve kesintisiz çalışır.
                </p>
                <div className="final-banner-actions">
                  <Link href="/maps/" className="btn-final-emerald" prefetch={false}>
                    <span>Ücretsiz Harita Masasına Başla</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      arrow_forward
                    </span>
                  </Link>
                  <Link href="/community/" className="btn-final-glass" prefetch={false}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      travel_explore
                    </span>
                    <span>Topluluk Rotalarını Gör</span>
                  </Link>
                </div>
                <div className="final-banner-specs">
                  <div className="final-spec-item">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#6ffbbe", fontSize: "16px" }}
                    >
                      verified
                    </span>
                    <span>Ücretsiz Başlangıç</span>
                  </div>
                  <div className="final-spec-item">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#6ffbbe", fontSize: "16px" }}
                    >
                      cloud_off
                    </span>
                    <span>Çevrimdışı Uyumlu</span>
                  </div>
                  <div className="final-spec-item">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#6ffbbe", fontSize: "16px" }}
                    >
                      lock
                    </span>
                    <span>Gizlilik Odaklı Vektörel Harita</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
