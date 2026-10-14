"use client";

import React from "react";
import Link from "next/link";
import "./welcome.css";

export default function WelcomePage() {
  return (
    <main className="welcome-page-container" aria-label="MapsBridge Giriş ve Kayıt Ekranı">
      {/* Top Header */}
      <header className="welcome-header">
        <Link href="/" className="welcome-brand-mark" aria-label="MapsBridge Ana Sayfa">
          <div className="welcome-brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <div className="welcome-brand-title">MapsBridge</div>
          </div>
        </Link>
      </header>

      {/* Hero / Identity Section */}
      <section className="welcome-main-content">
        <div className="welcome-badge-tag">
          <span>✨</span>
          <span>MapsBridge Hesabın</span>
        </div>

        <h1 className="welcome-title">
          Hoş Geldiniz
        </h1>

        <p className="welcome-description">
          Devam etmek için hesabınıza giriş yapın veya yeni bir hesap oluşturun.
        </p>
      </section>

      {/* Action Buttons: Only Apple, Google, E-posta Giriş, Kayıt Ol */}
      <footer className="welcome-action-section">
        {/*  Apple Sign-In */}
        <Link
          href="/login/?provider=apple&next=/desk/"
          className="native-mobile-btn btn-apple-signin"
        >
          <svg width="18" height="18" viewBox="0 0 170 170" fill="currentColor" aria-hidden="true">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.71-11.65-14-5.87-9.03-10.4-19.12-13.57-30.28-3.18-11.16-4.77-22.14-4.77-32.96 0-14.68 3.81-26.69 11.44-36.03 7.62-9.33 17.1-14.07 28.43-14.21 4.57 0 9.8 1.25 15.69 3.76 5.89 2.51 9.75 3.79 11.6 3.84 1.41-.05 5.48-1.42 12.2-4.1 6.73-2.68 12.04-3.83 15.96-3.45 12.18.98 21.75 5.54 28.71 13.68-10.88 6.53-16.2 15.56-15.96 27.08.33 9.03 3.87 16.6 10.63 22.72 6.75 6.11 14.74 9.69 23.95 10.73-2.5 7.4-5.38 14.59-8.65 21.57zM119.22 31.06c0-7.07 2.61-13.88 7.84-20.43 5.23-6.55 11.67-10.63 19.33-12.24.43 3.48.54 6.74.33 9.79-.65 7.51-3.69 14.58-9.13 21.2-5.44 6.64-11.89 10.51-19.34 11.62-.22-3.26-.03-6.58.57-9.94z"/>
          </svg>
          <span>Apple ile Giriş Yap</span>
        </Link>

        {/* G Google Sign-In */}
        <Link
          href="/login/?provider=google&next=/desk/"
          className="native-mobile-btn btn-google-signin"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          <span>Google ile Giriş Yap</span>
        </Link>

        {/* E-posta ile Giriş Yap */}
        <Link
          href="/login/?next=/desk/"
          className="native-mobile-btn btn-email-signin"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>Giriş Yap</span>
        </Link>

        {/* Kayıt Ol */}
        <Link
          href="/register/?next=/desk/"
          className="native-mobile-btn btn-register-action"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <span>Kayıt Ol</span>
        </Link>
      </footer>
    </main>
  );
}
