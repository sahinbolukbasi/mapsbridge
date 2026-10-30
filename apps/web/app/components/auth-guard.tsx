"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getStoredSession, isTokenExpired, willExpireSoon, refreshSession } from "../lib/cognito";
import { LoadingState, PageHeader, PageShell } from "./ui";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  subtitle?: string;
  featureName?: string;
}

export function AuthGuard({
  children,
  fallback,
  title = "MapsBridge Girişi Gereklidir",
  subtitle = "Bu seyahat çalışma alanına erişmek için lütfen hesabınıza giriş yapın veya ücretsiz bir hesap oluşturun.",
  featureName = "Seyahat Çalışma Alanı",
}: AuthGuardProps) {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    const resolveSession = async () => {
      const session = getStoredSession();
      if (!session?.token) {
        if (active) {
          setIsAuthenticated(false);
          setChecking(false);
        }
        return;
      }

      if (isTokenExpired(session.token)) {
        // Token expired (or within 5-min buffer) — must refresh
        const refreshed = await refreshSession();
        if (active) {
          setIsAuthenticated(!!refreshed?.token);
          setChecking(false);
        }
        return;
      }

      // Token valid — show content immediately, then silently refresh if expiring soon
      if (active) {
        setIsAuthenticated(true);
        setChecking(false);
      }

      if (willExpireSoon(session.token)) {
        refreshSession().catch(() => {
          /* background refresh; ignore errors */
        });
      }
    };
    void resolveSession();
    return () => {
      active = false;
    };
  }, []);

  // Kimlik kapısı (design §4.5): chrome SiteChrome'dadır; her dal kendi PageShell'ini ve tek h1'ini
  // render eder. Yükleniyor dalı prerender HTML'idir (statik main + h1).
  if (checking) {
    return (
      // Başlık route-registry'den (ör. /maps/ → "Harita masası"); layout prop'u registry'yi ezer.
      <PageShell layout="app" header={<PageHeader variant="hidden" />}>
        <LoadingState label="Oturum kontrol ediliyor..." />
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/maps/";
    const loginUrl = `/login/?next=${encodeURIComponent(currentPath)}`;
    const signupUrl = `/register/?next=${encodeURIComponent(currentPath)}`;

    return (
      <PageShell layout="form">
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(16px)",
              borderRadius: "24px",
              padding: "40px 32px",
              boxShadow:
                "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.3)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
                color: "#1e4d3e",
              }}
            >
              <span
                aria-hidden="true"
                translate="no"
                className="material-symbols-outlined"
                style={{ fontSize: "32px" }}
              >
                lock
              </span>
            </div>

            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "#1e4d3e",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              {featureName}
            </div>

            <PageHeader title={title} />

            <p
              style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, marginBottom: "28px" }}
            >
              {subtitle}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a
                href={loginUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px 20px",
                  borderRadius: "14px",
                  backgroundColor: "#1e4d3e",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "15px",
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(30, 77, 62, 0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                <span
                  aria-hidden="true"
                  translate="no"
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px" }}
                >
                  login
                </span>
                Giriş Yap
              </a>

              <a
                href={signupUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px 20px",
                  borderRadius: "14px",
                  backgroundColor: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontWeight: 600,
                  fontSize: "15px",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
              >
                <span
                  aria-hidden="true"
                  translate="no"
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px" }}
                >
                  person_add
                </span>
                Ücretsiz Hesap Oluştur
              </a>
            </div>

            <div
              style={{
                marginTop: "24px",
                paddingTop: "20px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              <a href="/how-it-works/" style={{ color: "#64748b", textDecoration: "none" }}>
                Nasıl Çalışır?
              </a>
              <span>&bull;</span>
              <a href="/community/" style={{ color: "#64748b", textDecoration: "none" }}>
                Gezgin Rotaları
              </a>
              <span>&bull;</span>
              <a href="/support/" style={{ color: "#64748b", textDecoration: "none" }}>
                Destek
              </a>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return <>{children}</>;
}
