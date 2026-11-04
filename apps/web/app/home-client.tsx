"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredSession } from "./lib/cognito";
import "./home.css";
import { MobileStart } from "./components/mobile-start";
import { PageHeader, PageShell } from "./components/ui";
import { FAQ_ITEMS, FAQ_ITEMS_EN, COMMUNITY_STORIES, COMMUNITY_POSTS } from "./features/landing";
import { useLocale } from "./lib/locale-context";

export default function Home() {
  const { t, isEnglish } = useLocale();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeHeroTab, setActiveHeroTab] = useState<"ai" | "desk" | "share">("desk");

  useEffect(() => {
    const session = getStoredSession();
    if (session?.token) {
      setIsLoggedIn(true);
      router.push("/maps/");
      return;
    }
  }, [router]);

  function handleDestinationSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = destinationQuery.trim();
    if (query) {
      router.push(`/travel-assistant/?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/travel-assistant/");
    }
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase().replace(/\s+/g, "");
    if (clean) {
      setCodeModalOpen(false);
      router.push(`/k/?kod=${encodeURIComponent(clean)}`);
    }
  }

  function openCodeModal() {
    setCodeModalOpen(true);
  }

  function closeCodeModal() {
    setCodeModalOpen(false);
  }

  const faqList = isEnglish ? FAQ_ITEMS_EN : FAQ_ITEMS;

  return (
    <PageShell layout="landing" className="home-container">
      {/* Tek h1 (AC-34): registry başlığı, görsel olarak gizli; masaüstü hero ve mobil başlangıç
          görünür başlıklarını kendi içinde taşır (mobilde masaüstü içerik display:none). */}
      <PageHeader variant="hidden" />
      <MobileStart />
      <div className="home-desktop-content">
        {/* ========================================================= */}
        {/* Hero Section — Story & Search Interface                    */}
        {/* ========================================================= */}
        <section className="home-hero">
          <div className="hero-ambient-glow-1" />
          <div className="hero-ambient-glow-2" />

          <div className="hero-grid">
            {/* Left Column: Story & Search Interface */}
            <div className="hero-left">
              {/* Tag Badge */}
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                <span className="hero-badge-text">{t("home.hero.badge")}</span>
              </div>

              {/* Main Display Headline */}
              <p className="hero-display">
                <>
                  {t("home.hero.headline1")}
                  <br />
                  <span className="hero-display-em">{t("home.hero.headline2")}</span>
                </>
              </p>

              {/* Subheading Description */}
              <p className="hero-sub">{t("home.hero.sub")}</p>

              {/* Smart Search & Prompt Bar */}
              <form className="hero-search-bar" onSubmit={handleDestinationSubmit}>
                <div className="hero-search-left">
                  <span className="material-symbols-outlined hero-search-icon" aria-hidden="true">
                    auto_awesome
                  </span>
                  <input
                    type="text"
                    className="hero-search-input"
                    placeholder={t("home.hero.searchPlaceholder")}
                    value={destinationQuery}
                    onChange={(e) => setDestinationQuery(e.target.value)}
                    aria-label={t("home.hero.searchLabel")}
                  />
                </div>
                <button type="submit" className="hero-search-btn" data-surface="inverse">
                  <span>{t("home.hero.generateRoute")}</span>
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                    style={{ fontSize: "1.125rem" }}
                  >
                    arrow_forward
                  </span>
                </button>
              </form>

              {/* Dual Action Buttons */}
              <div className="hero-actions">
                <a
                  href={isLoggedIn ? "/maps/" : "/register/"}
                  className="hero-btn-primary"
                  data-surface="inverse"
                >
                  <span>{isLoggedIn ? t("home.hero.goToDesk") : t("home.hero.startFree")}</span>
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                    style={{ fontSize: "1.125rem" }}
                  >
                    {isLoggedIn ? "map" : "bolt"}
                  </span>
                </a>
                <a href="#nasil-calisir" className="hero-btn-secondary">
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                    style={{ fontSize: "1.25rem", color: "var(--color-link)" }}
                  >
                    play_circle
                  </span>
                  <span>{t("home.hero.howItWorks")}</span>
                </a>
              </div>

              {/* Micro Feature Tags */}
              <div className="hero-trust-tags">
                <span className="hero-trust-tag">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                  {t("home.hero.noCreditCard")}
                </span>
                <span className="hero-trust-tag">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                  {t("home.hero.readyIn60")}
                </span>
                <span className="hero-trust-tag">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                  {t("home.hero.offlineSynced")}
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Route Product Mockup */}
            <div className="hero-right">
              <div className="hero-mockup-glow" data-surface="inverse" />
              <div className="hero-mockup">
                {/* Interactive Top Tab Switcher */}
                <div
                  className="hero-mockup-tabs"
                  role="tablist"
                  aria-label={t("home.hero.tabs.label")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHeroTab === "ai"}
                    className={`hero-mockup-tab ${activeHeroTab === "ai" ? "active" : ""}`}
                    onClick={() => setActiveHeroTab("ai")}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      psychology
                    </span>
                    <span>{t("home.hero.tabs.ai")}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHeroTab === "desk"}
                    className={`hero-mockup-tab ${activeHeroTab === "desk" ? "active" : ""}`}
                    onClick={() => setActiveHeroTab("desk")}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      map
                    </span>
                    <span>{t("home.hero.tabs.desk")}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeHeroTab === "share"}
                    className={`hero-mockup-tab ${activeHeroTab === "share" ? "active" : ""}`}
                    onClick={() => setActiveHeroTab("share")}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      qr_code_2
                    </span>
                    <span>{t("home.hero.tabs.share")}</span>
                  </button>
                </div>

                {/* View 1: AI Seyahat Asistanı (AWS Bedrock) */}
                {activeHeroTab === "ai" && (
                  <div className="mockup-chat-view">
                    <div className="mockup-chat-bubble-user" data-surface="inverse">
                      {t("home.mockup.ai.userPrompt")}
                    </div>

                    <div className="mockup-chat-bubble-ai">
                      <div className="mockup-ai-head">
                        <span className="mockup-ai-badge">
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{ fontSize: "0.875rem" }}
                          >
                            auto_awesome
                          </span>
                          {t("home.mockup.ai.bedrockBadge")}
                        </span>
                        <span className="mockup-sync-badge">
                          <span className="mockup-sync-dot" /> {t("home.mockup.ai.live")}
                        </span>
                      </div>
                      <p
                        className="mockup-ai-text"
                        dangerouslySetInnerHTML={{ __html: t("home.mockup.ai.text") }}
                      />

                      <div className="mockup-ai-features-row">
                        <span className="mockup-ai-feature-pill">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            verified
                          </span>
                          {t("home.mockup.ai.hoursVerified")}
                        </span>
                        <span className="mockup-ai-feature-pill">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            route
                          </span>
                          {t("home.mockup.ai.routeSaved")}
                        </span>
                        <span className="mockup-ai-feature-pill">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            check
                          </span>
                          {t("home.mockup.ai.noHallucinations")}
                        </span>
                      </div>

                      <div className="mockup-ai-plan-card">
                        <div>
                          <div className="mockup-ai-plan-title">
                            {t("home.mockup.ai.planTitle")}
                          </div>
                          <div className="mockup-ai-plan-meta">{t("home.mockup.ai.planMeta")}</div>
                        </div>
                        <span className="mockup-optimize-badge">{t("home.mockup.ai.ready")}</span>
                      </div>
                    </div>

                    <div className="mockup-actions">
                      <a
                        href="/travel-assistant/?q=Floransa%27da%203%20g%C3%BCn%20sanat%20ve%20kahve"
                        className="mockup-action-btn primary"
                        data-surface="inverse"
                      >
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: "1rem" }}
                        >
                          auto_awesome
                        </span>
                        {t("home.mockup.ai.openInAssistant")}
                      </a>
                      <button
                        type="button"
                        className="mockup-action-btn secondary"
                        onClick={() => setActiveHeroTab("desk")}
                      >
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: "1rem" }}
                        >
                          map
                        </span>
                        {t("home.mockup.ai.inspectOnMap")}
                      </button>
                    </div>
                  </div>
                )}

                {/* View 2: İnteraktif Harita Masası (Map Desk) */}
                {activeHeroTab === "desk" && (
                  <div>
                    {/* UI Header */}
                    <div className="mockup-header">
                      <div className="mockup-dots">
                        <span className="mockup-dot" />
                        <span className="mockup-dot" />
                        <span className="mockup-dot" />
                        <span className="mockup-title">{t("home.mockup.desk.title")}</span>
                      </div>
                      <span className="mockup-sync-badge">
                        <span className="mockup-sync-dot" /> {t("home.mockup.desk.offlineReady")}
                      </span>
                    </div>

                    {/* Day Selector Tabs */}
                    <div className="mockup-day-selector">
                      <span className="mockup-day-pill active" data-surface="inverse">
                        {t("home.mockup.desk.day1")}
                      </span>
                      <span className="mockup-day-pill">{t("home.mockup.desk.day2")}</span>
                      <span className="mockup-day-pill">{t("home.mockup.desk.day3")}</span>
                    </div>

                    {/* High-End Route Map Canvas */}
                    <div className="mockup-map">
                      <svg
                        className="mockup-map-svg"
                        viewBox="0 0 400 240"
                        fill="none"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M120,-20 C180,60 80,140 220,260"
                          fill="none"
                          opacity="0.8"
                          stroke="#dae2fd"
                          strokeLinecap="round"
                          strokeWidth="26"
                        />
                        <path
                          d="M0,80 L400,120 M40,0 L120,240 M280,0 L200,240 M20,180 L380,60"
                          opacity="0.6"
                          stroke="#ffffff"
                          strokeWidth="4"
                        />
                        <path
                          d="M310,130 C260,80 230,40 160,50 C110,60 100,150 70,170"
                          fill="none"
                          stroke="#10B981"
                          strokeDasharray="6 6"
                          strokeWidth="3"
                        />
                      </svg>
                      <div className="mockup-map-label">
                        <span className="mockup-map-label-dot" />
                        <span>{t("home.mockup.desk.mapLabel")}</span>
                      </div>
                      <div className="mockup-share-badge" data-surface="inverse">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          share
                        </span>{" "}
                        {t("home.mockup.desk.code")} <strong>RM-841</strong>
                      </div>

                      {/* Waypoints */}
                      <div className="mockup-waypoint" style={{ top: "105px", right: "48px" }}>
                        <div className="mockup-waypoint-marker" data-surface="inverse">
                          1
                        </div>
                        <span className="mockup-waypoint-label">
                          {t("home.mockup.desk.colosseum")}
                        </span>
                      </div>
                      <div
                        className="mockup-waypoint"
                        style={{ top: "28px", left: "50%", transform: "translateX(-50%)" }}
                      >
                        <div className="mockup-waypoint-marker" data-surface="inverse">
                          2
                        </div>
                        <span className="mockup-waypoint-label">Pantheon</span>
                      </div>
                      <div className="mockup-waypoint" style={{ bottom: "16px", left: "32px" }}>
                        <div className="mockup-waypoint-marker" data-surface="inverse">
                          3
                        </div>
                        <span className="mockup-waypoint-label">Trastevere</span>
                      </div>
                    </div>

                    {/* Itinerary Details */}
                    <div className="mockup-itinerary">
                      <div className="mockup-itinerary-header">
                        <div>
                          <h2 className="mockup-itinerary-title">
                            {t("home.mockup.desk.itineraryTitle")}
                          </h2>
                          <p className="mockup-itinerary-sub">
                            {t("home.mockup.desk.itinerarySub")}
                          </p>
                        </div>
                        <span className="mockup-optimize-badge">OSRM Optimize</span>
                      </div>

                      {/* Timeline Stops */}
                      <div className="mockup-timeline">
                        <div className="mockup-stop">
                          <span className="mockup-stop-dot" data-surface="inverse" />
                          <div className="mockup-stop-row">
                            <span className="mockup-stop-name">
                              {t("home.mockup.desk.stop1Name")}
                            </span>
                            <span className="mockup-stop-time">09:30</span>
                          </div>
                          <p className="mockup-stop-desc">{t("home.mockup.desk.stop1Desc")}</p>
                        </div>
                        <div className="mockup-stop">
                          <span className="mockup-stop-dot" data-surface="inverse" />
                          <div className="mockup-stop-row">
                            <span className="mockup-stop-name">
                              {t("home.mockup.desk.stop2Name")}
                            </span>
                            <span className="mockup-stop-time">13:15</span>
                          </div>
                          <p className="mockup-stop-desc">{t("home.mockup.desk.stop2Desc")}</p>
                        </div>
                        <div className="mockup-stop">
                          <span className="mockup-stop-dot" data-surface="inverse" />
                          <div className="mockup-stop-row">
                            <span className="mockup-stop-name">
                              {t("home.mockup.desk.stop3Name")}
                            </span>
                            <span className="mockup-stop-time">18:00</span>
                          </div>
                          <p className="mockup-stop-desc">{t("home.mockup.desk.stop3Desc")}</p>
                        </div>
                      </div>

                      <div className="mockup-actions">
                        <button
                          type="button"
                          className="mockup-action-btn primary"
                          data-surface="inverse"
                          onClick={openCodeModal}
                        >
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{ fontSize: "1rem" }}
                          >
                            qr_code
                          </span>
                          {t("home.mockup.desk.shareCode")}
                        </button>
                        <a
                          href={isLoggedIn ? "/maps/" : "/register/"}
                          className="mockup-action-btn secondary"
                        >
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                            style={{ fontSize: "1rem" }}
                          >
                            map
                          </span>
                          {t("home.mockup.desk.openMap")}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* View 3: 6 Haneli Kod ile Paylaşım (Zero-Install) */}
                {activeHeroTab === "share" && (
                  <div className="mockup-share-view">
                    <div className="mockup-share-hero">
                      <div className="mockup-share-hero-badge">
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: "0.875rem" }}
                        >
                          bolt
                        </span>
                        {t("home.mockup.share.badge")}
                      </div>
                      <div className="mockup-share-code-display">
                        <span>RM-841</span>
                      </div>
                      <p className="mockup-share-sub">{t("home.mockup.share.sub")}</p>
                    </div>

                    <div className="mockup-share-benefits">
                      <div className="mockup-share-benefit-item">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          send
                        </span>
                        <span>
                          <strong>{t("home.mockup.share.benefit1Title")}</strong>{" "}
                          {t("home.mockup.share.benefit1Desc")}
                        </span>
                      </div>
                      <div className="mockup-share-benefit-item">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          shield
                        </span>
                        <span>
                          <strong>{t("home.mockup.share.benefit2Title")}</strong>{" "}
                          {t("home.mockup.share.benefit2Desc")}
                        </span>
                      </div>
                      <div className="mockup-share-benefit-item">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          wifi_off
                        </span>
                        <span>
                          <strong>{t("home.mockup.share.benefit3Title")}</strong>{" "}
                          {t("home.mockup.share.benefit3Desc")}
                        </span>
                      </div>
                    </div>

                    <div className="mockup-actions">
                      <button
                        type="button"
                        className="mockup-action-btn primary"
                        data-surface="inverse"
                        onClick={openCodeModal}
                      >
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: "1rem" }}
                        >
                          vpn_key
                        </span>
                        {t("home.mockup.share.tryCode")}
                      </button>
                      <a href="#nasil-calisir" className="mockup-action-btn secondary">
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: "1rem" }}
                        >
                          help
                        </span>
                        {t("home.mockup.share.howItWorks")}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Social Proof & Trust Metrics Strip                         */}
        {/* ========================================================= */}
        <section className="trust-strip" aria-label={t("home.trust.label")}>
          <div className="trust-strip-inner">
            <div className="trust-strip-text">
              <span className="trust-strip-eyebrow">{t("home.trust.eyebrow")}</span>
              <h3 className="trust-strip-heading">{t("home.trust.heading")}</h3>
            </div>
            <div className="trust-metrics-grid">
              <div className="trust-metric">
                <div className="trust-metric-value">4</div>
                <div className="trust-metric-label">{t("home.trust.coreModules")}</div>
              </div>
              <div className="trust-metric">
                <div className="trust-metric-value">120+</div>
                <div className="trust-metric-label">{t("home.trust.countries")}</div>
              </div>
              <div className="trust-metric">
                <div className="trust-metric-value emerald">
                  60<span className="rating-frac">sn</span>
                </div>
                <div className="trust-metric-label">{t("home.trust.avgPlan")}</div>
              </div>
              <div className="trust-metric">
                <div className="trust-metric-value">%100</div>
                <div className="trust-metric-label">{t("home.trust.offlineReady")}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Platform Architecture / Bento Grid Features                */}
        {/* ========================================================= */}
        <section id="ozellikler" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="material-symbols-outlined" aria-hidden="true">
                widgets
              </span>
              <span>{t("home.features.eyebrow")}</span>
            </div>
            <h2 className="section-title">{t("home.features.title")}</h2>
            <p className="section-desc">{t("home.features.desc")}</p>
          </div>

          <div className="bento-grid">
            {/* Feature 1: AI Route Engine (7 Cols) */}
            <div className="bento-card bento-card-col7">
              <div
                className="bento-card-glow"
                style={{
                  background: "color-mix(in srgb, var(--color-accent-strong) 15%, transparent)",
                }}
              />
              <div>
                <div className="bento-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    psychology
                  </span>
                </div>
                <span className="bento-eyebrow">{t("home.feature1.eyebrow")}</span>
                <h3 className="bento-title">{t("home.feature1.title")}</h3>
                <p className="bento-desc">{t("home.feature1.desc")}</p>
              </div>
              <div className="bento-demo-box ai">
                <div className="bento-demo-badge">
                  <div className="bento-demo-avatar" data-surface="inverse">
                    AI
                  </div>
                  <div className="bento-demo-text">
                    <strong>{t("home.feature1.demoTitle")}</strong>
                    <span>{t("home.feature1.demoDesc")}</span>
                  </div>
                </div>
                <span className="bento-auto-badge">{t("home.feature1.badge")}</span>
              </div>
            </div>

            {/* Feature 2: Multi-day Map Desk & OSRM (5 Cols) */}
            <div className="bento-card bento-card-col5">
              <div
                className="bento-card-glow"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface-brand-soft) 25%, transparent)",
                }}
              />
              <div>
                <div className="bento-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    map
                  </span>
                </div>
                <span className="bento-eyebrow">{t("home.feature2.eyebrow")}</span>
                <h3 className="bento-title">{t("home.feature2.title")}</h3>
                <p className="bento-desc">{t("home.feature2.desc")}</p>
              </div>
              <div className="bento-demo-box">
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ color: "var(--color-text-accent)", fontSize: "1.625rem" }}
                >
                  route
                </span>
                <div className="bento-demo-text">
                  <strong>{t("home.feature2.demoTitle")}</strong>
                  <span>{t("home.feature2.demoDesc")}</span>
                </div>
              </div>
            </div>

            {/* Feature 3: 6-Digit Share Code (5 Cols) */}
            <div className="bento-card bento-card-col5">
              <div
                className="bento-card-glow"
                style={{
                  background: "color-mix(in srgb, var(--color-accent-strong) 15%, transparent)",
                }}
              />
              <div>
                <div className="bento-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    pin
                  </span>
                </div>
                <span className="bento-eyebrow">{t("home.feature3.eyebrow")}</span>
                <h3 className="bento-title">{t("home.feature3.title")}</h3>
                <p className="bento-desc">{t("home.feature3.desc")}</p>
              </div>
              <div className="bento-code-box">
                <div className="bento-code-digits">
                  <span className="bento-code-digit">7</span>
                  <span className="bento-code-digit">3</span>
                  <span className="bento-code-digit">X</span>
                  <span className="bento-code-digit">9</span>
                  <span className="bento-code-digit">2</span>
                  <span className="bento-code-digit">M</span>
                </div>
                <button type="button" className="bento-code-try" onClick={openCodeModal}>
                  {t("home.feature3.tryCode")}
                </button>
              </div>
            </div>

            {/* Feature 4: Privacy & Offline Mode (7 Cols) */}
            <div className="bento-card bento-card-col7">
              <div
                className="bento-card-glow"
                style={{ background: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
              />
              <div>
                <div className="bento-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    shield
                  </span>
                </div>
                <span className="bento-eyebrow">{t("home.feature4.eyebrow")}</span>
                <h3 className="bento-title">{t("home.feature4.title")}</h3>
                <p className="bento-desc">{t("home.feature4.desc")}</p>
              </div>
              <div className="bento-stats-grid">
                <div className="bento-stat">
                  <span className="bento-stat-label">{t("home.feature4.consent")}</span>
                  <span className="bento-stat-value emerald">
                    {t("home.feature4.consentValue")}
                  </span>
                </div>
                <div className="bento-stat">
                  <span className="bento-stat-label">{t("home.feature4.ttl")}</span>
                  <span className="bento-stat-value">{t("home.feature4.ttlValue")}</span>
                </div>
                <div className="bento-stat">
                  <span className="bento-stat-label">{t("home.feature4.offline")}</span>
                  <span className="bento-stat-value emerald">
                    {t("home.feature4.offlineValue")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* How It Works Section (4 Steps Flow)                        */}
        {/* ========================================================= */}
        <section id="nasil-calisir" className="section-wrapper-full">
          <div className="section-wrapper" style={{ paddingTop: "0", paddingBottom: "0" }}>
            <div className="section-header">
              <div className="section-eyebrow">
                <span className="material-symbols-outlined" aria-hidden="true">
                  timeline
                </span>
                <span>{t("home.howItWorks.eyebrow")}</span>
              </div>
              <h2 className="section-title">{t("home.howItWorks.title")}</h2>
              <p className="section-desc">{t("home.howItWorks.desc")}</p>
            </div>

            <div className="steps-grid-new">
              {/* Step 1 */}
              <div className="step-card-new">
                <div>
                  <div className="step-card-head">
                    <div className="step-number">1</div>
                    <div className="step-icon-badge">
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: "1.5rem" }}
                      >
                        chat
                      </span>
                    </div>
                  </div>
                  <h3>{t("home.step1.title")}</h3>
                  <p>{t("home.step1.desc")}</p>
                  <div className="step-preview-chip">
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{ fontSize: "1rem", color: "var(--color-text-accent)" }}
                    >
                      auto_awesome
                    </span>
                    <span>
                      {t("home.step1.chip")} <em>{t("home.step1.chipValue")}</em>
                    </span>
                  </div>
                </div>
                <div className="step-check">
                  <span className="step-check-tag">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      check_circle
                    </span>
                    <span>{t("home.step1.check")}</span>
                  </span>
                  <span className="material-symbols-outlined step-check-arrow" aria-hidden="true">
                    arrow_forward
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="step-card-new">
                <div>
                  <div className="step-card-head">
                    <div className="step-number">2</div>
                    <div className="step-icon-badge">
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: "1.5rem" }}
                      >
                        psychology
                      </span>
                    </div>
                  </div>
                  <h3>{t("home.step2.title")}</h3>
                  <p>{t("home.step2.desc")}</p>
                  <div className="step-preview-chip">
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{ fontSize: "1rem", color: "var(--color-text-accent)" }}
                    >
                      route
                    </span>
                    <span>
                      {t("home.step2.chip")}{" "}
                      <strong className="step-preview-code">{t("home.step2.chipValue")}</strong>
                    </span>
                  </div>
                </div>
                <div className="step-check">
                  <span className="step-check-tag">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      check_circle
                    </span>
                    <span>{t("home.step2.check")}</span>
                  </span>
                  <span className="material-symbols-outlined step-check-arrow" aria-hidden="true">
                    arrow_forward
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="step-card-new">
                <div>
                  <div className="step-card-head">
                    <div className="step-number">3</div>
                    <div className="step-icon-badge">
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: "1.5rem" }}
                      >
                        drag_indicator
                      </span>
                    </div>
                  </div>
                  <h3>{t("home.step3.title")}</h3>
                  <p>{t("home.step3.desc")}</p>
                  <div className="step-preview-chip">
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{ fontSize: "1rem", color: "var(--color-text-accent)" }}
                    >
                      touch_app
                    </span>
                    <span>
                      {t("home.step3.chip")} <strong>{t("home.step3.chipValue")}</strong>
                    </span>
                  </div>
                </div>
                <div className="step-check">
                  <span className="step-check-tag">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      check_circle
                    </span>
                    <span>{t("home.step3.check")}</span>
                  </span>
                  <span className="material-symbols-outlined step-check-arrow" aria-hidden="true">
                    arrow_forward
                  </span>
                </div>
              </div>

              {/* Step 4 */}
              <div className="step-card-new">
                <div>
                  <div className="step-card-head">
                    <div className="step-number">4</div>
                    <div className="step-icon-badge">
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: "1.5rem" }}
                      >
                        qr_code_2
                      </span>
                    </div>
                  </div>
                  <h3>{t("home.step4.title")}</h3>
                  <p>{t("home.step4.desc")}</p>
                  <div className="step-preview-chip">
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{ fontSize: "1rem", color: "var(--color-text-accent)" }}
                    >
                      pin
                    </span>
                    <span>
                      {t("home.step4.chip")}{" "}
                      <strong className="step-preview-code">{t("home.step4.chipValue")}</strong>
                    </span>
                  </div>
                </div>
                <div className="step-check">
                  <span className="step-check-tag">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      check_circle
                    </span>
                    <span>{t("home.step4.check")}</span>
                  </span>
                  <span className="material-symbols-outlined step-check-arrow" aria-hidden="true">
                    arrow_forward
                  </span>
                </div>
              </div>
            </div>

            <div className="nasil-guide-link-wrap">
              <a href="/how-it-works/" className="nasil-guide-link-btn">
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: "1.25rem", color: "var(--color-text-accent)" }}
                >
                  menu_book
                </span>
                <span>{t("home.howItWorks.guideLink")}</span>
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: "1.125rem" }}
                >
                  arrow_forward
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Comparison / Why MapsBridge Section                        */}
        {/* ========================================================= */}
        <section id="neden-mapsbridge" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="material-symbols-outlined" aria-hidden="true">
                compare_arrows
              </span>
              <span>{t("home.comparison.eyebrow")}</span>
            </div>
            <h2 className="section-title">{t("home.comparison.title")}</h2>
            <p className="section-desc">{t("home.comparison.desc")}</p>
          </div>

          <div className="comparison-card">
            <div className="comparison-grid">
              {/* Traditional Side */}
              <div className="comparison-col traditional">
                <div>
                  <div className="comparison-col-header">
                    <span className="comparison-badge error">✕</span>
                    <h3>{t("home.comparison.traditionalTitle")}</h3>
                  </div>
                  <p className="comparison-desc">{t("home.comparison.traditionalDesc")}</p>
                  <ul className="comparison-list">
                    <li>
                      <span className="material-symbols-outlined error-icon" aria-hidden="true">
                        cancel
                      </span>
                      <span>{t("home.comparison.traditional1")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined error-icon" aria-hidden="true">
                        cancel
                      </span>
                      <span>{t("home.comparison.traditional2")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined error-icon" aria-hidden="true">
                        cancel
                      </span>
                      <span>{t("home.comparison.traditional3")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined error-icon" aria-hidden="true">
                        cancel
                      </span>
                      <span>{t("home.comparison.traditional4")}</span>
                    </li>
                  </ul>
                </div>
                <div className="comparison-footer">
                  {t("home.comparison.traditionalFooter")}{" "}
                  <strong>{t("home.comparison.traditionalTime")}</strong>
                </div>
              </div>

              {/* MapsBridge Side */}
              <div className="comparison-col mapsbridge">
                <div>
                  <div className="comparison-col-header">
                    <span className="comparison-badge success">✓</span>
                    <h3>{t("home.comparison.mbTitle")}</h3>
                  </div>
                  <p className="comparison-desc">{t("home.comparison.mbDesc")}</p>
                  <ul className="comparison-list">
                    <li>
                      <span className="material-symbols-outlined success-icon" aria-hidden="true">
                        check_circle
                      </span>
                      <span>{t("home.comparison.mb1")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined success-icon" aria-hidden="true">
                        check_circle
                      </span>
                      <span>{t("home.comparison.mb2")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined success-icon" aria-hidden="true">
                        check_circle
                      </span>
                      <span>{t("home.comparison.mb3")}</span>
                    </li>
                    <li>
                      <span className="material-symbols-outlined success-icon" aria-hidden="true">
                        check_circle
                      </span>
                      <span>{t("home.comparison.mb4")}</span>
                    </li>
                  </ul>
                </div>
                <div className="comparison-footer mapsbridge">
                  {t("home.comparison.mbFooter")} <strong>{t("home.comparison.mbTime")}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* Canlı Gezgin Topluluğu — Seyahat Sosyal Ağı                  */}
        {/* ========================================================= */}
        <section id="kullanici-yorumlari" className="section-wrapper-full community-section">
          <div className="section-wrapper" style={{ paddingTop: "0", paddingBottom: "0" }}>
            <div className="section-header">
              <div className="section-eyebrow community-eyebrow">
                <span className="community-eyebrow-dot" />
                <span>{t("home.community.eyebrow")}</span>
              </div>
              <h2 className="section-title">{t("home.community.title")}</h2>
              <p className="section-desc">{t("home.community.desc")}</p>
            </div>

            {/* Stories / Active Travel Avatars Bar */}
            <div className="community-stories-bar">
              <div className="community-stories-track">
                {/* Story 1: Add Story / Share */}
                <div className="community-story-item">
                  <div className="community-story-add">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      add_a_photo
                    </span>
                  </div>
                  <span className="community-story-name">{t("home.community.shareTrip")}</span>
                  <span className="community-story-tag">{t("home.community.newRoute")}</span>
                </div>

                {/* Story Avatars */}
                {COMMUNITY_STORIES.map((story) => (
                  <div key={story.initials} className="community-story-item">
                    <div
                      className={`community-story-ring ${story.gradient ? "gradient" : "plain"}`}
                      data-surface={story.gradient ? "inverse" : undefined}
                    >
                      <div
                        className={`community-story-avatar ${story.live ? "has-live-dot" : ""}`}
                        data-surface="inverse"
                      >
                        {story.initials}
                      </div>
                    </div>
                    <span className="community-story-name">{story.name}</span>
                    <span className={`community-story-tag ${story.live ? "live" : ""}`}>
                      {story.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Post Cards Feed Grid */}
            <div className="community-posts-grid">
              {COMMUNITY_POSTS.map((post) => (
                <div key={post.code} className="community-post-card">
                  <div className="community-post-body">
                    {/* Author Header */}
                    <div className="community-post-author">
                      <div className="community-post-author-left">
                        <div className="community-post-avatar-wrap">
                          <div
                            className={`community-post-avatar ${post.avatarClass}`}
                            data-surface={
                              post.avatarClass === "community-avatar-primary"
                                ? "inverse"
                                : undefined
                            }
                          >
                            {post.initials}
                          </div>
                          {post.live && <span className="community-post-live-dot" />}
                        </div>
                        <div>
                          <div className="community-post-name-row">
                            <h4 className="community-post-name">{post.name}</h4>
                            <span
                              className="material-symbols-outlined community-verified"
                              aria-hidden="true"
                            >
                              verified
                            </span>
                          </div>
                          <div className="community-post-meta">
                            <span>{post.handle}</span>
                            <span>·</span>
                            <span>{post.time}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className="community-post-more"
                        type="button"
                        aria-label={t("home.community.more")}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          more_horiz
                        </span>
                      </button>
                    </div>

                    {/* Location Tag */}
                    <div className="community-location-tag">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        location_on
                      </span>
                      <span>{post.location}</span>
                    </div>

                    {/* Caption */}
                    <p className="community-post-caption">{post.caption}</p>

                    {/* Attached Interactive Route Pill */}
                    <div className="community-route-pill">
                      <div className="community-route-pill-left">
                        <span
                          className="material-symbols-outlined community-route-icon"
                          aria-hidden="true"
                        >
                          {post.routeIcon}
                        </span>
                        <div className="community-route-text">
                          <div className="community-route-title">{post.routeTitle}</div>
                          <div
                            className={`community-route-sub ${post.routeSub.includes("%") ? "budget" : ""}`}
                          >
                            {post.routeSub}
                          </div>
                        </div>
                      </div>
                      <div className="community-route-code" data-surface="inverse">
                        {post.code}
                      </div>
                    </div>
                  </div>

                  {/* Post Footer: Engagement Counts & Action Buttons */}
                  <div className="community-post-footer">
                    <div className="community-post-engagement">
                      <button
                        type="button"
                        className="community-engagement-btn like"
                        aria-label={`${post.likes} beğeni`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          favorite
                        </span>
                        <span className="community-engagement-count">{post.likes}</span>
                      </button>
                      <button
                        type="button"
                        className="community-engagement-btn"
                        aria-label={`${post.comments} yorum`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          chat_bubble
                        </span>
                        <span>{post.comments}</span>
                      </button>
                    </div>
                    <button type="button" className="community-post-action" onClick={openCodeModal}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {post.actionIcon}
                      </span>
                      <span>{t("home.community.openRoute")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Social Metrics & Engagement Bar */}
            <div className="community-engagement-bar">
              <div className="community-engagement-left">
                <div className="community-avatar-stack">
                  <span className="community-stack-avatar stack-primary" data-surface="inverse">
                    ED
                  </span>
                  <span className="community-stack-avatar stack-secondary">CY</span>
                  <span className="community-stack-avatar stack-tertiary">MK</span>
                  <span className="community-stack-avatar stack-more">+8K</span>
                </div>
                <div>
                  <div className="community-engagement-title">{t("home.community.joinTitle")}</div>
                  <div className="community-engagement-sub">{t("home.community.joinSub")}</div>
                </div>
              </div>
              <div className="community-engagement-actions">
                <a
                  href={isLoggedIn ? "/travel-assistant/" : "/register/"}
                  className="community-share-btn"
                  data-surface="inverse"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add_circle
                  </span>
                  <span>{t("home.community.shareRoute")}</span>
                </a>
                <button type="button" className="community-code-btn" onClick={openCodeModal}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    pin
                  </span>
                  <span>{t("home.community.exploreWithCode")}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FAQ (Sıkça Sorulan Sorular) Section                        */}
        {/* ========================================================= */}
        <section id="sss" className="section-wrapper">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="material-symbols-outlined" aria-hidden="true">
                help
              </span>
              <span>{t("home.faq.eyebrow")}</span>
            </div>
            <h2 className="section-title">{t("home.faq.title")}</h2>
            <p className="section-desc">{t("home.faq.desc")}</p>
          </div>

          <div className="faq-container">
            {faqList.map((item, idx) => (
              <details key={idx} className="faq-item" open={idx === 0}>
                <summary className="faq-question">
                  <span>{item.q}</span>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    expand_more
                  </span>
                </summary>
                <p className="faq-answer">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* Final Conversion CTA Section                                */}
        {/* ========================================================= */}
        <section className="cta-section" id="kayit">
          <div className="cta-card" data-surface="inverse">
            <div className="cta-glow-1" />
            <div className="cta-glow-2" />
            <div className="cta-inner">
              <div className="cta-text">
                <div className="cta-badge">
                  <span className="cta-badge-dot" />
                  <span>{t("home.cta.badge")}</span>
                </div>
                <h2 className="cta-title">{t("home.cta.title")}</h2>
                <p className="cta-desc">{t("home.cta.desc")}</p>
              </div>
              <div className="cta-actions">
                <a
                  href={isLoggedIn ? "/travel-assistant/" : "/register/"}
                  className="cta-btn-primary"
                >
                  <span>{isLoggedIn ? t("home.cta.planWithAi") : t("home.cta.startRoute")}</span>
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                    style={{ fontSize: "1.25rem" }}
                  >
                    arrow_forward
                  </span>
                </a>
                <button type="button" className="cta-btn-secondary" onClick={openCodeModal}>
                  <span>{t("home.cta.enterCode")}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      {/* ========================================================= */}
      {/* 6-Digit Code Verification Floating Sheet / Modal            */}
      {/* ========================================================= */}
      <div
        className={`code-modal-overlay ${codeModalOpen ? "open" : ""}`}
        data-surface="inverse"
        id="code-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("home.codeModal.label")}
      >
        <div className="code-modal" data-surface="default">
          <button
            className="code-modal-close"
            onClick={closeCodeModal}
            type="button"
            aria-label={t("home.codeModal.close")}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{ fontSize: "1.125rem" }}
            >
              close
            </span>
          </button>
          <div className="code-modal-icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              vpn_key
            </span>
          </div>
          <h3>{t("home.codeModal.title")}</h3>
          <p>{t("home.codeModal.desc")}</p>
          <form onSubmit={handleLookup}>
            <div className="code-inputs">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  className="code-input"
                  type="text"
                  maxLength={1}
                  value={code[i] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    const next = code.split("");
                    next[i] = val;
                    setCode(next.join(""));
                    if (val && i < 5) {
                      const nextInput =
                        document.querySelectorAll<HTMLInputElement>(".code-input")[i + 1];
                      nextInput?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !code[i] && i > 0) {
                      const prevInput =
                        document.querySelectorAll<HTMLInputElement>(".code-input")[i - 1];
                      prevInput?.focus();
                    }
                  }}
                  aria-label={`${t("home.codeModal.charLabel")} ${i + 1}`}
                />
              ))}
            </div>
            <button type="submit" className="code-modal-submit" data-surface="inverse">
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: "1.125rem" }}
              >
                map
              </span>
              <span>{t("home.codeModal.submit")}</span>
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
