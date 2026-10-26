"use client";

import React, { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  signIn,
  handleGoogleCredentialResponse,
  getStoredSession,
} from "../lib/cognito";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import "./login.css";

interface GoogleCredentialResponse { credential: string; }
interface GoogleTokenResponse { error?: string; access_token?: string; }

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const [showGoogleFallbackModal, setShowGoogleFallbackModal] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const nextUrl = params?.get("next") || params?.get("redirect") || "/maps/";

  // Google OAuth Public Client ID
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const redirectToNext = useCallback(() => {
    try {
      const target = new URL(nextUrl, window.location.origin);
      const safeNext =
        target.origin === window.location.origin
          ? target.pathname + target.search + target.hash
          : "/maps/";
      window.location.assign(safeNext);
    } catch {
      window.location.assign("/maps/");
    }
  }, [nextUrl]);

  // Oturum zaten açıksa doğrudan yönlendir
  useEffect(() => {
    const session = getStoredSession();
    if (session?.token && session?.email) {
      redirectToNext();
    }
  }, [redirectToNext]);

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      try {
        setIsGoogleLoading(true);
        setMessage("");
        const res = handleGoogleCredentialResponse(response.credential);
        if (res) {
          redirectToNext();
        }
      } catch (err: unknown) {
        console.error("Google oturum açma hatası:", err);
        setMessage(err instanceof Error ? err.message : "Google ile giriş başarısız oldu. Lütfen tekrar deneyin.");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [redirectToNext],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initGoogle = () => {
      const google = window.google;
      if (!google?.accounts?.id) return;

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = "";
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "pill",
            text: "signin_with",
            logo_alignment: "left",
            width: 380,
            locale: window.location.pathname.startsWith("/en") ? "en" : "tr",
          });
        }
      } catch (e) {
        console.warn("Google GIS initialization error:", e);
      }
    };

    const existingScript = document.getElementById("google-gsi-client");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      initGoogle();
    }
  }, [clientId, handleCredential]);

  const triggerGoogleSignIn = () => {
    setIsGoogleLoading(true);
    setMessage("");
    const google = typeof window !== "undefined" ? window.google : null;

    // 1. Google OAuth 2.0 Token Client (Standart kullanıcı tıklaması popup akışı)
    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "email profile openid",
          callback: async (tokenResponse: GoogleTokenResponse) => {
            if (tokenResponse.error) {
              setIsGoogleLoading(false);
              if (tokenResponse.error !== "popup_closed_by_user") {
                console.warn("Google OAuth error:", tokenResponse);
                setShowGoogleFallbackModal(true);
              }
              return;
            }
            if (tokenResponse.access_token) {
              try {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const profile = await userRes.json() as { email?: string; name?: string; given_name?: string; picture?: string };
                if (profile?.email) {
                  handleGoogleCredentialResponse(tokenResponse.access_token, {
                    email: profile.email,
                    name: profile.name || profile.given_name || profile.email.split("@")[0],
                    picture: profile.picture,
                  });
                  redirectToNext();
                  return;
                }
              } catch (e: unknown) {
                console.error("Google userinfo fetch failed", e);
                setMessage("Google profil bilgisi alınamadı. Lütfen tekrar deneyin.");
              } finally {
                setIsGoogleLoading(false);
              }
            }
          },
          error_callback: (err: unknown) => {
            setIsGoogleLoading(false);
            console.warn("Google TokenClient error:", err);
            setShowGoogleFallbackModal(true);
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      } catch (err: unknown) {
        console.warn("initTokenClient failed, falling back to One Tap", err);
      }
    }

    // 2. One Tap prompt denemesi
    if (google?.accounts?.id) {
      try {
        google.accounts.id.prompt((notification: GooglePromptNotification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
            console.warn("Google One Tap not displayed, showing fallback");
            setShowGoogleFallbackModal(true);
          }
        });
        // 4 saniye içinde yanıt gelmezse fallback göster
        setTimeout(() => {
          setIsGoogleLoading((loading) => {
            if (loading) setShowGoogleFallbackModal(true);
            return false;
          });
        }, 3500);
        return;
      } catch (e) {
        console.warn("prompt() failed", e);
      }
    }

    // 3. Script yoksa veya alan adı Google Cloud'da henüz tanımlanmadıysa
    setIsGoogleLoading(false);
    setShowGoogleFallbackModal(true);
  };

  const _handleFallbackGmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Google OAuth popup başarısız oldu — kullanıcıyı e-posta/şifre ile giriş yapmaya yönlendir
    setShowGoogleFallbackModal(false);
    setMessage(
      "Google ile giriş şu anda kullanılamıyor. Lütfen e-posta ve şifrenizle giriş yapın veya Google tarayıcı ayarlarınızda pop-up engelleyicisini kapatın.",
    );
  };

  const triggerAppleSignIn = () => {
    setIsAppleLoading(true);
    setMessage("");
    // Apple Sign In — henüz web'de tam entegre değil
    setMessage(
      "Apple ile giriş özelliği yakında aktif olacak. Lütfen e-posta ve şifrenizle giriş yapın.",
    );
    setIsAppleLoading(false);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      await signIn(email.trim().toLowerCase(), password);
      redirectToNext();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Giriş yapılamadı.";
      if (
        text.toLowerCase().includes("notconfirmed") ||
        text.toLowerCase().includes("hesabınız henüz doğrulanmamış")
      ) {
        window.location.assign(`/dogrula/?email=${encodeURIComponent(email)}`);
      } else {
        setMessage(text);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-viewport bg-surface font-body-md text-body-md text-on-surface antialiased">
      <HeaderNav />

      {/* Main Split Screen */}
      <main className="login-main">
        <div className="login-container">
          <div className="login-grid">
            {/* Sol Panel: Giriş Formu */}
            <div className="login-card-left">
              {/* Glow decoration */}
              <div className="login-card-glow"></div>

              <div style={{ position: "relative", zIndex: 10 }}>
                {/* Eyebrow badge */}
                <div className="login-welcome-badge">
                  <span className="login-pulse-dot"></span>
                  <span>TEKRAR HOŞ GELDİN</span>
                </div>

                <h1 className="login-title">Giriş yap.</h1>
                <p className="login-subtitle">
                  Kişisel rotalarına, kayıtlı duraklarına ve seyahat arkadaşlarına kaldığın yerden
                  devam et.
                </p>

                {/* Social Login Buttons (Google + Apple) */}
                <div className="login-social-grid">
                  <button
                    className="login-google-btn"
                    type="button"
                    onClick={triggerGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    <svg style={{ width: "19px", height: "19px" }} viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      ></path>
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      ></path>
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        fill="#FBBC05"
                      ></path>
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        fill="#EA4335"
                      ></path>
                    </svg>
                    <span>{isGoogleLoading ? "Bağlanıyor..." : "Google ile Giriş Yap"}</span>
                  </button>

                  <button
                    className="login-apple-btn"
                    type="button"
                    onClick={triggerAppleSignIn}
                    disabled={isAppleLoading}
                  >
                    <svg
                      style={{ width: "18px", height: "18px", fill: "currentColor" }}
                      viewBox="0 0 170 170"
                    >
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.55-14.22-31.26-3.48-11.71-5.22-22.95-5.22-33.72 0-14.13 3.59-26.06 10.76-35.79 7.18-9.73 16.2-14.65 27.08-14.77 5.22 0 10.79 1.39 16.71 4.17 5.92 2.78 9.78 4.22 11.58 4.31 1.41 0 5.48-1.57 12.21-4.71 6.74-3.14 12.63-4.52 17.68-4.14 13.48.87 23.97 5.86 31.47 14.97-12.06 7.28-17.98 17.26-17.76 29.95.22 9.89 3.96 18.06 11.22 24.51 7.26 6.45 15.82 10.12 25.68 11.01-2.17 6.74-4.78 13.32-7.84 19.74zM119.22 31.81c0-7.39 2.66-14.39 7.99-20.99 5.33-6.61 11.85-10.55 19.57-11.82.22 1.3.33 2.39.33 3.26 0 7.39-2.83 14.45-8.49 21.18-5.65 6.74-12.28 10.59-19.89 11.56-.11-1.09-.17-2.17-.17-3.19z" />
                    </svg>
                    <span>{isAppleLoading ? "Bağlanıyor..." : "Apple ile Giriş Yap"}</span>
                  </button>
                </div>

                <div ref={googleBtnContainerRef} style={{ display: "none" }}></div>

                {/* Apple fallback modal kaldırıldı — Apple Sign In henüz web'de entegre değil */}

                {showGoogleFallbackModal && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 9999,
                      padding: "1rem",
                    }}
                    onClick={() => setShowGoogleFallbackModal(false)}
                  >
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "1.25rem",
                        padding: "1.75rem",
                        maxWidth: "440px",
                        width: "100%",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                        border: "1px solid #e2e8f0",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <svg style={{ width: "22px", height: "22px" }} viewBox="0 0 24 24">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              fill="#EA4335"
                            />
                          </svg>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "17px",
                              fontWeight: 700,
                              color: "#131b2e",
                            }}
                          >
                            Google ile Giriş
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGoogleFallbackModal(false)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#64748b",
                            fontSize: "18px",
                            fontWeight: 700,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <p
                        style={{
                          fontSize: "13.5px",
                          color: "#475569",
                          marginBottom: "1rem",
                          lineHeight: 1.6,
                        }}
                      >
                        Google ile giriş şu anda gerçekleştirilemedi. Bu durum genellikle
                        tarayıcınızın pop-up engelleyicisinden kaynaklanır.
                      </p>
                      <ul
                        style={{
                          fontSize: "13px",
                          color: "#475569",
                          margin: "0 0 1.25rem 0",
                          paddingLeft: "1.25rem",
                          lineHeight: 1.7,
                        }}
                      >
                        <li>Tarayıcınızda pop-up engelleyicisini kapatıp tekrar deneyin</li>
                        <li>Farklı bir tarayıcı kullanın (Chrome önerilir)</li>
                        <li>Veya aşağıdan e-posta ve şifre ile giriş yapın</li>
                      </ul>
                      <button
                        type="button"
                        className="login-submit-btn"
                        style={{ width: "100%", marginTop: 0 }}
                        onClick={() => setShowGoogleFallbackModal(false)}
                      >
                        Anladım, E-posta ile Devam Et
                      </button>
                    </div>
                  </div>
                )}

                {/* Ayraç */}
                <div className="login-divider">
                  <div className="login-divider-line"></div>
                  <span className="login-divider-text">veya e-posta ile</span>
                  <div className="login-divider-line"></div>
                </div>

                {/* Form Alanları */}
                <form onSubmit={handleSubmit}>
                  <div className="login-form-group">
                    <label className="login-label" htmlFor="emailInput">
                      E-posta
                    </label>
                    <div className="login-input-wrapper">
                      <span className="material-symbols-outlined login-input-icon">mail</span>
                      <input
                        className="login-input"
                        id="emailInput"
                        name="email"
                        placeholder="ornek@alanadi.com"
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="login-form-group">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "0.375rem",
                      }}
                    >
                      <label
                        className="login-label"
                        htmlFor="passwordInput"
                        style={{ marginBottom: 0 }}
                      >
                        Şifre
                      </label>
                      <Link
                        style={{
                          fontSize: "12px",
                          color: "var(--mb-secondary)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                        href={`/sifre-sifirla/${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                      >
                        Şifremi unuttum
                      </Link>
                    </div>
                    <div className="login-input-wrapper">
                      <span className="material-symbols-outlined login-input-icon">lock</span>
                      <input
                        className="login-input"
                        id="passwordInput"
                        name="password"
                        placeholder="••••••••"
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        className="login-password-toggle"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "var(--mb-primary-container)",
                        cursor: "pointer",
                      }}
                    />
                    <label
                      htmlFor="rememberMe"
                      style={{
                        fontSize: "13px",
                        color: "var(--mb-on-surface-variant)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      Beni bu cihazda hatırla
                    </label>
                  </div>

                  {/* Hata Mesajı */}
                  {message && (
                    <div
                      style={{
                        marginTop: "0.875rem",
                        padding: "0.75rem 1rem",
                        borderRadius: "0.75rem",
                        backgroundColor: "rgba(255, 218, 214, 0.5)",
                        border: "1px solid rgba(186, 26, 26, 0.3)",
                        color: "#ba1a1a",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                      }}
                      role="alert"
                    >
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>{message}</p>
                        {message.toLowerCase().includes("hatalı") && (
                          <p style={{ margin: "0.25rem 0 0", fontSize: "12px" }}>
                            Şifrenizi hatırlamıyorsanız:{" "}
                            <Link
                              href={`/sifre-sifirla/?email=${encodeURIComponent(email)}`}
                              style={{
                                textDecoration: "underline",
                                fontWeight: 700,
                                color: "inherit",
                              }}
                            >
                              Şifremi Sıfırla →
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button className="login-submit-btn" type="submit" disabled={isLoading}>
                    <span>{isLoading ? "Giriş yapılıyor…" : "Giriş yap"}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </form>
              </div>

              {/* Alt Bilgilendirme Kartı */}
              <div className="login-callout-box" style={{ position: "relative", zIndex: 10 }}>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "#2d6e58",
                    }}
                  >
                    HESABIN YOK MU?
                  </span>
                  <Link
                    style={{
                      fontSize: "12px",
                      color: "var(--mb-primary-container)",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                    href={
                      nextUrl !== "/maps/"
                        ? `/register/?next=${encodeURIComponent(nextUrl)}`
                        : "/register/"
                    }
                  >
                    <span>Ücretsiz üye ol</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
                <p
                  style={{
                    margin: "0.375rem 0 0",
                    fontSize: "13px",
                    color: "var(--mb-on-surface)",
                    fontWeight: 500,
                  }}
                >
                  Adresini ve rotalarını birkaç saniyede güvenle paylaşmaya başla.
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginTop: "0.5rem",
                    color: "var(--mb-on-surface-variant)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[15px]"
                    style={{ color: "var(--mb-emerald-accent)" }}
                  >
                    verified_user
                  </span>
                  <span style={{ fontSize: "12px", opacity: 0.9 }}>
                    Kayıt tamamen ücretsizdir. Gizli takip yoktur.
                  </span>
                </div>
              </div>
            </div>

            {/* Sağ Panel: Kapadokya Görseli & Glassmorphic Kartlar */}
            <div className="login-card-right">
              {/* Arka Plan Görseli */}
              <div
                className="login-bg-image"
                style={{ backgroundImage: "url('/images/kapadokya-balloons.jpg')" }}
              ></div>
              {/* Koyu Degrade Filtresi */}
              <div className="login-bg-overlay"></div>

              {/* Üst Asılı Hap: Son Ziyaret Edilen Rota */}
              <div className="login-top-pill">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ color: "var(--mb-secondary)" }}
                >
                  explore
                </span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--mb-on-surface)" }}>
                  Son Ziyaret Edilen:
                </span>
                <span style={{ fontSize: "12px", color: "var(--mb-on-surface-variant)" }}>
                  Roma Rönesans &amp; Antik Miras
                </span>
                <span
                  style={{
                    backgroundColor: "var(--mb-secondary-fixed)",
                    color: "var(--mb-on-secondary-fixed)",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  RM-841
                </span>
              </div>

              {/* Alt Kısım: Sayısal Başarı ve Gezgin Yorumu */}
              <div className="login-bottom-showcase">
                {/* Canlı Metrik Kartı */}
                <div className="login-metrics-box">
                  <div>
                    <div
                      style={{
                        fontSize: "28px",
                        lineHeight: "36px",
                        fontWeight: 700,
                        color: "var(--mb-on-surface)",
                      }}
                    >
                      140K+
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--mb-on-surface-variant)" }}>
                      Kayıtlı Gezgin
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "28px",
                        lineHeight: "36px",
                        fontWeight: 700,
                        color: "var(--mb-secondary)",
                      }}
                    >
                      500K+
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--mb-on-surface-variant)" }}>
                      Canlı Keşif Noktası
                    </div>
                  </div>
                </div>

                {/* Yarı Saydam Gerçek Kullanıcı Deneyimi Kartı */}
                <div className="login-testimonial-box">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                      color: "var(--mb-emerald-accent)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">star</span>
                    <span className="material-symbols-outlined text-[16px]">star</span>
                    <span className="material-symbols-outlined text-[16px]">star</span>
                    <span className="material-symbols-outlined text-[16px]">star</span>
                    <span className="material-symbols-outlined text-[16px]">star</span>
                  </div>
                  <blockquote
                    style={{
                      margin: 0,
                      fontStyle: "italic",
                      fontSize: "15px",
                      lineHeight: "22px",
                      color: "var(--mb-on-surface)",
                    }}
                  >
                    “MapsBridge sayesinde İtalya seyahatimiz tek bir aksama olmadan tamamlandı. 6
                    haneli kodla tüm grup anında aynı haritadaydı.”
                  </blockquote>
                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{ fontSize: "13px", fontWeight: 700, color: "var(--mb-on-surface)" }}
                    >
                      — Elif D.
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--mb-on-surface-variant)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{ color: "var(--mb-secondary)" }}
                      >
                        pin_drop
                      </span>{" "}
                      Toskana &amp; Roma Rotası
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Unified Global Site Footer */}
      <SiteFooter />
    </div>
  );
}
