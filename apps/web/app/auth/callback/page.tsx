"use client";
import React, { useEffect, useState } from "react";
import { handleGoogleCredentialResponse } from "../../lib/cognito";
import "./callback.css";
import { readNext } from "../../lib/navigation/safe-next";
import { Button, ErrorState, PageShell, type UiError } from "../../components/ui";
import { AuthCard } from "../../components/auth/auth-card";

// Kod yoksa ya da değişim başarısızsa sessiz /maps/ yönlendirmesi yerine gösterilir (design §5.4,
// §12.1, F22). Yalnız UI: token işleme ve başarı yönlendirmesi değişmez.
const FAILED: UiError = {
  kind: "unknown",
  title: "Giriş tamamlanamadı",
  message: "Oturumun doğrulanamadı. Girişe dönüp tekrar deneyebilirsin.",
  retryable: false,
};

function warnDev(reason: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn("Auth callback:", reason, detail ?? "");
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Oturum doğrulanıyor...");
  const [failed, setFailed] = useState(false);
  const [loginHref, setLoginHref] = useState("/login/");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fail = (reason: string, detail?: unknown) => {
      warnDev(reason, detail);
      setLoginHref(
        `/login/?next=${encodeURIComponent(readNext(window.location.search, window.location.origin))}`,
      );
      setFailed(true);
    };
    try {
      // 1. Hash fragment içindeki tokenları kontrol et (#id_token=...&access_token=...)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash || window.location.search);
      const idToken = params.get("id_token") || params.get("credential");
      const _accessToken = params.get("access_token");
      const error = params.get("error_description") || params.get("error");
      if (error) {
        fail("provider error", error);
        return;
      }
      if (idToken) {
        handleGoogleCredentialResponse(idToken);
        setStatus("Giriş başarılı! Yönlendiriliyorsunuz...");
        setTimeout(() => {
          window.location.assign(readNext(window.location.search, window.location.origin));
        }, 300);
        return;
      }
      // 2. Query params üzerinden code gelmişse
      const code = params.get("code");
      if (code) {
        setStatus("Yetkilendirme kodu alındı. Yönlendiriliyorsunuz...");
        setTimeout(() => {
          window.location.assign(readNext(window.location.search, window.location.origin));
        }, 500);
        return;
      }
      // Hiçbir parametre yok: kod eksik.
      fail("missing code");
    } catch (e: unknown) {
      fail("exchange failed", e);
    }
  }, []);
  if (failed) {
    return (
      <PageShell className="auth-card-shell">
        <AuthCard titleText="Oturum doğrulanıyor" title="Google ile giriş">
          <ErrorState error={FAILED} />
          <Button href={loginHref} size="lg" fullWidth>
            Girişe dön
          </Button>
        </AuthCard>
      </PageShell>
    );
  }
  return (
    <PageShell className="auth-card-shell">
      <AuthCard description="Google kimliğin doğrulanıyor; birazdan yönlendirileceksin.">
        <div className="auth-callback__progress">
          <div className="auth-callback-spinner" aria-hidden="true" />
          <p className="auth-callback__status" role="status">
            {status}
          </p>
        </div>
      </AuthCard>
    </PageShell>
  );
}
