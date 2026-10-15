"use client";

import React from "react";

export function CommunityFooter() {
  return (
    <footer className="community-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <div className="footer-brand">
              <div className="footer-brand-logo">
                <span className="footer-brand-dot" />
              </div>
              <span>
                Maps<span className="footer-brand-em">Bridge</span>
              </span>
            </div>
            <p className="footer-brand-text">
              Gezginlerin interaktif rotalar oluşturduğu, seyahat deneyimlerini paylaştığı ve yeni
              keşif arkadaşları edindiği yeni nesil seyahat haritası platformu.
            </p>
            <div className="footer-social-links">
              <span>Instagram</span>
              <span>•</span>
              <span>X (Twitter)</span>
              <span>•</span>
              <span>YouTube</span>
              <span>•</span>
              <span>Discord</span>
            </div>
          </div>

          {/* Link Groups */}
          <div className="footer-links-group">
            <span className="footer-link-title">Topluluk</span>
            <ul className="footer-links">
              <li>
                <a>Keşfet &amp; Akış</a>
              </li>
              <li>
                <a>Rota Pazarı</a>
              </li>
              <li>
                <a>Grup Gezileri</a>
              </li>
              <li>
                <a>Gezi Arkadaşı İlanları</a>
              </li>
            </ul>
          </div>
          <div className="footer-links-group">
            <span className="footer-link-title">Araçlar</span>
            <ul className="footer-links">
              <li>
                <a>AI Akıllı Rota Oluşturucu</a>
              </li>
              <li>
                <a>6 Haneli Rota Kodları</a>
              </li>
              <li>
                <a>İnteraktif Harita Editörü</a>
              </li>
              <li>
                <a>Mobil Çevrimdışı İndirme</a>
              </li>
            </ul>
          </div>
          <div className="footer-links-group">
            <span className="footer-link-title">Kurumsal</span>
            <ul className="footer-links">
              <li>
                <a>İçerik Üretici Paneli</a>
              </li>
              <li>
                <a>Hakkımızda</a>
              </li>
              <li>
                <a>Topluluk Kuralları</a>
              </li>
              <li>
                <a>Gizlilik &amp; Güvenlik</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 MapsBridge Inc. Tüm hakları saklıdır. Modern Botanical Explorer Sürümü.</p>
          <div className="footer-lang-selector">
            <span>🌐</span>
            <span className="footer-lang-active">Türkçe (TR)</span>
            <span className="footer-lang-sep">|</span>
            <a className="footer-lang-other">English (EN)</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
