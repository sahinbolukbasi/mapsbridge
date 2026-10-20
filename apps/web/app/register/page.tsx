"use client";

import React, { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { signUp, handleGoogleCredentialResponse, getStoredSession } from "../lib/cognito";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import "./register.css";

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const [showAppleFallbackModal, setShowAppleFallbackModal] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const nextUrl = params?.get("next") || "/maps/";

  // Şifre Güvenlik Kriterleri
  const rules = [
    { id: "rule-length", label: "En az 12 karakter", valid: password.length >= 12 },
    { id: "rule-lower", label: "En az bir küçük harf", valid: /[a-zğüşıöç]/.test(password) },
    { id: "rule-upper", label: "En az bir büyük harf", valid: /[A-ZĞÜŞİÖÇ]/.test(password) },
    { id: "rule-number", label: "En az bir rakam", valid: /[0-9]/.test(password) },
    {
      id: "rule-symbol",
      label: "En az bir sembol (ör. !, ?, #)",
      valid: /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(password),
    },
  ];

  const isPasswordValid = rules.every((r) => r.valid);

  // Google OAuth GIS Initializer
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const [showGoogleFallbackModal, setShowGoogleFallbackModal] = useState(false);

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
    (response: any) => {
      try {
        setIsGoogleLoading(true);
        setMessage("");
        const res = handleGoogleCredentialResponse(response.credential);
        if (res) {
          redirectToNext();
        }
      } catch (err: any) {
        console.error("Google kayıt hatası:", err);
        setMessage(err.message || "Google ile kayıt başarısız oldu. Lütfen tekrar deneyin.");
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [redirectToNext],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initGoogle = () => {
      const google = (window as any).google;
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
            text: "signup_with",
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

  const triggerGoogleSignUp = () => {
    setIsGoogleLoading(true);
    setMessage("");
    const google = typeof window !== "undefined" ? (window as any).google : null;

    // 1. Google OAuth 2.0 Token Client popup akışı
    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "email profile openid",
          callback: async (tokenResponse: any) => {
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
                const profile = await userRes.json();
                if (profile?.email) {
                  handleGoogleCredentialResponse(tokenResponse.access_token, {
                    email: profile.email,
                    name: profile.name || profile.given_name || profile.email.split("@")[0],
                    picture: profile.picture,
                  });
                  redirectToNext();
                  return;
                }
              } catch (e: any) {
                console.error("Google userinfo fetch failed", e);
                setMessage("Google profil bilgisi alınamadı. Lütfen tekrar deneyin.");
              } finally {
                setIsGoogleLoading(false);
              }
            }
          },
          error_callback: (err: any) => {
            setIsGoogleLoading(false);
            console.warn("Google TokenClient error:", err);
            setShowGoogleFallbackModal(true);
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      } catch (err: any) {
        console.warn("initTokenClient failed, falling back to One Tap", err);
      }
    }

    // 2. One Tap prompt denemesi
    if (google?.accounts?.id) {
      try {
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
            setShowGoogleFallbackModal(true);
          }
        });
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

    // 3. Fallback
    setIsGoogleLoading(false);
    setShowGoogleFallbackModal(true);
  };

  const triggerAppleSignUp = () => {
    setIsAppleLoading(true);
    setMessage("");
    setShowAppleFallbackModal(true);
    setIsAppleLoading(false);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = fullname.trim();
    const cleanUser = (username || cleanEmail.split("@")[0])
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    // Save profile details locally
    try {
      const nameParts = cleanName.split(" ");
      const firstName = nameParts[0] || cleanName;
      const lastName = nameParts.slice(1).join(" ") || "";
      localStorage.setItem(
        "mapsbridge.userProfileDetails",
        JSON.stringify({
          firstName,
          lastName,
          username: cleanUser || "gezgin",
          phone: cleanPhone,
        }),
      );
    } catch {
      // ignore
    }

    try {
      await signUp(cleanEmail, password, cleanName, cleanPhone);
      const nextParam = params?.get("next")
        ? `&next=${encodeURIComponent(params.get("next")!)}`
        : "";
      window.location.assign(
        `/dogrula/?email=${encodeURIComponent(cleanEmail)}&phone=${encodeURIComponent(cleanPhone)}${nextParam}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kayıt tamamlanamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="signup-viewport bg-surface font-body-md text-body-md text-on-surface antialiased">
      <HeaderNav />

      {/* Main Split Content */}
      <main className="signup-main">
        <div className="signup-container">
          <div className="signup-grid">
            {/* Sol Sütun: Kayıt Formu (lg:col-span-7) */}
            <div className="signup-card-left">
              {/* Rozet */}
              <div className="signup-badge-wrapper">
                <span className="signup-badge">GÜVENLİ BAŞLANGIÇ</span>
                <span className="signup-pulse-dot"></span>
              </div>

              <h1 className="signup-title">Hesabını oluştur.</h1>
              <p className="signup-subtitle">
                Adreslerini kaydetmek ve rotalarını seyahat arkadaşlarınla güvenle paylaşmak için
                birkaç bilgi yeterli.
              </p>

              {/* Social Sign-Up Buttons (Google + Apple) */}
              <div className="signup-social-grid">
                <button
                  className="signup-google-btn"
                  type="button"
                  onClick={triggerGoogleSignUp}
                  disabled={isGoogleLoading}
                >
                  <svg style={{ width: "19px", height: "19px" }} viewBox="0 0 24 24">
                    <path
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      fill="#4285F4"
                    ></path>
                    <path
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                      fill="#34A853"
                    ></path>
                    <path
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      fill="#FBBC05"
                    ></path>
                    <path
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      fill="#EA4335"
                    ></path>
                  </svg>
                  <span>{isGoogleLoading ? "Bağlanıyor..." : "Google ile Kayıt Ol"}</span>
                </button>

                <button
                  className="signup-apple-btn"
                  type="button"
                  onClick={triggerAppleSignUp}
                  disabled={isAppleLoading}
                >
                  <svg
                    style={{ width: "18px", height: "18px", fill: "currentColor" }}
                    viewBox="0 0 170 170"
                  >
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.55-14.22-31.26-3.48-11.71-5.22-22.95-5.22-33.72 0-14.13 3.59-26.06 10.76-35.79 7.18-9.73 16.2-14.65 27.08-14.77 5.22 0 10.79 1.39 16.71 4.17 5.92 2.78 9.78 4.22 11.58 4.31 1.41 0 5.48-1.57 12.21-4.71 6.74-3.14 12.63-4.52 17.68-4.14 13.48.87 23.97 5.86 31.47 14.97-12.06 7.28-17.98 17.26-17.76 29.95.22 9.89 3.96 18.06 11.22 24.51 7.26 6.45 15.82 10.12 25.68 11.01-2.17 6.74-4.78 13.32-7.84 19.74zM119.22 31.81c0-7.39 2.66-14.39 7.99-20.99 5.33-6.61 11.85-10.55 19.57-11.82.22 1.3.33 2.39.33 3.26 0 7.39-2.83 14.45-8.49 21.18-5.65 6.74-12.28 10.59-19.89 11.56-.11-1.09-.17-2.17-.17-3.19z" />
                  </svg>
                  <span>{isAppleLoading ? "Bağlanıyor..." : "Apple ile Kayıt Ol"}</span>
                </button>
              </div>

              <div ref={googleBtnContainerRef} style={{ display: "none" }}></div>

              {showAppleFallbackModal && (
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
                  onClick={() => setShowAppleFallbackModal(false)}
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
                        <svg
                          style={{ width: "20px", height: "20px", fill: "#000" }}
                          viewBox="0 0 170 170"
                        >
                          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.55-14.22-31.26-3.48-11.71-5.22-22.95-5.22-33.72 0-14.13 3.59-26.06 10.76-35.79 7.18-9.73 16.2-14.65 27.08-14.77 5.22 0 10.79 1.39 16.71 4.17 5.92 2.78 9.78 4.22 11.58 4.31 1.41 0 5.48-1.57 12.21-4.71 6.74-3.14 12.63-4.52 17.68-4.14 13.48.87 23.97 5.86 31.47 14.97-12.06 7.28-17.98 17.26-17.76 29.95.22 9.89 3.96 18.06 11.22 24.51 7.26 6.45 15.82 10.12 25.68 11.01-2.17 6.74-4.78 13.32-7.84 19.74zM119.22 31.81c0-7.39 2.66-14.39 7.99-20.99 5.33-6.61 11.85-10.55 19.57-11.82.22 1.3.33 2.39.33 3.26 0 7.39-2.83 14.45-8.49 21.18-5.65 6.74-12.28 10.59-19.89 11.56-.11-1.09-.17-2.17-.17-3.19z" />
                        </svg>
                        <h3
                          style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#131b2e" }}
                        >
                          Apple ile Kayıt
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAppleFallbackModal(false)}
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
                      Apple ile kayıt özelliği yakında kullanıma sunulacaktır.
                    </p>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        marginBottom: "1.25rem",
                        lineHeight: 1.6,
                      }}
                    >
                      Şimdilik aşağıdaki formu kullanarak e-posta ve şifre ile hızlıca hesap
                      oluşturabilirsiniz.
                    </p>
                    <button
                      type="button"
                      className="signup-submit-btn"
                      style={{ width: "100%", marginTop: 0 }}
                      onClick={() => setShowAppleFallbackModal(false)}
                    >
                      Anladım, E-posta ile Devam Et
                    </button>
                  </div>
                </div>
              )}

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
                          style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#131b2e" }}
                        >
                          Google ile Kayıt
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
                      Google ile kayıt şu anda gerçekleştirilemedi. Bu durum genellikle
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
                      <li>Veya aşağıdan e-posta ve şifre ile kayıt olun</li>
                    </ul>
                    <button
                      type="button"
                      className="signup-submit-btn"
                      style={{ width: "100%", marginTop: 0 }}
                      onClick={() => setShowGoogleFallbackModal(false)}
                    >
                      Anladım, E-posta ile Devam Et
                    </button>
                  </div>
                </div>
              )}

              {/* Ayraç */}
              <div className="signup-divider">
                <div className="signup-divider-line"></div>
                <span className="signup-divider-text">veya e-posta ile</span>
              </div>

              {/* Kayıt Form Alanları */}
              <form onSubmit={handleSubmit}>
                {/* Kullanıcı Adı */}
                <div className="signup-form-group">
                  <label className="signup-label" htmlFor="username">
                    Kullanıcı Adı
                  </label>
                  <div className="signup-input-wrapper">
                    <span className="signup-input-at">@</span>
                    <input
                      className="signup-input"
                      style={{ paddingLeft: "2.5rem" }}
                      id="username"
                      name="username"
                      placeholder="gezginrotasi"
                      required
                      type="text"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                      }
                    />
                  </div>
                  <p className="signup-help-text">
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ color: "var(--mb-secondary)" }}
                    >
                      link
                    </span>
                    Herkese açık profil adresin:{" "}
                    <span style={{ color: "var(--mb-primary)", fontWeight: 600 }}>
                      mapsbridge.com/{username || "kullaniciadi"}
                    </span>
                  </p>
                </div>

                {/* Ad Soyad & E-posta Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <div className="signup-form-group">
                    <label className="signup-label" htmlFor="fullname">
                      Ad Soyad
                    </label>
                    <input
                      className="signup-input"
                      id="fullname"
                      name="fullname"
                      placeholder="Deniz Yılmaz"
                      required
                      type="text"
                      value={fullname}
                      onChange={(e) => setFullname(e.target.value)}
                    />
                  </div>

                  <div className="signup-form-group">
                    <label className="signup-label" htmlFor="email">
                      E-posta
                    </label>
                    <input
                      className="signup-input"
                      id="email"
                      name="email"
                      placeholder="deniz@ornek.com"
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Telefon */}
                <div className="signup-form-group">
                  <label className="signup-label" htmlFor="phone">
                    Telefon
                  </label>
                  <div className="signup-input-wrapper">
                    <span className="material-symbols-outlined signup-input-phone-icon">call</span>
                    <input
                      className="signup-input"
                      style={{ paddingLeft: "2.75rem" }}
                      id="phone"
                      name="phone"
                      placeholder="+905551234567"
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <p className="signup-help-text">
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ color: "var(--mb-outline)" }}
                    >
                      info
                    </span>
                    Başında + ve ülke kodu ile yazmalısın. Örn: +905551234567
                  </p>
                </div>

                {/* Şifre */}
                <div className="signup-form-group">
                  <label className="signup-label" htmlFor="password">
                    Şifre
                  </label>
                  <div className="signup-input-wrapper">
                    <input
                      className="signup-input"
                      style={{ paddingRight: "3rem" }}
                      id="password"
                      name="password"
                      placeholder="Güçlü bir şifre belirleyin"
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

                {/* Şifre Kriterleri Kontrol Listesi */}
                <div className="signup-password-rules">
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mb-on-surface-variant)",
                      display: "block",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Şifre Güvenlik Kriterleri
                  </span>
                  <ul className="signup-rules-grid">
                    {rules.map((r) => (
                      <li key={r.id} className={`signup-rule-item ${r.valid ? "valid" : ""}`}>
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{
                            color: r.valid ? "var(--mb-emerald-accent)" : "var(--mb-outline)",
                          }}
                        >
                          {r.valid ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Hata Mesajı */}
                {message && (
                  <div
                    style={{
                      marginBottom: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: "rgba(255, 218, 214, 0.5)",
                      border: "1px solid rgba(186, 26, 26, 0.3)",
                      color: "#ba1a1a",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                    role="alert"
                  >
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{message}</span>
                  </div>
                )}

                {/* Ana Gönderim Butonu */}
                <button
                  className="signup-submit-btn"
                  type="submit"
                  disabled={isLoading || (password.length > 0 && !isPasswordValid)}
                >
                  <span>{isLoading ? "Hesap oluşturuluyor…" : "Doğrulama kodunu gönder"}</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </form>

              {/* Alt Bağlantılar & Yasal Bilgilendirme */}
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "14px",
                  }}
                >
                  <span>Zaten hesabın var mı?</span>
                  <a
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--mb-primary)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      marginLeft: "0.25rem",
                    }}
                    data-path="giris"
                    href={
                      nextUrl !== "/maps/"
                        ? `/login/?next=${encodeURIComponent(nextUrl)}`
                        : "/login/"
                    }
                  >
                    <span>Giriş yap</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </a>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "rgba(64, 73, 69, 0.8)" }}>
                  Devam ederek{" "}
                  <a href="/privacy/" style={{ textDecoration: "underline", color: "inherit" }}>
                    Gizlilik Politikası
                  </a>{" "}
                  ve{" "}
                  <a href="/terms/" style={{ textDecoration: "underline", color: "inherit" }}>
                    Kullanım Koşullarını
                  </a>{" "}
                  kabul edersin.
                </p>
              </div>
            </div>

            {/* Sağ Sütun: Tokyo Seyahat İlhamı & Güven Paneli (lg:col-span-5) */}
            <div className="signup-card-right">
              {/* Arka Plan Görseli */}
              <div
                className="signup-bg-image"
                style={{ backgroundImage: "url('/images/tokyo-shinjuku.jpg')" }}
              ></div>
              {/* Gradyan & Multiply Katmanları */}
              <div className="signup-bg-overlay"></div>
              <div className="signup-bg-multiply"></div>

              {/* Üst Katman: Rozet & Konum Göstergesi */}
              <div className="signup-top-layer">
                <div className="signup-city-pill">
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ color: "var(--mb-mint-glow)" }}
                  >
                    explore
                  </span>
                  <span>SHINJUKU • TOKYO</span>
                </div>
                <div className="signup-sync-pill">
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      backgroundColor: "var(--mb-mint-glow)",
                      boxShadow: "0 0 6px var(--mb-mint-glow)",
                    }}
                  ></span>
                  <span>Canlı Senkronizasyon</span>
                </div>
              </div>

              {/* Orta Katman: Avantaj Kartları */}
              <div className="signup-feature-cards">
                {/* Kart 1: Kod Eşitleme */}
                <div className="signup-feature-card">
                  <div
                    className="signup-card-icon"
                    style={{
                      backgroundColor: "rgba(52, 211, 153, 0.2)",
                      color: "var(--mb-mint-glow)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[22px]">pin</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                      6 Haneli Kod ile Anında Eşitleme
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "rgba(255, 255, 255, 0.8)",
                        lineHeight: "1.4",
                      }}
                    >
                      Arkadaş grubunla rotalarını cihaz fark etmeksizin saniyeler içinde paylaş.
                    </p>
                  </div>
                </div>

                {/* Kart 2: AI Destekli Optimizasyon */}
                <div className="signup-feature-card">
                  <div
                    className="signup-card-icon"
                    style={{
                      backgroundColor: "rgba(171, 237, 211, 0.2)",
                      color: "var(--mb-secondary-container)",
                    }}
                  >
                    <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                      AI Destekli Rota Optimizasyonu
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "rgba(255, 255, 255, 0.8)",
                        lineHeight: "1.4",
                      }}
                    >
                      Trafik, yürüme süreleri ve açılış saatlerine göre en verimli gezi sırası.
                    </p>
                  </div>
                </div>

                {/* Kart 3: Gezgin Topluluğu */}
                <div className="signup-feature-card">
                  <div
                    className="signup-card-icon"
                    style={{ backgroundColor: "rgba(111, 251, 190, 0.2)", color: "#6ffbbe" }}
                  >
                    <span className="material-symbols-outlined text-[22px]">group</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
                      Gezgin Topluluğunda Deneyim Paylaşımı
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "rgba(255, 255, 255, 0.8)",
                        lineHeight: "1.4",
                      }}
                    >
                      Turistik tuzaklardan uzak, yerellerin onayladığı gizli cevherler parmaklarının
                      ucunda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Alt Bilgilendirme Vurgusu */}
              <div className="signup-bottom-highlight">
                <div
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "var(--mb-emerald-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">offline_pin</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--mb-mint-subtle)",
                    fontWeight: 500,
                    lineHeight: "1.5",
                  }}
                >
                  Tek bir hesapla hem web'de hem cebinde tüm rotaların çevrimdışı hazır.
                </p>
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
