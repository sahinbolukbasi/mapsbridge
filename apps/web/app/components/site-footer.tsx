"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./site-footer.css";
import { useLocale } from "../lib/locale-context";

const APP_STORE_URL = "https://apps.apple.com/app/mapsbridge/id6743820738";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.mapsbridge.mobile";

export function SiteFooter() {
  const [_mounted, setMounted] = useState(false);
  const { t, isEnglish } = useLocale();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <footer className="global-site-footer">
      <div className="global-footer-inner">
        <div className="global-footer-grid">
          {/* Brand & Tagline */}
          <div className="global-footer-brand-col">
            <Link href="/" className="global-footer-brand-link" prefetch={false}>
              <div className="global-footer-brand-icon">
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  explore
                </span>
              </div>
              <span className="global-footer-brand-title">
                Maps<span className="global-footer-brand-emerald">Bridge</span>
              </span>
            </Link>
            <p className="global-footer-tagline">{t("footer.tagline")}</p>
            <div className="global-footer-status">
              <span className="global-footer-status-dot"></span>
              <span>{t("footer.systemStatus")}</span>
            </div>

            {/* Mobil Uygulama İndirme Linkleri */}
            <div className="global-footer-app-links">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="global-footer-app-title">{t("footer.downloadApp")}</span>
              </div>
              <div className="global-footer-app-buttons">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="global-footer-app-btn app-store"
                  aria-label={t("footer.appStore")}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="app-icon">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.08-3.11-1.05.05-2.31.7-3.06 1.55-.67.76-1.26 1.98-1.1 3.09 1.17.09 2.37-.74 3.08-1.53z" />
                  </svg>
                  <div className="app-btn-text">
                    <span className="app-btn-small">{t("footer.appStoreSmall")}</span>
                    <span className="app-btn-large">App Store</span>
                  </div>
                </a>
                <a
                  href={GOOGLE_PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="global-footer-app-btn google-play"
                  aria-label={t("footer.googlePlay")}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="app-icon">
                    <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m5.63-2.54L16.5 12l2.97-2.97 2.12 1.21c.63.36.63 1.26 0 1.62M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
                  </svg>
                  <div className="app-btn-text">
                    <span className="app-btn-small">{t("footer.googlePlaySmall")}</span>
                    <span className="app-btn-large">Google Play</span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Nav Links Grid */}
          <div className="global-footer-links-col">
            <div>
              <span className="global-footer-group-title">{t("footer.product")}</span>
              <ul className="global-footer-links">
                <li>
                  <Link href={isEnglish ? "/en/" : "/"} prefetch={false}>
                    {t("footer.explore")}
                  </Link>
                </li>
                <li>
                  <Link href="/maps/" prefetch={false}>
                    {t("footer.mapDesk")}
                  </Link>
                </li>
                <li>
                  <Link href="/travel-assistant/" prefetch={false}>
                    {t("footer.aiAssistant")}
                  </Link>
                </li>
                <li>
                  <Link href="/community/" prefetch={false}>
                    {t("footer.community")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <span className="global-footer-group-title">{t("footer.resources")}</span>
              <ul className="global-footer-links">
                <li>
                  <Link href="/how-it-works/" prefetch={false}>
                    {t("footer.howItWorks")}
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" prefetch={false}>
                    {t("footer.faq")}
                  </Link>
                </li>
                <li>
                  <Link href="/#kullanici-yorumlari" prefetch={false}>
                    {t("footer.stories")}
                  </Link>
                </li>
                <li>
                  <Link href="/support/" prefetch={false}>
                    {t("footer.support")}
                  </Link>
                </li>
                <li>
                  <Link href="/maps/" prefetch={false}>
                    {t("footer.workspace")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <span className="global-footer-group-title">{t("footer.legal")}</span>
              <ul className="global-footer-links">
                <li>
                  <Link href="/privacy/" prefetch={false}>
                    {t("footer.privacy")}
                  </Link>
                </li>
                <li>
                  <Link href="/terms/" prefetch={false}>
                    {t("footer.terms")}
                  </Link>
                </li>
                <li>
                  <Link href="/cookies/" prefetch={false}>
                    {t("footer.cookies")}
                  </Link>
                </li>
                <li>
                  <Link href="/cookies/" prefetch={false}>
                    {t("footer.cookiePrefs")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Metadata & Preferences */}
        <div className="global-footer-bottom">
          <div className="global-footer-bottom-left">
            <span className="global-footer-security-pill">
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                verified_user
              </span>
              <span>{t("footer.secure")}</span>
            </span>
          </div>
          <p className="global-footer-copyright">{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
