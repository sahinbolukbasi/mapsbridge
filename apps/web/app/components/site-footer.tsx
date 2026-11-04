"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./site-footer.css";
import { useLocale } from "../lib/locale-context";

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
                <span
                  aria-hidden="true"
                  translate="no"
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px" }}
                >
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
          </div>

          {/* Nav Links Grid */}
          <nav className="global-footer-links-col" aria-label={t("ui.footerLinks")}>
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
          </nav>
        </div>

        {/* Bottom Metadata & Preferences */}
        <div className="global-footer-bottom">
          <div className="global-footer-bottom-left">
            <span className="global-footer-security-pill">
              <span
                aria-hidden="true"
                translate="no"
                className="material-symbols-outlined"
                style={{ fontSize: "15px" }}
              >
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
