"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { handleGoogleCredentialResponse } from "../lib/cognito";

interface GoogleAuthButtonProps {
  mode?: "signin" | "signup";
  nextUrl?: string;
  onSuccess?: (user: { email: string; name: string }) => void;
  onError?: (error: string) => void;
  className?: string;
}

// Env var derleme zamanında kontrol edilir; undefined ise bileşeni render etme
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleAuthButton({
  mode = "signin",
  nextUrl = "/desk/",
  onSuccess,
  onError,
  className = "",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Hooks always called — guard render after hooks
  if (!GOOGLE_CLIENT_ID) {
    if (process.env.NODE_ENV === "development") {
      console.error("GoogleAuthButton: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
    }
    return null;
  }

  const clientId = GOOGLE_CLIENT_ID;

  const redirectToNext = useCallback(() => {
    try {
      const target = new URL(nextUrl, window.location.origin);
      const safeNext =
        target.origin === window.location.origin
          ? target.pathname + target.search + target.hash
          : "/desk/";
      window.location.assign(safeNext);
    } catch {
      window.location.assign("/desk/");
    }
  }, [nextUrl]);

  const handleCredential = useCallback(
    (response: any) => {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const res = handleGoogleCredentialResponse(response.credential);
        if (res) {
          if (onSuccess) {
            onSuccess({ email: res.email, name: res.name });
          } else {
            redirectToNext();
          }
        }
      } catch (err: any) {
        console.error("Google oturum açma hatası:", err);
        const msg = err.message || "Google ile giriş başarısız oldu. Lütfen tekrar deneyin.";
        setErrorMessage(msg);
        if (onError) onError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError, redirectToNext],
  );

  const initGoogleSignIn = useCallback(() => {
    const google = (window as any).google;
    if (!google?.accounts?.id || !clientId) return;

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: true, // Otomatik tek tıkla giriş desteği
        cancel_on_tap_outside: false,
      });

      // Google'ın resmi ve güvenli butonunu render et
      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = "";
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: mode === "signup" ? "signup_with" : "signin_with",
          logo_alignment: "left",
          width: 360,
          locale: window.location.pathname.startsWith("/en") ? "en" : "tr",
        });
      }

      // Kullanıcı henüz giriş yapmamışsa One Tap kartını göster
      try {
        const currentToken =
          localStorage.getItem("mapsbridge.idToken") || localStorage.getItem("mapsbridge.idToken");
        if (!currentToken) {
          google.accounts.id.prompt();
        }
      } catch {
        // ignore
      }
    } catch (e) {
      console.warn("Google GIS başlatma hatası:", e);
    }
  }, [clientId, handleCredential, mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingScript = document.getElementById("google-gsi-client");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleSignIn();
      };
      document.head.appendChild(script);
    } else if ((window as any).google?.accounts?.id) {
      initGoogleSignIn();
    }
  }, [clientId, initGoogleSignIn]);

  const handleManualClick = () => {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt();
    }
  };

  return (
    <div className={`google-auth-wrapper ${className}`}>
      {/* Google Identity Services tarafından render edilen buton alanı */}
      <div
        ref={googleBtnContainerRef}
        className="google-gis-container"
        style={{ minHeight: "44px", width: "100%", display: "flex", justifyContent: "center" }}
      >
        {/* GIS henüz yüklenirken veya js kapalıyken gösterilen sade şık buton */}
        <button
          type="button"
          className="google-auth-btn"
          onClick={handleManualClick}
          disabled={isLoading}
          aria-label={mode === "signup" ? "Google ile Kayıt Ol" : "Google ile Giriş Yap"}
        >
          <span className="google-icon-wrapper">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </span>
          <span className="google-btn-text">
            {isLoading
              ? "Google'a Bağlanıyor..."
              : mode === "signup"
                ? "Google ile Kayıt Ol"
                : "Google ile Giriş Yap"}
          </span>
        </button>
      </div>

      {errorMessage && <p className="google-auth-error">{errorMessage}</p>}
    </div>
  );
}
