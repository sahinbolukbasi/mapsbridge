"use client";

import { useEffect } from "react";
import { handleGoogleCredentialResponse } from "../lib/cognito";

interface GoogleCredentialResponse {
  credential: string;
}
export function GoogleOneTap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Kullanıcı zaten oturum açmış mı veya giriş/kayıt sayfasında mı?
    try {
      const pathname = window.location.pathname;
      if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
        return; // Bu sayfalarda GoogleAuthButton butonu ve prompt'u doğrudan yönetir
      }
      const activeToken =
        localStorage.getItem("mapsbridge.idToken") || localStorage.getItem("mapsbridge.idToken");
      if (activeToken) return; // Oturum zaten var, One Tap göstermeye gerek yok
    } catch {
      // ignore
    }

    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      localStorage.getItem("mapsbridge.googleClientId") ||
      "";

    if (!clientId) return;

    const initOneTap = () => {
      const google = window.google;
      if (!google?.accounts?.id) return;

      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: GoogleCredentialResponse) => {
            try {
              const res = handleGoogleCredentialResponse(response.credential);
              if (res) {
                // Giriş başarılı, sayfayı yenile veya yönlendir
                if (
                  window.location.pathname.startsWith("/login") ||
                  window.location.pathname.startsWith("/register")
                ) {
                  window.location.assign("/maps/");
                } else {
                  window.location.reload();
                }
              }
            } catch (err) {
              console.error("Google One Tap giriş hatası:", err);
            }
          },
          auto_select: true, // Otomatik giriş (kullanıcının onaylı hesabı varsa tek tıkla veya otomatik)
          cancel_on_tap_outside: false,
        });

        // One Tap arayüzünü sağ üstte otomatik olarak tetikle
        google.accounts.id.prompt((notification: GooglePromptNotification) => {
          if (notification.isNotDisplayed()) {
            console.warn("Google One Tap gösterilmedi:", notification.getNotDisplayedReason());
          } else if (notification.isSkippedMoment()) {
            console.warn("Google One Tap atlandı:", notification.getSkippedReason());
          }
        });
      } catch (e) {
        console.warn("Google One Tap başlatılamadı:", e);
      }
    };

    const existingScript = document.getElementById("google-gsi-client");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initOneTap;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initOneTap();
    }
  }, []);

  return null;
}
