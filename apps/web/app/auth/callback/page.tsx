"use client";

import React, { useEffect, useState } from "react";
import { handleGoogleCredentialResponse } from "../../lib/cognito";
import "./callback.css";
import { readNext } from "../../lib/navigation/safe-next";
import { Card, PageHeader, PageShell } from "../../components/ui";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Oturum doğrulanıyor...");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // 1. Hash fragment içindeki tokenları kontrol et (#id_token=...&access_token=...)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash || window.location.search);

      const idToken = params.get("id_token") || params.get("credential");
      const _accessToken = params.get("access_token");
      const error = params.get("error_description") || params.get("error");

      if (error) {
        setStatus(`Giriş hatası: ${error}`);
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

      // Hiçbir parametre yoksa panele yönlendir
      window.location.assign("/maps/");
    } catch (e: unknown) {
      console.error("Auth callback hatası:", e);
      setStatus("Giriş doğrulaması sırasında bir hata oluştu.");
    }
  }, []);

  return (
    <PageShell
      className="auth-callback"
      header={
        <PageHeader description="Google kimliğiniz doğrulanıyor; birazdan yönlendirileceksiniz." />
      }
    >
      <Card padding="lg" className="auth-callback__card">
        <div className="auth-callback-spinner" aria-hidden="true" />
        <h2 className="auth-callback__title">Google Kimliği Doğrulanıyor</h2>
        <p className="auth-callback__status" role="status">
          {status}
        </p>
      </Card>
    </PageShell>
  );
}
