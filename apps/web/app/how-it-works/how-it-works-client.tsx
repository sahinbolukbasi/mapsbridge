"use client";

import { useState } from "react";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import "./how-it-works.css";

export function HowItWorksClient() {
  const [selectedPrompt, setSelectedPrompt] = useState("3 Günlük Floransa Rönesans & Sanat Gezisi");
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const samplePrompts = [
    "3 Günlük Floransa Rönesans & Sanat Gezisi",
    "Tokyo 4 Gün Metropol & Otantik Ramen Durakları",
    "Kapadokya 2 Gün Balon & Vadi Fotoğrafçılığı",
    "Paris 5 Gün Butik Kafe & Sanat Galerileri",
  ];

  function copySampleCode() {
    navigator.clipboard?.writeText("RM-841");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="nasil-page">
      <div className="nasil-ambient-glow-1" />
      <HeaderNav />

      <main>
        {/* ── Hero ── */}
        <section className="nasil-hero">
          <div className="nasil-container">
            <div className="nasil-hero-badge">
              <span className="nasil-hero-badge-dot" />
              <span>Sistem Rehberi &amp; Canlı Akış</span>
            </div>

            <h1 className="nasil-hero-title">
              MapsBridge <span className="nasil-hero-highlight">Nasıl Çalışır?</span>
            </h1>

            <p className="nasil-hero-desc">
              Hayal ettiğiniz seyahati saniyeler içinde baştan uca optimize edilmiş bir rotaya
              dönüştürün. Yapay zeka planlamasından canlı haritaya, 6 haneli kod paylaşımından
              çevrimdışı GPS navigasyonuna tüm süreç 4 yalın adımda parmaklarınızın ucunda.
            </p>

            <div className="nasil-hero-actions">
              <a href="/register/" className="nasil-btn-primary">
                <span>Ücretsiz Rotanı Başlat</span>
                <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>
                  bolt
                </span>
              </a>
              <a href="#adımlar" className="nasil-btn-secondary">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "1.25rem", color: "#10b981" }}
                >
                  play_circle
                </span>
                <span>Adım Adım İncele</span>
              </a>
            </div>

            {/* Metrics Strip */}
            <div className="nasil-metrics-strip">
              <div className="nasil-metric-box">
                <div className="nasil-metric-val">60 sn</div>
                <div className="nasil-metric-lbl">Ortalama Plan Süresi</div>
              </div>
              <div className="nasil-metric-box">
                <div className="nasil-metric-val">-%38</div>
                <div className="nasil-metric-lbl">Yol &amp; Yürüme Tasarrufu</div>
              </div>
              <div className="nasil-metric-box">
                <div className="nasil-metric-val">6 Hane</div>
                <div className="nasil-metric-lbl">Tek Tıkla Rota Paylaşımı</div>
              </div>
              <div className="nasil-metric-box">
                <div className="nasil-metric-val">%100</div>
                <div className="nasil-metric-lbl">Çevrimdışı Harita Erişimi</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4-Step Detailed Walkthrough ── */}
        <section id="adımlar" className="nasil-steps-section">
          <div className="nasil-container">
            <div className="nasil-section-head">
              <div className="nasil-section-eyebrow">
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem" }}>
                  timeline
                </span>
                <span>Uçtan Uca Seyahat Kurgusu</span>
              </div>
              <h2 className="nasil-section-title">4 Adımda Akıllı Gezi Mimarisi</h2>
              <p className="nasil-section-desc">
                Karmaşık not defterleri, dağınık ekran görüntüleri ve birbirine uzak pencereler
                yerine tek merkezli, akıllı akış.
              </p>
            </div>

            {/* STEP 1 */}
            <div className="nasil-step-row">
              <div className="nasil-step-info">
                <div className="nasil-step-badge-num">1</div>
                <h3 className="nasil-step-h3">Nereye &amp; Nasıl İstediğinizi Yazın</h3>
                <p className="nasil-step-desc">
                  İster tek cümlelik bir hayal girin ("Floransa'da 3 gün sanat ve kahve"), ister
                  bütçe, günlük yürüme temposu ve ilgi alanlarınızı seçin. MapsBridge doğal dil
                  işleme motoru seyahat amacınızı tam olarak analiz eder.
                </p>
                <ul className="nasil-step-features">
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Serbest Doğal Dil:</strong> Karmaşık formlar doldurmadan dilediğiniz
                      dilde hedef belirtin.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>İlgi Alanı Filtreleri:</strong> Gastronomi, tarih, fotoğrafçılık, doğa
                      veya gece hayatı profilleri.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Bütçe ve Gün Esnekliği:</strong> Sırt çantalı gezginden lüks butik
                      seyahatlere kişiye özel öneriler.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="nasil-step-visual">
                <div className="nasil-mockup-header">
                  <div className="nasil-mockup-dots">
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                  </div>
                  <span className="nasil-mockup-tag">01 · Akıllı Giriş</span>
                </div>

                <div className="nasil-interactive-prompt-box">
                  <div className="nasil-interactive-input-row">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#10b981", fontSize: "1.25rem" }}
                    >
                      auto_awesome
                    </span>
                    <strong style={{ fontSize: "0.875rem" }}>{selectedPrompt}</strong>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Hazır Örneklerden Birini Seçin:
                </span>
                <div className="nasil-prompt-chips-row">
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="nasil-prompt-chip"
                      onClick={() => setSelectedPrompt(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="nasil-step-row reverse">
              <div className="nasil-step-info">
                <div className="nasil-step-badge-num">2</div>
                <h3 className="nasil-step-h3">Yapay Zekâ Motoru Rotanızı Çizsin</h3>
                <p className="nasil-step-desc">
                  Müzelerin açılış-kapanış saatleri, duraklar arası en kısa yürüme mesafeleri,
                  popüler kafeler ve öğle yemeği molaları tek bir optimize akışta buluşur. Günde
                  10-15 km gereksiz zikzaklar çizmek tarihe karışır.
                </p>
                <ul className="nasil-step-features">
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Mesafe ve Sıralama Optimizasyonu:</strong> En mantıklı coğrafi sırayla
                      durak dizilimi.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Açılış Saatleri Koruması:</strong> Kapalı kapılara çarpıp plan
                      değiştirmek zorunda kalmazsınız.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Dengeli Günlük Süre:</strong> Günlük 5-7 saatlik ideal yorulma temposu
                      hesaplanır.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="nasil-step-visual">
                <div className="nasil-mockup-header">
                  <div className="nasil-mockup-dots">
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                  </div>
                  <span className="nasil-mockup-tag">02 · AI Optimizasyonu</span>
                </div>

                <div className="nasil-route-timeline">
                  <div className="nasil-timeline-item">
                    <div className="nasil-timeline-left">
                      <span className="nasil-timeline-badge">1</span>
                      <div>
                        <strong>Kolezyum &amp; Antik Forum</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Sıra beklemeden giriş
                        </div>
                      </div>
                    </div>
                    <span className="nasil-timeline-time">09:30</span>
                  </div>

                  <div className="nasil-timeline-item">
                    <div className="nasil-timeline-left">
                      <span className="nasil-timeline-badge">2</span>
                      <div>
                        <strong>Sant'Eustachio Kahve Molası</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Tarihi yerel mola · 400m
                        </div>
                      </div>
                    </div>
                    <span className="nasil-timeline-time">12:45</span>
                  </div>

                  <div className="nasil-timeline-item">
                    <div className="nasil-timeline-left">
                      <span className="nasil-timeline-badge">3</span>
                      <div>
                        <strong>Pantheon Meydanı</strong>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Giriş &amp; mimari tur
                        </div>
                      </div>
                    </div>
                    <span className="nasil-timeline-time">14:15</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="nasil-step-row">
              <div className="nasil-step-info">
                <div className="nasil-step-badge-num">3</div>
                <h3 className="nasil-step-h3">Harita Masasında Canlı Özelleştirin</h3>
                <p className="nasil-step-desc">
                  AI tarafından çizilen rota sadece bir öneridir; kontrol tamamen sizdedir.
                  İnteraktif harita masasında durakları sürükleyip bırakabilir, otel rezervasyon
                  notlarınızı ekleyebilir ve yeni pinler bırakabilirsiniz.
                </p>
                <ul className="nasil-step-features">
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Sürükle &amp; Bırak Sıralama:</strong> Durakların sırasını tek
                      hamleyle güncelleyin.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Özel Notlar &amp; Bilet Kodları:</strong> Rezervasyon saatleri ve
                      bilet PDF referansları ekleyin.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Google Maps Senkronu:</strong> Harita üzerinde anlık mesafe ve süre
                      hesaplama.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="nasil-step-visual">
                <div className="nasil-mockup-header">
                  <div className="nasil-mockup-dots">
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                  </div>
                  <span className="nasil-mockup-tag">03 · Harita Stüdyosu</span>
                </div>

                <div className="nasil-pin-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#94a3b8", fontSize: "1.125rem" }}
                    >
                      drag_indicator
                    </span>
                    <strong>1. Gün Otel Çıkışı ➔ Trastevere</strong>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>
                    Sabit Durak
                  </span>
                </div>

                <div className="nasil-pin-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#94a3b8", fontSize: "1.125rem" }}
                    >
                      drag_indicator
                    </span>
                    <strong>Trattoria da Enzo (Akşam Yemeği)</strong>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>
                    20:00 Rez
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    background: "rgba(16, 185, 129, 0.08)",
                    borderRadius: "0.75rem",
                    fontSize: "0.78125rem",
                    color: "#047857",
                  }}
                >
                  💡 <strong>İpucu:</strong> Haritada istediğiniz bir noktaya çift tıklayarak anında
                  kendi gizli noktanızı rotaya ekleyin.
                </div>
              </div>
            </div>

            {/* STEP 4 */}
            <div className="nasil-step-row reverse">
              <div className="nasil-step-info">
                <div className="nasil-step-badge-num">4</div>
                <h3 className="nasil-step-h3">6 Haneli Kodla Cebinize Alın &amp; Paylaşın</h3>
                <p className="nasil-step-desc">
                  Uygulama indirme zorunluluğu yok, uzun üyelik formları yok. Tek bir 6 haneli kod
                  üretilir (ör: <strong>RM-841</strong>). Bu kodu arkadaşlarınıza SMS veya WhatsApp
                  ile ilettiğinizde, tüm gezi grubu tek tıkla rotayı cihazında canlı açar.
                </p>
                <ul className="nasil-step-features">
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>6 Haneli Rota Kodu:</strong> SMS, WhatsApp veya sözlü olarak anında
                      aktarılabilir.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Çevrimdışı Senkronizasyon:</strong> Yurt dışında internet paketiniz
                      bitse bile rota cihazınızda çalışır.
                    </span>
                  </li>
                  <li className="nasil-step-feature-item">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>
                      <strong>Canlı Grup Takibi:</strong> Gruptaki herkes aynı durak sırasını ve
                      saatleri görür.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="nasil-step-visual">
                <div className="nasil-mockup-header">
                  <div className="nasil-mockup-dots">
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                    <span className="nasil-mockup-dot" />
                  </div>
                  <span className="nasil-mockup-tag">04 · Anında Paylaşım</span>
                </div>

                <div className="nasil-code-demo-box">
                  <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                    Örnek Roma Gezi Kodu
                  </span>
                  <div className="nasil-code-display">
                    <span className="nasil-code-digit-box">R</span>
                    <span className="nasil-code-digit-box">M</span>
                    <span className="nasil-code-digit-box">-</span>
                    <span className="nasil-code-digit-box">8</span>
                    <span className="nasil-code-digit-box">4</span>
                    <span className="nasil-code-digit-box">1</span>
                  </div>
                  <button
                    type="button"
                    className="nasil-btn-primary"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      fontSize: "0.875rem",
                      padding: "0.75rem",
                    }}
                    onClick={copySampleCode}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                      {copiedCode ? "check" : "content_copy"}
                    </span>
                    <span>{copiedCode ? "Kod Kopyalandı!" : "Kodu Kopyala & Dene"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Rota ve Topluluk Katmanı ── */}
        <section className="nasil-creator-section">
          <div className="nasil-container">
            <div className="nasil-section-head">
              <div className="nasil-section-eyebrow">
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem" }}>
                  smart_toy
                </span>
                <span>AI Agentic Otomasyon &amp; Topluluk</span>
              </div>
              <h2 className="nasil-section-title">
                AI ile Rota Planlama &amp; Gezi Arkadaşı Eşleşmesi
              </h2>
              <p className="nasil-section-desc">
                Kendi bulduğunuz mekanları ekleyin, AI agent&apos;ları durakları zenginleştirip en
                verimli rotayı hesaplasın; tek tıkla Google Maps&apos;e aktarın ve gezi arkadaşları
                bulun.
              </p>
            </div>

            <div className="nasil-creator-grid">
              <div className="nasil-creator-card">
                <span className="nasil-creator-icon">📍</span>
                <h4>1. Kendi Keşiflerini Ekle</h4>
                <p>
                  Kafeleri, restoranları, tarihi ve doğal alanları ekle. Veri zenginleştirme
                  agent&apos;ı konum ve süre meta verilerini tamamlasın.
                </p>
              </div>

              <div className="nasil-creator-card">
                <span className="nasil-creator-icon">✨</span>
                <h4>2. AI ile Doğal Dilde Düzenle</h4>
                <p>
                  &quot;Kahvaltı molası ekle&quot;, &quot;Tarihi yerleri öne al&quot; gibi doğal dil
                  komutlarıyla rotanı versiyonlayarak anında güncelle.
                </p>
              </div>

              <div className="nasil-creator-card">
                <span className="nasil-creator-icon">🧭</span>
                <h4>3. Google Maps &amp; Gezi Arkadaşı</h4>
                <p>
                  Tüm durak sıralamasını koruyarak tek tıkla Google Maps navigasyonuna aktar; ortak
                  ilgi uyumuna göre toplulukta gezi arkadaşı bul.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ Section ── */}
        <section className="nasil-faq-section">
          <div className="nasil-container">
            <div className="nasil-section-head">
              <div className="nasil-section-eyebrow">
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem" }}>
                  help
                </span>
                <span>Merak Edilenler</span>
              </div>
              <h2 className="nasil-section-title">Sıkça Sorulan Sorular</h2>
              <p className="nasil-section-desc">
                MapsBridge işleyişi hakkında gezginlerin en çok merak ettiği soruların net
                cevapları.
              </p>
            </div>

            <div className="nasil-faq-list">
              <details className="nasil-faq-item" open>
                <summary className="nasil-faq-question">
                  <span>İnternet bağlantım olmadan rotayı kullanabilir miyim?</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </summary>
                <p className="nasil-faq-answer">
                  Evet! Rotanızı oluşturduktan sonra tek tıkla 'Çevrimdışı Modu'
                  etkinleştirebilirsiniz. Yurt dışında hücresel veri olmadan dahi GPS koordinatları,
                  durak sıralamaları ve notlarınız telefonunuzda kesintisiz çalışır.
                </p>
              </details>

              <details className="nasil-faq-item">
                <summary className="nasil-faq-question">
                  <span>6 Haneli kod ile arkadaşlarım hesap açmadan görebilir mi?</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </summary>
                <p className="nasil-faq-answer">
                  Kesinlikle. Arkadaşınız ana sayfadaki '6 Haneli Kod Gir' kutusuna şifreyi
                  yazdığında hiçbir hesap açma veya şifre belirleme adımı olmadan harita canlı
                  olarak açılır.
                </p>
              </details>

              <details className="nasil-faq-item">
                <summary className="nasil-faq-question">
                  <span>MapsBridge'i kullanmak ücretli mi?</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </summary>
                <p className="nasil-faq-answer">
                  Hayır, MapsBridge'in yapay zeka ile rota üretme, harita üzerinde düzenleme ve 6
                  haneli kodla paylaşma gibi temel özellikleri tamamen ücretsizdir. Kredi kartı
                  girmeden anında başlayabilirsiniz.
                </p>
              </details>

              <details className="nasil-faq-item">
                <summary className="nasil-faq-question">
                  <span>Oluşturduğum rotayı seyahat sırasında değiştirebilir miyim?</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </summary>
                <p className="nasil-faq-answer">
                  Elbette! Seyahatiniz esnasında hava durumu veya keyfinize göre harita masasında
                  durak sırasını değiştirebilir, yeni yerler ekleyebilir veya çıkarabilirsiniz.
                  Yapılan değişiklikler aynı koda sahip tüm cihazlara anında yansır.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="nasil-cta-section">
          <div className="nasil-container">
            <div className="nasil-cta-card">
              <h2 className="nasil-cta-title">
                Bir sonraki seyahatinizi dakikalar içinde planlayın.
              </h2>
              <p className="nasil-cta-sub">
                Hayalinizdeki şehri yazın; MapsBridge rotanızı optimize etsin, arkadaşlarınızla
                paylaşın ve keyifle yola çıkın.
              </p>
              <a href="/register/" className="nasil-cta-btn">
                <span>Ücretsiz Rotanı Başlat</span>
                <span className="material-symbols-outlined" style={{ fontSize: "1.25rem" }}>
                  arrow_forward
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export { HowItWorksClient as NasilClient };
