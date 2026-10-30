"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { handleGoogleCredentialResponse } from "../lib/cognito";
import { GoogleLogo } from "./ui";

interface GoogleCredentialResponse {
  credential: string;
}
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
  nextUrl = "/maps/",
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
          : "/maps/";
      window.location.assign(safeNext);
    } catch {
      window.location.assign("/maps/");
    }
  }, [nextUrl]);

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
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
      } catch (err: unknown) {
        console.error("Google oturum açma hatası:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "Google ile giriş başarısız oldu. Lütfen tekrar deneyin.";
        setErrorMessage(msg);
        if (onError) onError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError, redirectToNext],
  );

  const initGoogleSignIn = useCallback(() => {
    const google = window.google;
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
    } else if (window.google?.accounts?.id) {
      initGoogleSignIn();
    }
  }, [clientId, initGoogleSignIn]);

  const handleManualClick = () => {
    const google = window.google;
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
        >
          <span className="google-icon-wrapper">
            <GoogleLogo size={20} />
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

      {errorMessage && (
        <p className="google-auth-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
