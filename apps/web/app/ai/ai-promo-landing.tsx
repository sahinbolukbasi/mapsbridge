"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import { AuthActionModal } from "../components/auth-gate";
import { getStoredSession, isTokenExpired, refreshSession } from "../lib/cognito";
import "./ai-promo.css";

const DAY_STOPS = {
  1: [
    {
      num: 1,
      time: "08:30 • 2 SAAT SÜRE",
      slot: "🌅 Sabah Slotu",
      title: "Kolezyum & Palatino Tepesi",
      desc: "Roma İmparatorluğu'nun kalbine adım atın. Sıra beklemeden giriş biletleri önerilir.",
      tag: "💡 Sabah ilk slot rezervasyonu tavsiye edilir",
      icon: "wb_sunny",
    },
    {
      num: 2,
      time: "11:30 • ÖĞLE YEMEĞİ (1.5 SAAT)",
      slot: "🚶 12 dk yürüyüş",
      title: "Monti Bölgesi & Trattoria da Enzo",
      desc: "Bohem sokaklarda gezinti ve otantik Roma mutfağı deneyimi.",
      tag: "🍽️ Öneri: Ev yapımı Cacio e Pepe & Tiramisu",
      icon: "restaurant",
    },
    {
      num: 3,
      time: "14:00 • 1.5 SAAT",
      slot: "🚶 15 dk yürüyüş",
      title: "Pantheon & Piazza Navona",
      desc: "Mükemmel kubbe mimarisi ve Bernini'nin Dört Nehir Çeşmesi.",
      tag: "☕ Sant'Eustachio Il Caffè molası",
      icon: "local_cafe",
    },
    {
      num: 4,
      time: "17:30 • GÜN BATIMI & AKŞAM",
      slot: "🚶 18 dk yürüyüş",
      title: "Trastevere & Ponte Sisto",
      desc: "Sarmaşıklarla kaplı Arnavut kaldırımlı sokaklarda aperitivo ve gün batımı şarap tadımı.",
      tag: "🍷 Manzaralı teras & canlı İtalyan müziği",
      icon: "wine_bar",
    },
  ],
  2: [
    {
      num: 1,
      time: "09:00 • 3 SAAT SÜRE",
      slot: "🌅 Sabah Slotu",
      title: "Vatikan Müzeleri & Sistina Şapeli",
      desc: "Michelangelo'nun başyapıtları ve dünyanın en zengin sanat koleksiyonlarından biri.",
      tag: "🎫 Erken giriş & rehberli tur önerisi",
      icon: "museum",
    },
    {
      num: 2,
      time: "13:00 • 1.5 SAAT",
      slot: "🚶 8 dk yürüyüş",
      title: "Aziz Petrus Bazilikası & Kubbe Çıkışı",
      desc: "Roma'nın silüetine panoramik bakış ve Hristiyanlık tarihinin kalbi.",
      tag: "🔭 Kubbeye asansörle çıkış imkanı",
      icon: "church",
    },
    {
      num: 3,
      time: "15:30 • 1 SAAT",
      slot: "🚶 12 dk yürüyüş",
      title: "Castel Sant'Angelo & Melekler Köprüsü",
      desc: "Tiber Nehri kıyısında heybetli bir kale ve Bernini heykelleriyle bezeli köprü.",
      tag: "📸 Nehir boyu fotoğraf noktası",
      icon: "fort",
    },
  ],
  3: [
    {
      num: 1,
      time: "10:00 • 2 SAAT",
      slot: "☀️ Öğle Öncesi",
      title: "Villa Borghese Parkı & Manzara Terası",
      desc: "Şehrin gürültüsünden uzak yemyeşil bahçeler ve Pincio Manzara Tepesi.",
      tag: "🚲 Bisiklet kiralama ve gölet turu",
      icon: "park",
    },
    {
      num: 2,
      time: "13:00 • 1.5 SAAT",
      slot: "🚶 10 dk yürüyüş",
      title: "İspanyol Merdivenleri & Via Condotti",
      desc: "Tarihi çeşme ve İtalyan moda caddelerinde keyifli bir yürüyüş.",
      tag: "🍦 Gelateria del Teatro dondurma molası",
      icon: "icecream",
    },
    {
      num: 3,
      time: "16:00 • 2 SAAT",
      slot: "🚶 15 dk yürüyüş",
      title: "Trevi Çeşmesi & Campo de' Fiori",
      desc: "Dilek parası atma ritüeli ve akşam pazarıyla ünlü meydanda veda yemeği.",
      tag: "✨ Işıklandırmalı gece atmosferi",
      icon: "nightlife",
    },
  ],
};

