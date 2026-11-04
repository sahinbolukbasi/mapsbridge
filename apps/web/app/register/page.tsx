"use client";

import React, { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { signUp, handleGoogleCredentialResponse, getStoredSession } from "../lib/cognito";
import {
  Alert,
  Button,
  Field,
  GoogleLogo,
  IconButton,
  Modal,
  PageHeader,
  PageShell,
} from "../components/ui";
import "./register.css";

interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleTokenResponse {
  error?: string;
  access_token?: string;
}

type FieldKey = "username" | "fullname" | "email" | "phone" | "password";
const FIELD_ORDER: readonly FieldKey[] = ["username", "fullname", "email", "phone", "password"];
const FIELD_LABELS: Record<FieldKey, string> = {
  username: "Kullanıcı adı",
  fullname: "Ad soyad",
  email: "E-posta",
  phone: "Telefon",
  password: "Şifre",
};

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
  // İstemci doğrulaması gönderimde (design §6.2): alan hataları + özet + ilk hatalı alana odak.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const errorList = FIELD_ORDER.flatMap((key) =>
    fieldErrors[key] ? [[key, fieldErrors[key]] as [FieldKey, string]] : [],
  );

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
    (response: GoogleCredentialResponse) => {
      try {
        setIsGoogleLoading(true);
        setMessage("");
        const res = handleGoogleCredentialResponse(response.credential);
        if (res) {
          redirectToNext();
        }
      } catch (err: unknown) {
        console.error("Google kayıt hatası:", err);
        setMessage(
          err instanceof Error
            ? err.message
            : "Google ile kayıt başarısız oldu. Lütfen tekrar deneyin.",
        );
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
    const google = typeof window !== "undefined" ? window.google : null;

    // 1. Google OAuth 2.0 Token Client popup akışı
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
                const profile = (await userRes.json()) as {
                  email?: string;
                  name?: string;
                  given_name?: string;
                  picture?: string;
                };
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
    const errors: Partial<Record<FieldKey, string>> = {};
    // Yalnızca e-posta + şifre zorunlu (KVKK veri minimizasyonu). Ad/kullanıcı adı/telefon opsiyonel.
    if (!email.trim()) errors.email = "E-posta adresinizi girin.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Geçerli bir e-posta adresi girin (ör. deniz@ornek.com).";
    if (!password) errors.password = "Bir şifre belirleyin.";
    else if (!isPasswordValid) errors.password = "Şifre güvenlik kriterlerinin tümünü karşılamalı.";
    setFieldErrors(errors);
    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setIsLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanUser = (username || cleanEmail.split("@")[0])
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    // Cognito 'name' attribute'u zorunlu: ad soyad > kullanıcı adı > e-posta öneki.
    const cleanName = fullname.trim() || cleanUser || cleanEmail.split("@")[0];

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
    <PageShell layout="landing" className="signup-viewport">
      {/* Main Split Content */}
      <div className="signup-main">
        <div className="signup-container">
          <div className="signup-grid">
            {/* Sol Sütun: Kayıt Formu (lg:col-span-7) */}
            <div className="signup-card-left">
              {/* Rozet */}
              <div className="signup-badge-wrapper">
                <span className="signup-badge">GÜVENLİ BAŞLANGIÇ</span>
                <span className="signup-pulse-dot"></span>
              </div>

              <PageHeader title="Hesabını oluştur." titleText="Hesap oluştur" />
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
                  <GoogleLogo size={19} />
                  <span>{isGoogleLoading ? "Bağlanıyor..." : "Google ile Kayıt Ol"}</span>
                </button>

                <button
                  className="signup-apple-btn"
                  data-surface="inverse"
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

              <Modal
                open={showAppleFallbackModal}
                onClose={() => setShowAppleFallbackModal(false)}
                title="Apple ile Kayıt"
                description="Apple ile kayıt özelliği yakında kullanıma sunulacaktır."
                size="sm"
                footer={
                  <Button fullWidth onClick={() => setShowAppleFallbackModal(false)}>
                    Anladım, E-posta ile Devam Et
                  </Button>
                }
              >
                <p className="signup-fallback-text">
                  Şimdilik aşağıdaki formu kullanarak e-posta ve şifre ile hızlıca hesap
                  oluşturabilirsiniz.
                </p>
              </Modal>

              <Modal
                open={showGoogleFallbackModal}
                onClose={() => setShowGoogleFallbackModal(false)}
                title={
                  <span className="signup-fallback-title">
                    <GoogleLogo size={22} /> Google ile Kayıt
                  </span>
                }
                description="Google ile kayıt şu anda gerçekleştirilemedi. Bu durum genellikle tarayıcınızın pop-up engelleyicisinden kaynaklanır."
                size="sm"
                footer={
                  <Button fullWidth onClick={() => setShowGoogleFallbackModal(false)}>
                    Anladım, E-posta ile Devam Et
                  </Button>
                }
              >
                <ul className="signup-fallback-list">
                  <li>Tarayıcınızda pop-up engelleyicisini kapatıp tekrar deneyin</li>
                  <li>Farklı bir tarayıcı kullanın (Chrome önerilir)</li>
                  <li>Veya aşağıdan e-posta ve şifre ile kayıt olun</li>
                </ul>
              </Modal>

              {/* Ayraç */}
              <div className="signup-divider">
                <div className="signup-divider-line"></div>
                <span className="signup-divider-text">veya e-posta ile</span>
              </div>

              {/* Kayıt Form Alanları */}
              <form onSubmit={handleSubmit} noValidate>
                {errorList.length > 0 && (
                  <Alert tone="danger" live="assertive" title="Lütfen şu alanları düzeltin:">
                    <ul className="signup-error-summary">
                      {errorList.map(([key, text]) => (
                        <li key={key}>
                          <a
                            href={`#${key}`}
                            onClick={(ev) => {
                              ev.preventDefault();
                              document.getElementById(key)?.focus();
                            }}
                          >
                            {FIELD_LABELS[key]}: {text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Alert>
                )}
                {/* Kullanıcı Adı */}
                <Field
                  id="username"
                  label="Kullanıcı Adı (opsiyonel)"
                  error={fieldErrors.username}
                  className="signup-form-group"
                  hint={
                    <span className="signup-help-text">
                      <span
                        className="material-symbols-outlined signup-help-icon"
                        aria-hidden="true"
                      >
                        link
                      </span>
                      Herkese açık profil adresin:{" "}
                      <span className="signup-help-strong">
                        mapsbridge.com/{username || "kullaniciadi"}
                      </span>
                    </span>
                  }
                >
                  {(ids) => (
                    <div className="signup-input-wrapper">
                      <span className="signup-input-at" aria-hidden="true">
                        @
                      </span>
                      <input
                        {...ids}
                        className="signup-input signup-input--at"
                        name="username"
                        placeholder="gezginrotasi"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                        }
                      />
                    </div>
                  )}
                </Field>

                {/* Ad Soyad & E-posta Grid */}
                <div className="signup-name-grid">
                  <Field
                    id="fullname"
                    label="Ad Soyad (opsiyonel)"
                    error={fieldErrors.fullname}
                    className="signup-form-group"
                  >
                    {(ids) => (
                      <input
                        {...ids}
                        className="signup-input"
                        name="fullname"
                        placeholder="Deniz Yılmaz"
                        type="text"
                        autoComplete="name"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                      />
                    )}
                  </Field>

                  <Field
                    id="email"
                    label="E-posta"
                    required
                    error={fieldErrors.email}
                    className="signup-form-group"
                  >
                    {(ids) => (
                      <input
                        {...ids}
                        className="signup-input"
                        name="email"
                        placeholder="deniz@ornek.com"
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    )}
                  </Field>
                </div>

                {/* Telefon */}
                <Field
                  id="phone"
                  label="Telefon (opsiyonel)"
                  error={fieldErrors.phone}
                  className="signup-form-group"
                  hint={
                    <span className="signup-help-text">
                      <span
                        className="material-symbols-outlined signup-help-icon"
                        aria-hidden="true"
                      >
                        info
                      </span>
                      İstersen ekle; hesap güvenliği ve önemli bildirimler için kullanılır.
                      Doğrulama e-posta ile yapılır. Örn: +905551234567
                    </span>
                  }
                >
                  {(ids) => (
                    <div className="signup-input-wrapper">
                      <span
                        className="material-symbols-outlined signup-input-phone-icon"
                        aria-hidden="true"
                      >
                        call
                      </span>
                      <input
                        {...ids}
                        className="signup-input signup-input--icon"
                        name="phone"
                        placeholder="+905551234567"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  )}
                </Field>

                {/* Şifre */}
                <Field
                  id="password"
                  label="Şifre"
                  required
                  error={fieldErrors.password}
                  className="signup-form-group"
                >
                  {(ids) => (
                    <div className="signup-input-wrapper">
                      <input
                        {...ids}
                        className="signup-input signup-input--toggle"
                        name="password"
                        placeholder="Güçlü bir şifre belirleyin"
                        required
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <IconButton
                        className="login-password-toggle"
                        variant="ghost"
                        size="sm"
                        icon={showPassword ? "visibility_off" : "visibility"}
                        label="Şifreyi göster"
                        pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      />
                    </div>
                  )}
                </Field>

                {/* Şifre Kriterleri Kontrol Listesi */}
                <div className="signup-password-rules">
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--color-text-muted)",
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
                          className="material-symbols-outlined"
                          style={{
                            color: r.valid ? "var(--color-accent)" : "var(--color-border-control)",
                          }}
                        >
                          {r.valid ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sunucu hatası (design §6.2: Alert danger assertive) */}
                {message && (
                  <Alert tone="danger" live="assertive">
                    {message}
                  </Alert>
                )}

                {/* Ana Gönderim Butonu */}
                <button
                  className="signup-submit-btn"
                  type="submit"
                  disabled={isLoading || (password.length > 0 && !isPasswordValid)}
                >
                  <span>{isLoading ? "Hesap oluşturuluyor…" : "Doğrulama kodunu gönder"}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
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
                      color: "var(--color-text-brand)",
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
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </a>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "color-mix(in srgb, var(--color-text-muted) 80%, transparent)",
                  }}
                >
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
            <div data-surface="inverse" className="signup-card-right">
              {/* Arka Plan Görseli */}
              <div
                className="signup-bg-image"
                style={{ backgroundImage: "url('/images/tokyo-shinjuku.jpg')" }}
              ></div>
              {/* Gradyan & Multiply Katmanları */}
              <div className="signup-bg-overlay" data-surface="inverse"></div>
              <div className="signup-bg-multiply" data-surface="inverse"></div>

              {/* Üst Katman: Rozet & Konum Göstergesi */}
              <div className="signup-top-layer">
                <div className="signup-city-pill">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "var(--color-link-inverse)" }}
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
                      backgroundColor: "var(--color-link-inverse)",
                      boxShadow: "0 0 6px var(--color-link-inverse)",
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
                      backgroundColor:
                        "color-mix(in srgb, var(--color-accent-strong) 20%, transparent)",
                      color: "var(--color-link-inverse)",
                    }}
                  >
                    <span className="material-symbols-outlined">pin</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                      }}
                    >
                      6 Haneli Kod ile Anında Eşitleme
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)",
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
                      backgroundColor:
                        "color-mix(in srgb, var(--color-surface-brand-soft) 20%, transparent)",
                      color: "var(--color-surface-brand-soft)",
                    }}
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                      }}
                    >
                      AI Destekli Rota Optimizasyonu
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)",
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
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--color-accent-strong) 20%, transparent)",
                      color: "#6ffbbe",
                    }}
                  >
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                      }}
                    >
                      Gezgin Topluluğunda Deneyim Paylaşımı
                    </span>
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "13px",
                        color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)",
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
              <div className="signup-bottom-highlight" data-surface="inverse">
                <div
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--color-accent-a20)",
                    color: "var(--color-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined">offline_pin</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--color-surface-brand)",
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
      </div>
    </PageShell>
  );
}
