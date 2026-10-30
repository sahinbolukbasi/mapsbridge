"use client";

import React, { useState } from "react";
import Link from "next/link";
import "./mobile-apps.css";

export default function MobileAppsComingSoonPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // Persist to localStorage so the interest is not lost
    try {
      const key = "mapsbridge.mobileWaitlist";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      if (!prev.includes(email.trim())) {
        prev.push(email.trim());
        localStorage.setItem(key, JSON.stringify(prev));
      }
    } catch { // ignore
    }
    setSubmitted(true);
  }

  return (
    <div className="mobile-apps-container">

      <main className="mobile-apps-main">
        {/* Hero Section */}
        <section className="mobile-apps-hero">
          <div className="mobile-apps-glow" />

          <div className="mobile-apps-inner">
            <div className="mobile-badge">
              <span className="pulse-dot" />
              <span className="mobile-badge-text">
                iOS &amp; ANDROID • KAPALI TEST VE BETA AŞAMASI
              </span>
            </div>

            <h1 className="mobile-apps-title">
              MapsBridge Mobil Uygulaması{" "}
              <span className="mobile-apps-title-gradient">Çok Yakında</span> Cebinizde!
            </h1>

            <p className="mobile-apps-desc">
              Web Harita Masasında hazırladığınız rotalar, anında iPhone ve Android cihazınıza
              senkronize oluyor. Çevrimdışı navigasyon, saha modu ve canlı durak rehberliği ile
              keşfe hazır olun.
            </p>

            {/* Store Preview Cards */}
            <div className="store-buttons-grid">
              <div className="store-coming-card">
                <div className="store-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.08-3.11-1.05.05-2.31.7-3.06 1.55-.67.76-1.26 1.98-1.1 3.09 1.17.09 2.37-.74 3.08-1.53z" />
                  </svg>
                </div>
                <div className="store-card-info">
                  <span className="store-card-sub">Apple Ekosistemi</span>
                  <span className="store-card-name">App Store</span>
                  <span className="store-badge-soon">Pek Yakında (v2.4)</span>
                </div>
              </div>

              <div className="store-coming-card">
                <div className="store-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m5.63-2.54L16.5 12l2.97-2.97 2.12 1.21c.63.36.63 1.26 0 1.62M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
                  </svg>
                </div>
                <div className="store-card-info">
                  <span className="store-card-sub">Android Cihazlar</span>
                  <span className="store-card-name">Google Play</span>
                  <span className="store-badge-soon">Pek Yakında (v2.4)</span>
                </div>
              </div>
            </div>

            {/* Waitlist Form */}
            <div className="waitlist-card">
              <h3>Uygulama Yayınlandığında İlk Sen Öğren</h3>
              <p>
                Erken erişim davetiyesi almak ve beta test grubumuza katılmak için e-posta adresini
                bırak:
              </p>

              {submitted ? (
                <div className="waitlist-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>
                    Harika! Kaydını aldık. Mobil uygulama açıldığında sana haber vereceğiz.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="waitlist-form">
                  <input
                    type="email"
                    required
                    placeholder="ornek@eposta.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="waitlist-input"
                  />
                  <button type="submit" className="waitlist-btn">
                    <span>Haberdar Et</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                      arrow_forward
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="mobile-features-section">
          <div className="mobile-features-header">
            <h2>Mobil Uygulamada Neler Olacak?</h2>
            <p style={{ color: "#404945", fontSize: "15px" }}>
              Masaüstündeki gücü cebinize taşıyan akıllı saha araçları.
            </p>
          </div>

          <div className="mobile-features-grid">
            <div className="mobile-feat-card">
              <div className="feat-icon-box">
                <span className="material-symbols-outlined">offline_bolt</span>
              </div>
              <h4>Çevrimdışı Harita &amp; GPS</h4>
              <p>
                Yurt dışında ya da dağ yollarında internet çekmese bile rotanız, durak notlarınız ve
                pusula navigasyonunuz eksiksiz çalışır.
              </p>
            </div>

            <div className="mobile-feat-card">
              <div className="feat-icon-box">
                <span className="material-symbols-outlined">sync</span>
              </div>
              <h4>Sıfır Kablo Eşitleme</h4>
              <p>
                Web Harita Masasında düzenlediğiniz her durak, tek bir 6 haneli kodla ya da
                hesabınızla anında cep telefonunuza yansır.
              </p>
            </div>

            <div className="mobile-feat-card">
              <div className="feat-icon-box">
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
              <h4>AI Saha Asistanı</h4>
              <p>
                Yürürken 'Yakındaki en iyi espresso nerede?' diye sorun, rota çizginizi bozmadan en
                ideal kaçamak noktasını anında ekleyin.
              </p>
            </div>

            <div className="mobile-feat-card">
              <div className="feat-icon-box">
                <span className="material-symbols-outlined">share_location</span>
              </div>
              <h4>Canlı Gezgin Topluluğu</h4>
              <p>
                Rota kodunuzu (#RM-841) seyahat arkadaşlarınızla paylaşın, aynı harita üzerinde
                birbirinizin konumunu canlı takip edin.
              </p>
            </div>
          </div>
        </section>

        {/* Web Desk CTA Banner */}
        <section className="mobile-desk-cta-banner">
          <div className="desk-cta-inner">
            <h3>Şimdilik Web Harita Masasını Keşfedin</h3>
            <p>
              Mobil sürüm hazırlanırken, tarayıcınızdan harita masasını tam kapasiteyle
              kullanabilir, rotalarınızı oluşturup Google Maps veya Apple Haritalara GPX olarak
              aktarabilirsiniz.
            </p>
            <Link href="/maps/" className="desk-cta-btn">
              <span>Web Harita Masasını Aç</span>
              <span className="material-symbols-outlined">open_in_new</span>
            </Link>
          </div>
        </section>
      </main>

    </div>
  );
}
