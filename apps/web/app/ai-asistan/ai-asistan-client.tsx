"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import { useLocale } from "../lib/locale-context";
import { getStoredSession } from "../lib/cognito";
import "./ai-asistan.css";

interface AIAsistanClientProps {
  isEnglish?: boolean;
}

export function AIAsistanClient({ isEnglish: initialIsEnglish }: AIAsistanClientProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isEnglish } = useLocale();
  const [activeDay, setActiveDay] = useState<number>(1);
  const [chatInput, setChatInput] = useState<string>(
    "Let's end the day at a wine bar with live jazz in Trastevere.",
  );
  const [customReply, setCustomReply] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.token) {
      router.replace("/ai/");
      return;
    }
    setIsCheckingSession(false);
  }, [pathname, initialIsEnglish, router]);

  if (isCheckingSession) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-main, #f8fafc)",
          color: "#64748b",
        }}
        aria-live="polite"
      >
        Checking your session...
      </main>
    );
  }

  const daysInfo = [
    {
      day: 1,
      name: "Antik Merkez & Gastronomi",
      km: "7.4 km",
      time: "8s 30dk",
      walkTime: "47 dk",
      elevation: "+42 m (Düz)",
      budget: "€38 / kişi",
      stops: [
        {
          id: 1,
          name: "Kolezyum & Palatino Tepesi",
          time: "08:30 • 2 Saat • Sabah Açılış Slotu",
          icon: "wb_sunny",
        },
        {
          id: 2,
          name: "Trattoria da Enzo al 29",
          time: "12:30 • 1.5 Saat • Otantik Cacio e Pepe",
          icon: "restaurant",
        },
        {
          id: 3,
          name: "Pantheon & Piazza Navona",
          time: "15:00 • 1.5 Saat • Gün Işığı Kubbesi",
          icon: "local_cafe",
        },
      ],
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcy1HWqQHPjIaB09p1M4KXyHwSpsiQkx3taKa3puofABrh4kwUClhuKJVm0ppXYKhrOzEKVBJ2Jymj4l_Cl9vkVkLyrCjE9kdtDpg-tata0AtvJcx-HqQf--oFOXv6D-RIjGSsVwQ6j3WX33455ujHTYBIob_c1HJIGxh-F3jXdnD6mbNUEtlRB0Ba-b_aXvdYdCXm6WRV3Bw0HOnRbMrbZ8Rcp5YSbONhP1pklOad4wFEOhE3lzYMfA",
    },
    {
      day: 2,
      name: "Vatikan & San Pietro",
      km: "5.8 km",
      time: "7s 10dk",
      walkTime: "38 dk",
      elevation: "+25 m",
      budget: "€45 / kişi",
      stops: [
        {
          id: 1,
          name: "Vatikan Müzeleri & Sistine Şapeli",
          time: "09:00 • 3 Saat • Öncelikli Giriş",
          icon: "museum",
        },
        {
          id: 2,
          name: "Castel Sant'Angelo",
          time: "13:30 • 1.5 Saat • Manzara Terası",
          icon: "fort",
        },
        {
          id: 3,
          name: "Ponte Sant'Angelo & Kahve",
          time: "15:30 • 1 Saat • Nehir Kıyısı",
          icon: "local_cafe",
        },
      ],
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcy1HWqQHPjIaB09p1M4KXyHwSpsiQkx3taKa3puofABrh4kwUClhuKJVm0ppXYKhrOzEKVBJ2Jymj4l_Cl9vkVkLyrCjE9kdtDpg-tata0AtvJcx-HqQf--oFOXv6D-RIjGSsVwQ6j3WX33455ujHTYBIob_c1HJIGxh-F3jXdnD6mbNUEtlRB0Ba-b_aXvdYdCXm6WRV3Bw0HOnRbMrbZ8Rcp5YSbONhP1pklOad4wFEOhE3lzYMfA",
    },
    {
      day: 3,
      name: "Trastevere & Gianicolo",
      km: "6.2 km",
      time: "6s 45dk",
      walkTime: "42 dk",
      elevation: "+85 m (Tepe)",
      budget: "€32 / kişi",
      stops: [
        {
          id: 1,
          name: "Gianicolo Tepesi Seyir Terası",
          time: "11:00 • 1 Saat • Roma Panoraması",
          icon: "visibility",
        },
        {
          id: 2,
          name: "Santa Maria in Trastevere",
          time: "13:00 • 1 Saat • Tarihi Mozaikler",
          icon: "church",
        },
        {
          id: 3,
          name: "Freni e Frizioni Aperitivo",
          time: "18:00 • 2 Saat • Caz & Kokteyl",
          icon: "wine_bar",
        },
      ],
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcy1HWqQHPjIaB09p1M4KXyHwSpsiQkx3taKa3puofABrh4kwUClhuKJVm0ppXYKhrOzEKVBJ2Jymj4l_Cl9vkVkLyrCjE9kdtDpg-tata0AtvJcx-HqQf--oFOXv6D-RIjGSsVwQ6j3WX33455ujHTYBIob_c1HJIGxh-F3jXdnD6mbNUEtlRB0Ba-b_aXvdYdCXm6WRV3Bw0HOnRbMrbZ8Rcp5YSbONhP1pklOad4wFEOhE3lzYMfA",
    },
  ];

  const current = daysInfo[activeDay - 1] || daysInfo[0];

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setCustomReply(
      `Harika seçim! "${chatInput}" isteğin 1. güne eklendi. Freni e Frizioni şarap barı 21:00 slotuna yerleştirildi ve Harita Masasına yansıtıldı.`,
    );
  }

  return (
    <div className="ai-tanitim-container">
      <HeaderNav />

      <main className="ai-tanitim-main">
        {/* HERO SECTION */}
        <section className="ai-hero-wrap">
          <div className="ai-glow-1" />
          <div className="ai-glow-2" />

          <div className="ai-hero-inner">
            <div className="ai-status-pill">
              <span className="ai-pulse-dot" />
              <span className="ai-status-text">
                MAPSBRIDGE EKOSİSTEMİ • AI ASİSTAN &amp; HARİTA MASASI
              </span>
              <span style={{ fontSize: "11px", color: "#286954", opacity: 0.7 }}></span>
            </div>

            <h1 className="ai-hero-title">
              Hayalindeki Rotayı AI'ya Anlat,
              <br className="hidden sm:inline" />
              <span className="ai-title-sub-highlight">
                Harita Masasında
                <svg
                  className="ai-title-svg-curve"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 300 12"
                >
                  <path
                    d="M2 9C75 3 225 3 298 9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
              </span>{" "}
              Sanat Gibi Yönet.
            </h1>

            <p className="ai-hero-desc">
              Yapay zekanın saniyeler içinde ürettiği optimize rotalar, masaüstü dijital harita
              masasında milimetrik planlama ve durak havuzuna dönüşüyor. İki güçlü araç, tek
              kusursuz seyahat.
            </p>

            <div className="ai-hero-ctas">
              <Link href="/ai/" className="btn-ai-primary" prefetch={false}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px", color: "#34d399" }}
                >
                  smart_toy
                </span>
                <span>AI Asistanı ile Planla (Ücretsiz)</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  arrow_forward
                </span>
              </Link>
              <Link href="/maps/" className="btn-ai-secondary" prefetch={false}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px", color: "#10b981" }}
                >
                  map
                </span>
                <span>Harita Masasını Canlı İncele</span>
              </Link>
            </div>

            <div className="ai-telemetry-row">
              <div className="ai-telemetry-chip">
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "18px" }}
                >
                  bolt
                </span>
                <span>Saniyeler İçinde Rota</span>
              </div>
              <div className="ai-telemetry-chip">
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "18px" }}
                >
                  alt_route
                </span>
                <span>Sıfır Çapraz Geçiş Optimizasyonu</span>
              </div>
              <div className="ai-telemetry-chip">
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "18px" }}
                >
                  sync
                </span>
                <span>Çift Yönlü Bulut Senkronizasyonu</span>
              </div>
              <div className="ai-telemetry-chip">
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "18px" }}
                >
                  verified
                </span>
                <span>Doğrulanmış Mekan Bilgileri</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. INTERACTIVE SPLIT SHOWCASE (Visual Centerpiece) */}
        <section className="showcase-section" id="ai-interactive">
          <div className="studio-card">
            {/* Top Bar */}
            <div className="studio-top-bar">
              <div className="studio-brand-group">
                <div style={{ display: "flex", gap: "6px" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "9999px",
                      background: "#f87171",
                    }}
                  />
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "9999px",
                      background: "#fbbf24",
                    }}
                  />
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "9999px",
                      background: "#10b981",
                    }}
                  />
                </div>
                <span className="studio-title">MapsBridge Live Studio</span>
                <span className="studio-mode-pill">PRO KÖPRÜ MODU</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="studio-sync-node">
                  <span className="sync-ping-dot" />
                  <span>
                    Anında Haritaya Yansıtıldı (Kod:{" "}
                    <strong style={{ color: "#ffffff", fontFamily: "monospace" }}>#RM-841</strong>)
                  </span>
                </div>
                <Link
                  href="/maps/"
                  className="desk-day-btn"
                  style={{ background: "#286954", color: "#ffffff" }}
                >
                  Tam Ekrana Genişlet
                </Link>
              </div>
            </div>

            {/* Split Grid */}
            <div className="studio-grid">
              {/* SIDE A: AI CHAT */}
              <div className="side-ai-chat">
                <div>
                  <div className="chat-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="chat-avatar-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                          neurology
                        </span>
                      </div>
                      <div>
                        <h3
                          style={{ fontSize: "15px", fontWeight: 700, color: "#0d281e", margin: 0 }}
                        >
                          MapsBridge AI
                        </h3>
                        <p style={{ fontSize: "11px", color: "#286954", margin: 0 }}>
                          Saniyeler içinde rota mimarı • Çevrimiçi
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "#717974" }}>AI Engine</span>
                  </div>

                  {/* Message 1: User */}
                  <div
                    style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}
                  >
                    <div className="user-msg-box">
                      <p style={{ margin: 0 }}>
                        Roma için 3 günlük yürüyüş ve antik tarih odaklı, lezzetli trattoria'lar
                        içeren bir gezi planlar mısın? Bütçem orta düzey.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "10px",
                          color: "#34d399",
                          marginTop: "4px",
                        }}
                      >
                        <span>14:32</span>
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                          done_all
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message 2: AI */}
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      marginBottom: "1rem",
                    }}
                  >
                    <div className="chat-avatar-icon" style={{ width: "32px", height: "32px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        auto_awesome
                      </span>
                    </div>
                    <div className="ai-msg-box" style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#10b981",
                            textTransform: "uppercase",
                          }}
                        >
                          Kusursuz Rota Çıkarıldı
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontFamily: "monospace",
                            padding: "2px 6px",
                            background: "#f1f5f9",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          RM-841
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#131b2e" }}>
                        Roma Antik &amp; Lezzet Rotası hazırlandı! Kolezyum ve Forum'un sabah
                        kalabalıksız saatleri ve Trastevere akşam rotası optimize edildi. Sıfır
                        çapraz yürüyüş garantili.
                      </p>

                      {/* Mini Schedule Card */}
                      <div className="ai-schedule-preview">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#286954",
                          }}
                        >
                          <span>
                            {current.day}. GÜN: {current.name.toUpperCase()}
                          </span>
                          <span>
                            {current.stops.length} DURAK • ~{current.km}
                          </span>
                        </div>
                        {current.stops.map((s, idx) => (
                          <div key={s.id} className="schedule-stop-card">
                            <span className="stop-num-circle">{idx + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  color: "#0d281e",
                                }}
                              >
                                {s.name}
                              </p>
                              <p style={{ margin: 0, fontSize: "11px", color: "#404945" }}>
                                {s.time}
                              </p>
                            </div>
                            <span
                              className="material-symbols-outlined"
                              style={{ color: "#10b981", fontSize: "16px" }}
                            >
                              {s.icon}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Chips */}
                      <div
                        style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "4px" }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ecfdf5",
                            color: "#065f46",
                          }}
                        >
                          ⚡ Dengeli / Orta
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ecfdf5",
                            color: "#065f46",
                          }}
                        >
                          💶 €€ Orta Düzey
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: "#ecfdf5",
                            color: "#065f46",
                          }}
                        >
                          🚶 Yürüyüş &amp; Metro
                        </span>
                      </div>

                      {customReply && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "8px",
                            borderRadius: "8px",
                            background: "#ecfdf5",
                            border: "1px solid #a7f3d0",
                            color: "#065f46",
                            fontSize: "12.5px",
                          }}
                        >
                          {customReply}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div>
                  <form onSubmit={handleSendChat} className="chat-input-row">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Plana eklemek istediğiniz bir detay yazın..."
                    />
                    <button type="submit" className="chat-send-btn" title="Gönder">
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                        send
                      </span>
                    </button>
                  </form>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "#717974",
                      marginTop: "6px",
                      padding: "0 6px",
                    }}
                  >
                    <span>Öneri: '3. güne bisiklet parkuru ekle'</span>
                    <Link
                      href="/ai/"
                      style={{ color: "#286954", fontWeight: 600, textDecoration: "none" }}
                    >
                      Canlı AI Asistanı Aç ➔
                    </Link>
                  </div>
                </div>
              </div>

              {/* SIDE B: DIGITAL MAP DESK */}
              <div className="side-map-desk" id="harita-masasi-preview">
                <div>
                  {/* Map Desk Toolbar */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      marginBottom: "10px",
                    }}
                  >
                    <div className="desk-day-buttons">
                      {daysInfo.map((d) => (
                        <button
                          key={d.day}
                          type="button"
                          className={`desk-day-btn ${activeDay === d.day ? "active" : ""}`}
                          onClick={() => setActiveDay(d.day)}
                        >
                          {d.day}. Gün
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "#404945",
                      }}
                    >
                      <span>
                        Toplam: <strong>{current.km}</strong>
                      </span>
                      <Link
                        href="/maps/"
                        style={{ color: "#013628", display: "flex", alignItems: "center" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          open_in_new
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Main Map Viewport */}
                  <div className="map-desk-canvas">
                    <img
                      className="map-desk-img"
                      src={current.img}
                      alt={`${current.name} harita önizlemesi`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        position: "absolute",
                        inset: 0,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(13,40,30,0.85) 0%, transparent 40%, rgba(13,40,30,0.3) 100%)",
                        pointerEvents: "none",
                      }}
                    />

                    {/* Vector Track Overlay */}
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                      }}
                      viewBox="0 0 700 460"
                    >
                      <path
                        d="M 180 320 Q 240 270, 310 240 T 430 190 T 520 140"
                        stroke="#10B981"
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                        strokeWidth="4"
                      />
                      <path
                        d="M 180 320 Q 240 270, 310 240 T 430 190 T 520 140"
                        stroke="#34D399"
                        strokeLinecap="round"
                        strokeWidth="2"
                      />
                    </svg>

                    {/* Pin 1: Colosseo */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "110px",
                        left: "22%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "#ffffff",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#0d281e",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                          marginBottom: "2px",
                        }}
                      >
                        1. Kolezyum
                      </div>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "9999px",
                          background: "#1e4d3e",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "12px",
                          border: "2px solid #10b981",
                        }}
                      >
                        1
                      </div>
                    </div>

                    {/* Pin 2: Trattoria da Enzo */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "170px",
                        left: "42%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "#ffffff",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#0d281e",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                          marginBottom: "2px",
                        }}
                      >
                        2. Da Enzo (Öğle)
                      </div>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "9999px",
                          background: "#013628",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "12px",
                          border: "2px solid #34d399",
                        }}
                      >
                        2
                      </div>
                    </div>

                    {/* Pin 3: Pantheon */}
                    <div
                      style={{
                        position: "absolute",
                        top: "120px",
                        left: "56%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "#ffffff",
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#0d281e",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                          marginBottom: "2px",
                        }}
                      >
                        3. Pantheon
                      </div>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "9999px",
                          background: "#286954",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "12px",
                          border: "2px solid #34d399",
                        }}
                      >
                        3
                      </div>
                    </div>

                    {/* Durak Havuzu Drawer Card inside Map */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: "12px",
                        left: "12px",
                        right: "12px",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.95)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "6px",
                            background: "#ecfdf5",
                            color: "#10b981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            inventory_2
                          </span>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#0d281e" }}>
                              Durak Havuzu (Pin Pool)
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "#1e4d3e",
                                color: "#ffffff",
                                fontWeight: 700,
                              }}
                            >
                              5 Bekleyen
                            </span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#717974" }}>
                            Fontana di Trevi, Castel Sant'Angelo...
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/maps/"
                        style={{
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          background: "#1e4d3e",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Havuzu Aç
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Route Metric Footer */}
                <div className="route-metric-footer">
                  <div className="metric-stat-box">
                    <span className="metric-stat-label">Toplam Süre</span>
                    <span className="metric-stat-val">{current.time}</span>
                  </div>
                  <div className="metric-stat-box">
                    <span className="metric-stat-label">Net Yürüyüş</span>
                    <span className="metric-stat-val">{current.walkTime}</span>
                  </div>
                  <div className="metric-stat-box">
                    <span className="metric-stat-label">Yükseklik Farkı</span>
                    <span className="metric-stat-val">{current.elevation}</span>
                  </div>
                  <div className="metric-stat-box">
                    <span className="metric-stat-label">Tahmini Bütçe</span>
                    <span className="metric-stat-val">{current.budget}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. DEEP DIVE: AI NELER YAPABİLİR? */}
        <section className="deep-dive-section">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "2.5rem",
              gap: "1.5rem",
            }}
          >
            <div style={{ maxWidth: "600px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#10b981",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Derin Seyahat Zekası
              </span>
              <h2
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 800,
                  color: "#0d281e",
                  margin: "0.35rem 0 0.5rem",
                }}
              >
                AI Seyahat Asistanı Neler Yapabilir?
              </h2>
              <p style={{ fontSize: "15px", color: "#404945", lineHeight: "1.6" }}>
                Standart turistik listelerin ötesine geçin. Yapay zeka motorumuz milyonlarca rota
                verisini, yerel dinamikleri ve yürüyüş geometrilerini saniyeler içinde harmanlar.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                background: "#ffffff",
                padding: "1rem 1.5rem",
                borderRadius: "1rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <div>
                <span
                  style={{ fontSize: "2rem", fontWeight: 800, color: "#013628", lineHeight: 1 }}
                >
                  &lt;60sn
                </span>
                <span style={{ display: "block", fontSize: "12px", color: "#717974" }}>
                  Ortalama Planlama Süresi
                </span>
              </div>
              <div style={{ width: "1px", background: "#e2e8f0" }} />
              <div>
                <span
                  style={{ fontSize: "2rem", fontWeight: 800, color: "#10b981", lineHeight: 1 }}
                >
                  120+
                </span>
                <span style={{ display: "block", fontSize: "12px", color: "#717974" }}>
                  Desteklenen Ülke
                </span>
              </div>
            </div>
          </div>

          <div className="bento-grid-4">
            <div className="bento-card">
              <div>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    alt_route
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Akıllı Sıralama &amp; Rota Geometrisi
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Açılış saatleri, yoğunluk tahminleri ve yürüme eğimlerini analiz ederek zikzak
                  çizmeyen kusursuz durak sıralaması üretir.
                </p>
              </div>
              <div
                style={{
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#286954",
                }}
              >
                <span>Sıfır Çapraz Geçiş</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </div>
            </div>

            <div className="bento-card">
              <div>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    payments
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Bütçe &amp; Harcama Simülasyonu
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Müze giriş ücretleri, ortalama kahve ve yemek giderleri ile şehir içi metro
                  biletlerini güncel döviz bazında anlık hesaplar.
                </p>
              </div>
              <div
                style={{
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#286954",
                }}
              >
                <span>Şeffaf Kalem Listesi</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </div>
            </div>

            <div className="bento-card">
              <div>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    cloud_sync
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Dinamik Hava &amp; Durum Uyum
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Beklenmeyen sağanak yağış veya kapalı mekan durumunda anında alternatif kapalı
                  rotalar ve sıcak butik kafeler önerir.
                </p>
              </div>
              <div
                style={{
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#286954",
                }}
              >
                <span>Dinamik Rota Yenileme</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </div>
            </div>

            <div className="bento-card">
              <div>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#ecfdf5",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    chat
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Doğal Dil &amp; Serbest Sohbet
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Arkadaşınızla konuşur gibi 'çocukla gidilebilecek sakin parklar' veya 'en iyi
                  tiramisu' diyerek planınızı zenginleştirin.
                </p>
              </div>
              <div
                style={{
                  paddingTop: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#286954",
                }}
              >
                <span>Konuşma Tipi İstekler</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. WORKFLOW SECTION: İKİSİ BİR ARADA */}
        <section className="workflow-section">
          <div className="workflow-inner">
            <div style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#10b981",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Kusursuz Akış
              </span>
              <h2
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 800,
                  color: "#0d281e",
                  margin: "0.35rem 0 0.5rem",
                }}
              >
                İkisi Bir Arada: Zeka &amp; Kontrol
              </h2>
              <p style={{ fontSize: "15px", color: "#404945" }}>
                Fikirden ayak izlerine: maps köprüsünde 3 basit aşamada seyahatinizi inşa edin.
              </p>
            </div>

            <div className="workflow-grid">
              <div className="workflow-card">
                <div className="workflow-num-circle">1</div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#10b981",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  30 SANİYE
                </span>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Söyle
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  AI seyahat asistanına şehri, gezi süresini, bütçeni ve ilgi alanlarını serbestçe
                  anlat. Taslak rota anında önünde belirsin.
                </p>
              </div>

              <div className="workflow-card">
                <div
                  className="workflow-num-circle"
                  style={{ background: "#abedd3", color: "#013628" }}
                >
                  2
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#286954",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  2 DAKİKA
                </span>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Şekillendir
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  Harita masasında durakları sürükle, durak havuzundan yeni lezzet noktaları ekle ve
                  gün katmanlarını renklerle ayır.
                </p>
              </div>

              <div className="workflow-card">
                <div
                  className="workflow-num-circle"
                  style={{ background: "#1e4d3e", color: "#ffffff" }}
                >
                  3
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#1e4d3e",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  KESİNTİSİZ
                </span>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#0d281e",
                    marginBottom: "0.5rem",
                  }}
                >
                  Sahaya İndir
                </h3>
                <p style={{ fontSize: "13.5px", color: "#404945", lineHeight: "1.55" }}>
                  6 haneli eşleşme koduyla arkadaşlarınla paylaş, Google Maps'e aktar veya
                  MapsBridge saha moduyla internetsiz keşfet.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. CONVERSION BANNER */}
        <section className="ai-conversion-banner">
          <div className="ai-banner-card">
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#286954",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              KEŞFE ŞİMDİ BAŞLAYIN
            </span>
            <h2 className="ai-banner-h">
              Seyahatinizi Şansa Bırakmayın.
              <br />
              AI ile Başlayın, Haritada Mükemmelleştirin.
            </h2>
            <p className="ai-banner-p">
              Ücretsiz hesap oluşturun, dakikalar içinde kişiselleştirilmiş rota mimarinizi kurun
              veya canlı kodla anında masaüstü harita masasını test edin.
            </p>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}
            >
              <Link href="/ai/" className="btn-ai-primary" prefetch={false}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px", color: "#34d399" }}
                >
                  rocket_launch
                </span>
                <span>AI Asistan ile Ücretsiz Başla</span>
              </Link>
              <Link href="/maps/" className="btn-ai-secondary" prefetch={false}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px", color: "#10b981" }}
                >
                  open_in_browser
                </span>
                <span>Harita Masasını Aç</span>
              </Link>
            </div>

            {/* Mobile App Badges (Apple & Google Play -> /mobil-uygulamalar/) */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "center",
                marginTop: "1rem",
              }}
            >
              <Link
                href="/mobil-uygulamalar/"
                prefetch={false}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "12px",
                  background: "#0d281e",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  transition: "transform 0.15s ease",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ width: "20px", height: "20px" }}
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.08-3.11-1.05.05-2.31.7-3.06 1.55-.67.76-1.26 1.98-1.1 3.09 1.17.09 2.37-.74 3.08-1.53z" />
                </svg>
                <div style={{ textAlign: "left", lineHeight: 1.15 }}>
                  <span style={{ display: "block", fontSize: "9px", opacity: 0.75 }}>
                    App Store
                  </span>
                  <strong style={{ fontSize: "12px", fontWeight: 700 }}>Pek Yakında</strong>
                </div>
              </Link>

              <Link
                href="/mobil-uygulamalar/"
                prefetch={false}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "12px",
                  background: "#0d281e",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  transition: "transform 0.15s ease",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ width: "20px", height: "20px" }}
                >
                  <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m5.63-2.54L16.5 12l2.97-2.97 2.12 1.21c.63.36.63 1.26 0 1.62M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
                </svg>
                <div style={{ textAlign: "left", lineHeight: 1.15 }}>
                  <span style={{ display: "block", fontSize: "9px", opacity: 0.75 }}>
                    Google Play
                  </span>
                  <strong style={{ fontSize: "12px", fontWeight: 700 }}>Pek Yakında</strong>
                </div>
              </Link>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1.5rem",
                justifyContent: "center",
                marginTop: "1.75rem",
                fontSize: "12px",
                color: "#404945",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "16px" }}
                >
                  verified
                </span>
                Kredi kartı gerekmez
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "16px" }}
                >
                  verified
                </span>
                Sınırsız rota kaydı
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#10b981", fontSize: "16px" }}
                >
                  verified
                </span>
                iOS &amp; Android uyumlu
              </span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
