"use client";

import Link from "next/link";
import React, { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import { signUp, handleGoogleCredentialResponse, getStoredSession } from "../lib/cognito";
import { Alert, Button, Field, Input, Modal, PageShell } from "../components/ui";
import {
  AuthCard,
  AuthErrorSummary,
  AuthPasswordInput,
  AuthPasswordRules,
  AuthSocialButtons,
} from "../components/auth/auth-card";
import { DEFAULT_NEXT, readNext } from "../lib/navigation/safe-next";

interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleTokenResponse {
  error?: string;
  access_token?: string;
}

// Kayıt yalnız e-posta + şifre ister (design F15). Ad, kullanıcı adı ve telefon profil adımına
// aittir; Cognito SignUp `name` özniteliğini zorunlu tuttuğu için handleSubmit bugünkü otomatik
// türetmeyi (e-posta öneki) korur.
type FieldKey = "email" | "password";
const FIELD_ORDER: readonly FieldKey[] = ["email", "password"];
const FIELD_LABELS: Record<FieldKey, string> = {
  email: "E-posta",
  password: "Şifre",
};

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const [showAppleFallbackModal, setShowAppleFallbackModal] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Dönüş yolu yalnızca safe-next ile (design §5.4, R8): `next`, geriye uyumlu `redirect`.
  const nextUrl =
    typeof window !== "undefined"
      ? readNext(window.location.search, window.location.origin)
      : DEFAULT_NEXT;

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
    window.location.assign(nextUrl);
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
    // Yalnızca e-posta + şifre (KVKK veri minimizasyonu, design F15).
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
    // Telefon formda yok (F15): bugünkü "telefon girilmedi" değeri (boş) gönderilir.
    const cleanPhone = "";
    // Kullanıcı adı bugünkü otomatik türetmeyle e-posta önekinden üretilir.
    const cleanUser = cleanEmail
      .split("@")[0]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    // Cognito 'name' attribute'u zorunlu: kullanıcı adı > e-posta öneki (ad soyad formda yok).
    const cleanName = cleanUser || cleanEmail.split("@")[0];

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
      const nextParam = nextUrl !== DEFAULT_NEXT ? `&next=${encodeURIComponent(nextUrl)}` : "";
      window.location.assign(
        `/verify/?email=${encodeURIComponent(cleanEmail)}&phone=${encodeURIComponent(cleanPhone)}${nextParam}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kayıt tamamlanamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell layout="form" className="auth-card-shell">
      <AuthCard
        description="E-posta ve şifreyle ücretsiz hesap aç; rotaların tüm cihazlarında seninle olsun."
        footer={
          <>
            <p className="auth-card__footer-line">
              Zaten hesabın var mı?{" "}
              <Link
                className="auth-card__link"
                data-path="giris"
                href={
                  nextUrl !== DEFAULT_NEXT
                    ? `/login/?next=${encodeURIComponent(nextUrl)}`
                    : "/login/"
                }
              >
                Giriş yap
              </Link>
            </p>
            <p className="auth-card__legal">
              Devam ederek{" "}
              <Link className="auth-card__link" href="/privacy/">
                Gizlilik Politikası
              </Link>{" "}
              ve{" "}
              <Link className="auth-card__link" href="/terms/">
                Kullanım Koşulları
              </Link>
              &apos;nı kabul edersin.
            </p>
          </>
        }
      >
        <AuthSocialButtons
          googleLabel="Google ile kayıt ol"
          appleLabel="Apple ile kayıt ol"
          googleLoading={isGoogleLoading}
          appleLoading={isAppleLoading}
          onGoogle={triggerGoogleSignUp}
          onApple={triggerAppleSignUp}
        />

        <div ref={googleBtnContainerRef} hidden></div>

        <Modal
          open={showAppleFallbackModal}
          onClose={() => setShowAppleFallbackModal(false)}
          title="Apple ile kayıt"
          description="Apple ile kayıt özelliği yakında kullanıma sunulacaktır."
          size="sm"
          footer={
            <Button fullWidth onClick={() => setShowAppleFallbackModal(false)}>
              Anladım, e-posta ile devam et
            </Button>
          }
        >
          <p className="auth-card__note">
            Şimdilik e-posta ve şifre ile hızlıca hesap oluşturabilirsin.
          </p>
        </Modal>

        <Modal
          open={showGoogleFallbackModal}
          onClose={() => setShowGoogleFallbackModal(false)}
          title="Google ile kayıt"
          description="Google ile kayıt şu anda gerçekleştirilemedi. Bu durum genellikle tarayıcınızın pop-up engelleyicisinden kaynaklanır."
          size="sm"
          footer={
            <Button fullWidth onClick={() => setShowGoogleFallbackModal(false)}>
              Anladım, e-posta ile devam et
            </Button>
          }
        >
          <ul className="auth-card__summary">
            <li>Tarayıcınızda pop-up engelleyicisini kapatıp tekrar deneyin</li>
            <li>Farklı bir tarayıcı kullanın</li>
            <li>Veya e-posta ve şifre ile kayıt olun</li>
          </ul>
        </Modal>

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <AuthErrorSummary
            errors={errorList.map(([key, text]) => ({ id: key, label: FIELD_LABELS[key], text }))}
          />
          <Field id="email" label="E-posta" required error={fieldErrors.email}>
            {(ids) => (
              <Input
                {...ids}
                size="lg"
                name="email"
                placeholder="deniz@ornek.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field id="password" label="Şifre" required error={fieldErrors.password}>
            {(ids) => (
              <AuthPasswordInput
                ids={ids}
                name="password"
                autoComplete="new-password"
                placeholder="Güçlü bir şifre belirle"
                value={password}
                onChange={setPassword}
                shown={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
            )}
          </Field>

          <AuthPasswordRules rules={rules} />

          {/* Sunucu hatası (design §6.2: Alert danger assertive) */}
          {message && (
            <Alert tone="danger" live="assertive">
              {message}
            </Alert>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={password.length > 0 && !isPasswordValid}
          >
            Hesap oluştur
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
