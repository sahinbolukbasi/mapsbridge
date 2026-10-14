"use client";

import React, { useEffect, useState } from "react";
import { handleGoogleCredentialResponse } from "../../lib/cognito";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Oturum doğrulanıyor...");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // 1. Hash fragment içindeki tokenları kontrol et (#id_token=...&access_token=...)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash || window.location.search);

      const idToken = params.get("id_token") || params.get("credential");
      const accessToken = params.get("access_token");
      const error = params.get("error_description") || params.get("error");

      if (error) {
        setStatus(`Giriş hatası: ${error}`);
        return;
      }

      if (idToken) {
        handleGoogleCredentialResponse(idToken);
        setStatus("Giriş başarılı! Yönlendiriliyorsunuz...");
        setTimeout(() => {
          const next = new URLSearchParams(window.location.search).get("next") || "/desk/";
          window.location.assign(next.startsWith("/") ? next : "/desk/");
        }, 300);
        return;
      }

      // 2. Query params üzerinden code gelmişse
      const code = params.get("code");
      if (code) {
        setStatus("Yetkilendirme kodu alındı. Yönlendiriliyorsunuz...");
        setTimeout(() => {
          const next = new URLSearchParams(window.location.search).get("next") || "/desk/";
          window.location.assign(next.startsWith("/") ? next : "/desk/");
        }, 500);
        return;
      }

      // Hiçbir parametre yoksa panele yönlendir
      window.location.assign("/desk/");
    } catch (e: any) {
      console.error("Auth callback hatası:", e);
      setStatus("Giriş doğrulaması sırasında bir hata oluştu.");
    }
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg, #f8fafc)",
        color: "var(--text, #0f172a)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "16px",
          padding: "2.5rem",
          maxWidth: "420px",
          width: "90%",
          textAlign: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "3px solid #4285F4",
            borderTopColor: "transparent",
            borderRadius: "50%",
            margin: "0 auto 1.5rem auto",
            animation: "spin 1s linear infinite",
          }}
        />
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
          Google Kimliği Doğrulanıyor
        </h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted, #64748b)", margin: 0 }}>
          {status}
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