export function AIPromoLanding() {
  const [selectedDay, setSelectedDay] = useState<1 | 2 | 3>(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    const openWorkspaceIfAuthenticated = async () => {
      const stored = getStoredSession();
      if (!stored?.token) {
        if (active) setCheckingSession(false);
        return;
      }
      if (!isTokenExpired(stored.token) || (await refreshSession())?.token) {
        window.location.replace("/ai/");
        return;
      }
      if (active) setCheckingSession(false);
    };
    void openWorkspaceIfAuthenticated();
    return () => {
      active = false;
    };
  }, []);

  const loginUrl = (q?: string) => `/login/?redirect=/ai/${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  const signupUrl = (q?: string) =>
    `/register/?redirect=/ai/${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  function handleCopyCode() {
    try {
      navigator.clipboard.writeText("RM-841");
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      setCopiedCode(true);
    }
  }

  function handleStarterClick(text: string) {
    const session = getStoredSession();
    if (session?.token) {
      window.location.assign(`/ai/?q=${encodeURIComponent(text)}`);
      return;
    }
    setPromptText(text);
    setAuthModal(true);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = promptText.trim();
    const session = getStoredSession();
    if (session?.token) {
      window.location.assign(`/ai/${text ? `?q=${encodeURIComponent(text)}` : ""}`);
      return;
    }
    setAuthModal(true);
  }

  if (checkingSession) {
    return (
      <main
        className="ai-promo-wrapper"
        style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
        aria-live="polite"
      >
        Oturum kontrol ediliyor...
      </main>
    );
  }

  return (
    <div className="ai-promo-wrapper">
      <HeaderNav />

      {/* ── 1. Top Hero Section ── */}
      <section className="ai-promo-hero">
        <div className="ai-promo-hero-inner">
          <div className="ai-promo-badge">
            <span className="ai-promo-pulse-dot"></span>
            <span>✨ MAPSBRIDGE AI SEYAHAT BOTU • CANLI ASİSTAN</span>
          </div>

          <h1 className="ai-promo-hero-title">
            Hayalindeki Seyahati Anlat, <br />
            <span className="ai-promo-hero-highlight">AI Anında</span> Haritalandırsın.
          </h1>

          <p className="ai-promo-hero-desc">
            Yapay zeka asistanı bütçenize, ilgi alanlarınıza, tempo tercihinize ve seyahat
            tarihinize göre saniyeler içinde optimize edilmiş rota, durak saatleri ve canlı rota
            paylaşım bağlantısını üretir.
          </p>

          <div className="ai-promo-stats-strip">
            <span className="ai-promo-stat-pill">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px", color: "#10b981" }}
              >
                bolt
              </span>
              Saniyeler İçinde Rota
            </span>
            <span className="ai-promo-stat-pill">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px", color: "#286954" }}
              >
                verified
              </span>
              Doğrulanmış Mekan Bilgileri
            </span>
            <span className="ai-promo-stat-pill">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "16px", color: "#013628" }}
              >
                sync
              </span>
              Otomatik Çevrimdışı Senkronizasyon
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. Central Interactive Workspace (Split View) ── */}
      <section className="ai-promo-workspace-sec">
        <div className="ai-promo-workspace-grid">
          {/* Left Column: Interactive Chat Interface */}
          <div className="ai-promo-chat-card">
            <div className="ai-promo-chat-header">
              <div className="ai-promo-bot-badge-group">
                <div className="ai-promo-bot-icon-wrap">
                  <div className="ai-promo-bot-icon-box">
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      smart_toy
                    </span>
                  </div>
                  <span className="ai-promo-bot-status-dot"></span>
                </div>
                <div className="ai-promo-bot-meta">
                  <div className="ai-promo-bot-name-row">
                    <span className="ai-promo-bot-name">MapsBridge AI Asistan</span>
                    <span className="ai-promo-bot-version">AI</span>
                  </div>
                  <span className="ai-promo-bot-subline">
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "9999px",
                        background: "#10b981",
                      }}
                    ></span>
                    Çevrimiçi • Yanıt süresi &lt; 1sn
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setAuthModal(true)}
                  className="ai-promo-sub-btn"
                  title="Sohbeti Başlat"
                  style={{ padding: "0.45rem 0.85rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    add
                  </span>
                  <span>Yeni Sohbet</span>
                </button>
              </div>
            </div>

            {/* Chat Conversation Scroll Area */}
            <div className="ai-promo-chat-feed">
              {/* Bot Welcome Bubble */}
              <div className="ai-promo-bubble-row">
                <div className="ai-promo-avatar-mini">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    neurology
                  </span>
                </div>
                <div className="ai-promo-bubble-content">
                  <p style={{ margin: 0 }}>
                    Merhaba! Ben{" "}
                    <strong style={{ color: "#013628", fontWeight: 700 }}>
                      MapsBridge AI Seyahat Asistanı
                    </strong>
                    . Aklındaki şehri, gezi süreni ve zevklerini söyle; sana dinlenmeli, yürümeli ve
                    gerçek yerel lezzetlerle dolu kusursuz bir gezi haritası hazırlayayım.
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "var(--promo-on-surface-variant)",
                    }}
                  >
                    Nereden başlamak istersin? Aşağıdaki örnek şablonlardan birine dokunabilir veya
                    doğrudan yazabilirsin:
                  </p>
                  <div className="ai-promo-starter-chips">
                    <button
                      type="button"
                      className="ai-promo-chip-btn"
                      onClick={() => handleStarterClick("3 Günlük Roma Tarih & Gastronomi Planı")}
                    >
                      🏛️ 3 Günlük Roma Tarih &amp; Gastronomi Planı
                    </button>
                    <button
                      type="button"
                      className="ai-promo-chip-btn"
                      onClick={() => handleStarterClick("Kapadokya 2 Günlük Bütçe Dostu Macera")}
                    >
                      🎈 Kapadokya 2 Günlük Bütçe Dostu Macera
                    </button>
                    <button
                      type="button"
                      className="ai-promo-chip-btn"
                      onClick={() =>
                        handleStarterClick("Tokyo 4 Günlük Metro ve Gece Hayatı Rotası")
                      }
                    >
                      🗼 Tokyo 4 Günlük Metro ve Gece Hayatı Rotası
                    </button>
                    <button
                      type="button"
                      className="ai-promo-chip-btn"
                      onClick={() => handleStarterClick("Likya Yolu Yürüyüş & Kamp Durakları")}
                    >
                      🏖️ Likya Yolu Yürüyüş &amp; Kamp Durakları
                    </button>
                  </div>
                </div>
              </div>

              {/* User Message Bubble */}
              <div className="ai-promo-bubble-row user-row">
                <div className="ai-promo-bubble-content user-bubble">
                  <p style={{ margin: 0 }}>
                    Bana 3 günlük bir Roma seyahati planlar mısın? Yürümeyi severim, antik tarih ve
                    gerçek İtalyan makarnaları önceliğim. Bütçem orta düzey.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      opacity: 0.85,
                    }}
                  >
                    <span>14:32</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      done_all
                    </span>
                  </div>
                </div>
                <div className="ai-promo-avatar-mini user-avatar">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    person
                  </span>
                </div>
              </div>

              {/* Bot Response Bubble */}
              <div className="ai-promo-bubble-row">
                <div className="ai-promo-avatar-mini">
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    auto_awesome
                  </span>
                </div>
                <div className="ai-promo-bubble-content">
                  <p style={{ margin: 0 }}>
                    Harika bir seçim! Kolezyum ve Forum'un sabah kalabalıksız saatlerini,
                    Trastevere'nin en otantik trattoria'larını ve gün batımında Gianicolo Tepesi'ni
                    kapsayan optimize bir rota çıkardım. Duraklar arasındaki yürüme mesafeleri ve
                    önerilen kalış süreleri sağ panelde hazır!
                  </p>

                  <div className="ai-promo-micro-card">
                    <div className="ai-promo-micro-header">
                      <div className="ai-promo-micro-title-group">
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "9999px",
                            background: "#10b981",
                            animation: "promoPulse 2s infinite",
                          }}
                        ></span>
                        <strong style={{ fontSize: "14px", color: "var(--promo-deep-forest)" }}>
                          Roma Antik &amp; Lezzet Rotası
                        </strong>
                      </div>
                      <span className="ai-promo-micro-badge">RM-841</span>
                    </div>

                    <div className="ai-promo-micro-stats">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "#286954" }}
                        >
                          calendar_today
                        </span>{" "}
                        3 Gün
                      </span>
                      <span>•</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "#286954" }}
                        >
                          location_on
                        </span>{" "}
                        9 Durak
                      </span>
                      <span>•</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "14px", color: "#286954" }}
                        >
                          directions_walk
                        </span>{" "}
                        ~7.4 km/gün
                      </span>
                    </div>

                    <div className="ai-promo-micro-actions">
                      <Link
                        href="/maps/?kod=RM-841"
                        className="ai-promo-sub-btn"
                        style={{ background: "#1e4d3e", color: "#ffffff", border: "none" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          map
                        </span>
                        Haritada İncele
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAuthModal(true)}
                        className="ai-promo-sub-btn"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                          tune
                        </span>
                        Kişiselleştir
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "12px", color: "var(--promo-outline)" }}>
                    💡 İpucu: 2. Gün sabahı Vatikan Müzeleri için erken bilet almayı unutmayın,
                    dilerseniz sizin için rezervasyon linkini ekleyebilirim.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Input Dock */}
            <div className="ai-promo-chat-dock">
              <div className="ai-promo-filter-row">
                <div className="ai-promo-filter-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    speed
                  </span>
                  <span>Tempo:</span>
                  <select className="ai-promo-filter-select" defaultValue="Dengeli / Orta">
                    <option>Dengeli / Orta</option>
                    <option>Sakin &amp; Rahat</option>
                    <option>Hızlı &amp; Yoğun</option>
                  </select>
                </div>
                <div className="ai-promo-filter-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    payments
                  </span>
                  <span>Bütçe:</span>
                  <select className="ai-promo-filter-select" defaultValue="Orta Düzey (€€)">
                    <option>Orta Düzey (€€)</option>
                    <option>Ekonomik (€)</option>
                    <option>Lüks &amp; Konfor (€€€)</option>
                  </select>
                </div>
                <div className="ai-promo-filter-pill">
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    directions_walk
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--promo-deep-forest)" }}>
                    Yürüyüş &amp; Metro
                  </span>
                </div>
              </div>

              <form className="ai-promo-input-bar" onSubmit={handleFormSubmit}>
                <button
                  type="button"
                  onClick={() => setAuthModal(true)}
                  className="ai-promo-sub-btn"
                  style={{ border: "none", background: "transparent", padding: "6px" }}
                  title="Fotoğraf Ekle"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    add_photo_alternate
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal(true)}
                  className="ai-promo-sub-btn"
                  style={{ border: "none", background: "transparent", padding: "6px" }}
                  title="Sesli Komut"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    mic
                  </span>
                </button>
                <input
                  type="text"
                  className="ai-promo-input-field"
                  placeholder="AI asistana gitmek istediğin şehri, süreyi ve tercihlerini yaz..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                />
                <button type="submit" className="ai-promo-send-btn">
                  <span>Gönder</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    send
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Real-time Live Generated Route Preview */}
          <div className="ai-promo-route-card">
            <div className="ai-promo-route-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "20px", color: "#286954" }}
                  >
                    map
                  </span>
                  <h2
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      margin: 0,
                      color: "var(--promo-deep-forest)",
                    }}
                  >
                    Canlı Rota Önizlemesi
                  </h2>
                </div>
                <span style={{ fontSize: "12px", color: "var(--promo-on-surface-variant)" }}>
                  Kod: <strong style={{ color: "#013628", fontWeight: 700 }}>RM-841</strong> • Roma,
                  İtalya
                </span>
              </div>
              <span
                className="ai-promo-badge"
                style={{ padding: "0.25rem 0.65rem", fontSize: "10.5px" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                  auto_awesome
                </span>
                AI OPTİMİZE EDİLDİ
              </span>
            </div>

            {/* Map Preview Banner */}
            <div className="ai-promo-map-banner">
              <img
                src="/images/rome-colosseum.jpg"
                alt="Roma Kolezyum Rota Önizlemesi"
                className="ai-promo-map-img"
              />
              <div className="ai-promo-map-overlay"></div>
              <div className="ai-promo-map-floating-pill">
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "9999px",
                    background: "#10b981",
                    animation: "promoPulse 2s infinite",
                  }}
                ></span>
                <span>{selectedDay}. Gün Canlı Yol Haritası</span>
                <span style={{ color: "var(--promo-outline)", fontWeight: 400 }}>
                  {DAY_STOPS[selectedDay].length} Durak
                </span>
              </div>
              <Link
                href="/maps/?kod=RM-841"
                className="ai-promo-sub-btn"
                style={{ position: "absolute", top: "10px", right: "12px", padding: "6px" }}
                title="Harita Masasını Aç"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  open_in_new
                </span>
              </Link>
            </div>

            {/* Day Selector Tabs */}
            <div className="ai-promo-day-tabs">
              <button
                type="button"
                className={`ai-promo-day-tab-btn ${selectedDay === 1 ? "active" : ""}`}
                onClick={() => setSelectedDay(1)}
              >
                1. Gün <span style={{ opacity: 0.8, fontSize: "11px" }}>(Antik Merkez)</span>
              </button>
              <button
                type="button"
                className={`ai-promo-day-tab-btn ${selectedDay === 2 ? "active" : ""}`}
                onClick={() => setSelectedDay(2)}
              >
                2. Gün <span style={{ opacity: 0.8, fontSize: "11px" }}>(Vatikan)</span>
              </button>
              <button
                type="button"
                className={`ai-promo-day-tab-btn ${selectedDay === 3 ? "active" : ""}`}
                onClick={() => setSelectedDay(3)}
              >
                3. Gün <span style={{ opacity: 0.8, fontSize: "11px" }}>(Trastevere)</span>
              </button>
            </div>

            {/* Timeline Stops Feed */}
            <div className="ai-promo-timeline-feed">
              {DAY_STOPS[selectedDay].map((stop, idx) => (
                <div className="ai-promo-stop-item" key={stop.num}>
                  {idx < DAY_STOPS[selectedDay].length - 1 && (
                    <div className="ai-promo-stop-connector"></div>
                  )}
                  <div className="ai-promo-stop-number">{stop.num}</div>
                  <div className="ai-promo-stop-content">
                    <div className="ai-promo-stop-topline">
                      <span className="ai-promo-stop-time">{stop.time}</span>
                      <span className="ai-promo-stop-slot">
                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                          {stop.icon}
                        </span>
                        {stop.slot}
                      </span>
                    </div>
                    <h3 className="ai-promo-stop-title">{stop.title}</h3>
                    <p className="ai-promo-stop-desc">{stop.desc}</p>
                    <div className="ai-promo-stop-tag">{stop.tag}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar */}
            <div className="ai-promo-route-dock">
              <Link href="/maps/?kod=RM-841" className="ai-promo-main-action-btn">
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  explore
                </span>
                <span>Harita Panelinde Aç &amp; Düzenle</span>
              </Link>
              <div className="ai-promo-sub-actions-grid">
                <button type="button" className="ai-promo-sub-btn" onClick={handleCopyCode}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px", color: "#10b981" }}
                  >
                    {copiedCode ? "check" : "content_copy"}
                  </span>
                  <span>{copiedCode ? "Kopyalandı!" : "Kodu Kopyala (RM-841)"}</span>
                </button>
                <button
                  type="button"
                  className="ai-promo-sub-btn"
                  onClick={() => setAuthModal(true)}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px", color: "#286954" }}
                  >
                    download
                  </span>
                  <span>PDF / Çevrimdışı İndir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Bottom Features & Capabilities Section ── */}
      <section className="ai-promo-features-sec">
        <div className="ai-promo-features-inner">
          <div className="ai-promo-features-header">
            <div>
              <div className="ai-promo-features-badge">
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  psychology
                </span>
                Gelişmiş Harita Algoritmaları
              </div>
              <h2 className="ai-promo-features-title">MapsBridge AI Neler Yapabilir?</h2>
              <p className="ai-promo-features-sub">
                Standart turistik listelerin ötesine geçin. Yapay zeka motorumuz milyonlarca seyahat
                verisini, yerel dinamikleri ve yürüyüş rotalarını anlık olarak harmanlar.
              </p>
            </div>

            <div className="ai-promo-metric-pill-box">
              <div className="ai-promo-metric-item">
                <span className="ai-promo-metric-number">&lt;60sn</span>
                <span className="ai-promo-metric-label">Ortalama Planlama Süresi</span>
              </div>
              <div className="ai-promo-metric-divider"></div>
              <div className="ai-promo-metric-item">
                <span className="ai-promo-metric-number" style={{ color: "#10b981" }}>
                  120+
                </span>
                <span className="ai-promo-metric-label">Desteklenen Ülke</span>
              </div>
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="ai-promo-pillars-grid">
            <div className="ai-promo-pillar-card">
              <div>
                <div className="ai-promo-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                    alt_route
                  </span>
                </div>
                <h3 className="ai-promo-pillar-title">Akıllı Rota &amp; Mesafe Optimizasyonu</h3>
                <p className="ai-promo-pillar-desc">
                  Açılış saatleri, yoğunluk tahminleri ve yürüme sürelerini hesaba katarak en az
                  yoran, en mantıklı durak sıralamasını kurar.
                </p>
              </div>
              <span className="ai-promo-pillar-tagline">
                <span>Sıfır Çapraz Geçiş</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </span>
            </div>

            <div className="ai-promo-pillar-card">
              <div>
                <div className="ai-promo-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                    account_balance_wallet
                  </span>
                </div>
                <h3 className="ai-promo-pillar-title">Bütçe ve Harcama Tahmini</h3>
                <p className="ai-promo-pillar-desc">
                  Müze giriş ücretleri, ortalama yemek maliyetleri ve yerel toplu taşıma giderlerini
                  güncel kur bazında anlık olarak hesaplar.
                </p>
              </div>
              <span className="ai-promo-pillar-tagline">
                <span>Şeffaf Kalem Listesi</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </span>
            </div>

            <div className="ai-promo-pillar-card">
              <div>
                <div className="ai-promo-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                    cloud_sync
                  </span>
                </div>
                <h3 className="ai-promo-pillar-title">Canlı Rota ve Bulut Eşitleme</h3>
                <p className="ai-promo-pillar-desc">
                  Üretilen plan tek bir linkle tüm arkadaşlarınızın telefonuna, web paneline ve
                  çevrimdışı haritasına anında yansır.
                </p>
              </div>
              <span className="ai-promo-pillar-tagline">
                <span>Anında Eşitleme</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </span>
            </div>

            <div className="ai-promo-pillar-card">
              <div>
                <div className="ai-promo-pillar-icon-box">
                  <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                    cloud_sync
                  </span>
                </div>
                <h3 className="ai-promo-pillar-title">Canlı Koşullara Uyum</h3>
                <p className="ai-promo-pillar-desc">
                  Beklenmeyen sağanak yağmur, tadilat veya kapalı mekan durumunda anında alternatif
                  kapalı müze veya kafe durakları sunar.
                </p>
              </div>
              <span className="ai-promo-pillar-tagline">
                <span>Dinamik Yeniden Rotalama</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  trending_flat
                </span>
              </span>
            </div>
          </div>

          {/* 4. Popular Inspiration Templates */}
          <div className="ai-promo-templates-sec">
            <div className="ai-promo-templates-header">
              <div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--promo-deep-forest)",
                  }}
                >
                  Popüler İlham Şablonları
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--promo-on-surface-variant)",
                    margin: "4px 0 0",
                  }}
                >
                  Saniyeler içinde AI asistana göndermek için bir konsept seçin.
                </p>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--promo-outline)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  touch_app
                </span>
                Tıklayarak sohbeti başlatın
              </span>
            </div>

            <div className="ai-promo-templates-grid">
              <div
                className="ai-promo-template-card"
                onClick={() =>
                  handleStarterClick(
                    "Hostel konaklamaları, ücretsiz yürüyüş turları ve yerel pazarlarla bütçe dostu sırt çantalı rota",
                  )
                }
              >
                <div>
                  <div className="ai-promo-template-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      hiking
                    </span>
                  </div>
                  <h4 className="ai-promo-template-title">Bütçe Dostu Sırt Çantalı</h4>
                  <p className="ai-promo-template-desc">
                    Hostel konaklamaları, ücretsiz yürüyüş turları ve yerel pazar durakları.
                  </p>
                </div>
                <span className="ai-promo-template-link">
                  Dene{" "}
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    arrow_forward
                  </span>
                </span>
              </div>

              <div
                className="ai-promo-template-card"
                onClick={() =>
                  handleStarterClick(
                    "Bebek arabasına uygun parkurlar, interaktif bilim müzeleri ve geniş parklarla çocuklu aile rotası",
                  )
                }
              >
                <div>
                  <div className="ai-promo-template-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      family_restroom
                    </span>
                  </div>
                  <h4 className="ai-promo-template-title">Çocuklu Aile Gezisi</h4>
                  <p className="ai-promo-template-desc">
                    Bebek arabasına uygun parkurlar, interaktif bilim müzeleri ve geniş parklar.
                  </p>
                </div>
                <span className="ai-promo-template-link">
                  Dene{" "}
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    arrow_forward
                  </span>
                </span>
              </div>

              <div
                className="ai-promo-template-card"
                onClick={() =>
                  handleStarterClick(
                    "Gizli manzara terasları, mum ışığında şarap evleri ve sakin sahil boylarıyla romantik hafta sonu",
                  )
                }
              >
                <div>
                  <div className="ai-promo-template-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      favorite
                    </span>
                  </div>
                  <h4 className="ai-promo-template-title">Romantik Hafta Sonu</h4>
                  <p className="ai-promo-template-desc">
                    Gizli manzara terasları, mum ışığında şarap evleri ve sakin sahil boyları.
                  </p>
                </div>
                <span className="ai-promo-template-link">
                  Dene{" "}
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    arrow_forward
                  </span>
                </span>
              </div>

              <div
                className="ai-promo-template-card"
                onClick={() =>
                  handleStarterClick(
                    "Michelin rehberli lokantalar, yerel fırınlar ve sokak tezgâhlarıyla gurme lezzet rotası",
                  )
                }
              >
                <div>
                  <div className="ai-promo-template-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      ramen_dining
                    </span>
                  </div>
                  <h4 className="ai-promo-template-title">Gurme &amp; Sokak Lezzetleri</h4>
                  <p className="ai-promo-template-desc">
                    Michelin rehberli küçük lokantalar, yerel fırınlar ve sokak tezgâhları.
                  </p>
                </div>
                <span className="ai-promo-template-link">
                  Dene{" "}
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                    arrow_forward
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Bottom Call-to-Action Banner ── */}
      <section className="ai-promo-cta-banner">
        <div className="ai-promo-cta-inner">
          <div
            className="ai-promo-badge"
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              borderColor: "rgba(255,255,255,0.3)",
            }}
          >
            ✨ MapsBridge AI Seyahat Platformu
          </div>
          <h2 className="ai-promo-cta-title">
            Seyahatinizi Şansa Bırakmayın, <br />
            AI Asistan ile Şimdi Başlayın.
          </h2>
          <p className="ai-promo-cta-desc">
            Ücretsiz kayıt olun, hemen akıllı rota oluşturmaya başlayın veya paylaşılan rotaları
            anında keşfedin.
          </p>
          <div className="ai-promo-cta-buttons">
            <Link href={signupUrl(promptText)} className="ai-promo-cta-primary-btn">
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                rocket_launch
              </span>
              Ücretsiz Hesap Oluştur
            </Link>
            <Link href={loginUrl(promptText)} className="ai-promo-cta-secondary-btn">
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                login
              </span>
              Mevcut Hesaba Giriş Yap
            </Link>
          </div>
        </div>
      </section>

      {/* Unified Global Site Footer */}
      <SiteFooter />

      <AuthActionModal
        isOpen={authModal}
        onClose={() => setAuthModal(false)}
        title="MapsBridge AI Seyahat Asistanı"
        subtitle="AI ile seyahat planlamaya başlamak için lütfen giriş yapın veya ücretsiz hesap oluşturun."
        featureName="AI Seyahat Asistanı"
        nextUrl={loginUrl(promptText)}
      />
    </div>
  );
}
