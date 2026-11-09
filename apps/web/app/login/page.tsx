"use client";

import React, { FormEvent, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { signIn, handleGoogleCredentialResponse, getStoredSession } from "../lib/cognito";
import { Alert, Button, Field, Icon, Input, Modal, PageShell } from "../components/ui";
import {
  AuthCard,
  AuthVisual,
  AuthErrorSummary,
  AuthPasswordInput,
  AuthSocialButtons,
} from "../components/auth/auth-card";
import { AUTH_VISUALS } from "../components/auth/auth-visuals";
import { WELCOME_CREDITS_DISPLAY } from "../lib/billing/credit-costs";
import { DEFAULT_NEXT, readNext } from "../lib/navigation/safe-next";

interface GoogleCredentialResponse {
  credential: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const [showGoogleFallbackModal, setShowGoogleFallbackModal] = useState(false);
  // İstemci doğrulaması gönderimde (design §6.2): alan hataları + özet + ilk hatalı alana odak.
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Dönüş yolu yalnızca safe-next ile (design §5.4, R8): `next`, geriye uyumlu `redirect`.
  const nextUrl =
    typeof window !== "undefined"
      ? readNext(window.location.search, window.location.origin)
      : DEFAULT_NEXT;

  // Google OAuth Public Client ID
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

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
        console.error("Google oturum açma hatası:", err);
        setMessage(
          err instanceof Error
            ? err.message
            : "Google ile giriş başarısız oldu. Lütfen tekrar deneyin.",
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

    // 1. Google One Tap (GIS) — oturum anahtarı olarak gerçek id_token (JWT) döndürür.
    // handleCredential -> handleGoogleCredentialResponse(credential) yalnızca JWT saklar;
    // backend'in 3-parçalı JWT sözleşmesini (shared/auth.ts) karşılayan tek yol budur.
    if (google?.accounts?.id) {
      try {
        google.accounts.id.prompt((notification: GooglePromptNotification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
            console.warn("Google One Tap not displayed, showing fallback");
            setShowGoogleFallbackModal(true);
          }
        });
        // 3.5 saniye içinde yanıt gelmezse fallback göster
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

    // 2. Script yoksa veya alan adı Google Cloud'da henüz tanımlanmadıysa
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
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "E-posta adresinizi girin.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Geçerli bir e-posta adresi girin (ör. ornek@alanadi.com).";
    if (!password) errors.password = "Şifrenizi girin.";
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
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
        window.location.assign(`/verify/?email=${encodeURIComponent(email)}`);
      } else {
        setMessage(text);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell className="auth-card-shell" aside={<AuthVisual {...AUTH_VISUALS.login} />}>
      <AuthCard
        eyebrow="Tekrar hoş geldin"
        description="Rotalarına, kayıtlı duraklarına ve yol arkadaşlarına kaldığın yerden devam et."
        footer={
          <div className="auth-card__promo">
            <div className="auth-card__promo-row">
              <strong className="auth-card__promo-title">Hesabın yok mu?</strong>
              <Link
                className="auth-card__link auth-card__cta-link"
                href={
                  nextUrl !== DEFAULT_NEXT
                    ? `/register/?next=${encodeURIComponent(nextUrl)}`
                    : "/register/"
                }
              >
                Ücretsiz kayıt ol <Icon name="arrow" size={16} />
              </Link>
            </div>
            <p className="auth-card__promo-body">
              Rotalarını kaydet, kodla paylaş, yeni hesaba {WELCOME_CREDITS_DISPLAY} hoş geldin
              kredisi.
            </p>
          </div>
        }
      >
        <AuthSocialButtons
          googleLabel="Google ile giriş yap"
          appleLabel="Apple ile giriş yap"
          googleLoading={isGoogleLoading}
          appleLoading={isAppleLoading}
          onGoogle={triggerGoogleSignIn}
          onApple={triggerAppleSignIn}
        />

        <div ref={googleBtnContainerRef} hidden></div>

        <Modal
          open={showGoogleFallbackModal}
          onClose={() => setShowGoogleFallbackModal(false)}
          title="Google ile giriş"
          description="Google ile giriş şu anda gerçekleştirilemedi. Bu durum genellikle tarayıcınızın pop-up engelleyicisinden kaynaklanır."
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
            <li>Veya e-posta ve şifre ile giriş yapın</li>
          </ul>
        </Modal>

        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <AuthErrorSummary
            errors={[
              ...(fieldErrors.email
                ? [{ id: "emailInput", label: "E-posta", text: fieldErrors.email }]
                : []),
              ...(fieldErrors.password
                ? [{ id: "passwordInput", label: "Şifre", text: fieldErrors.password }]
                : []),
            ]}
          />
          <Field id="emailInput" label="E-posta" required error={fieldErrors.email}>
            {(ids) => (
              <Input
                {...ids}
                ref={emailRef}
                size="lg"
                iconStart="inbox"
                name="email"
                placeholder="ornek@alanadi.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field id="passwordInput" label="Şifre" required error={fieldErrors.password}>
            {(ids) => (
              <AuthPasswordInput
                ids={ids}
                ref={passwordRef}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                shown={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
            )}
          </Field>

          <div className="auth-card__row">
            <Link
              className="auth-card__link"
              href={`/reset-password/${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            >
              Şifremi unuttum
            </Link>
          </div>

          {/* Sunucu hatası (design §6.2: Alert danger assertive) */}
          {message && (
            <Alert tone="danger" live="assertive" title={message}>
              {message.toLowerCase().includes("hatalı") && (
                <>
                  Şifreni hatırlamıyorsan:{" "}
                  <Link
                    className="auth-card__link"
                    href={`/reset-password/?email=${encodeURIComponent(email)}`}
                  >
                    Şifremi sıfırla
                  </Link>
                </>
              )}
            </Alert>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isLoading}
            loadingLabel="Giriş yapılıyor…"
            iconEnd={<Icon name="arrow" size={20} />}
          >
            Giriş yap
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
