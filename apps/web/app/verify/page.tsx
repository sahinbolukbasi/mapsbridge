"use client";

import { FormEvent, useEffect, useState } from "react";
import { confirmSignUp, resendConfirmationCode } from "../lib/cognito";

export default function VerifyPage() {
  const [message, setMessage] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [seconds, setSeconds] = useState(120);
  const email = typeof window === "undefined" ? "" : new URLSearchParams(location.search).get("email") ?? "";
  const phone = typeof window === "undefined" ? "" : new URLSearchParams(location.search).get("phone") ?? "";

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    try {
      await confirmSignUp(email, code);
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const nextTarget = params?.get("next");
      const nextParam = nextTarget ? `?next=${encodeURIComponent(nextTarget)}` : "";
      window.location.assign(`/login/${nextParam}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kod doğrulanamadı.");
    }
  }

  async function resend() {
    setResendMessage("");
    try {
      await resendConfirmationCode(email);
      setResendMessage("Yeni doğrulama kodu e-posta adresine gönderildi.");
      setSeconds(120);
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : "Kod yeniden gönderilemedi.");
    }
  }

  return (
    <main className="auth verify">
      <a className="brand" href="/">
        <span>●</span> MapsBridge
      </a>
      <section>
        <p className="eyebrow">HESAP DOĞRULAMA</p>
        <div className="sms-icon" aria-hidden="true">✉</div>
        <h1>Doğrulama kodunu gir.</h1>
        {!email && !phone ? (
          <div className="phone-card" style={{ borderColor: "#ba1a1a" }}>
            <span style={{ color: "#ba1a1a", fontWeight: 600 }}>E-posta adresi bulunamadı.</span>
            <small>Lütfen kayıt ekranına dönerek tekrar deneyin.</small>
            <a href="/register/" style={{ display: "inline-block", marginTop: "0.5rem", fontWeight: 700, color: "var(--primary, #10b981)" }}>
              Kayıt ekranına dön
            </a>
          </div>
        ) : (
        <div className="phone-card">
          <span>Doğrulama kodu şu adrese gönderildi:</span>
          <strong>{email || phone}</strong>
          <small>Adres yanlışsa kayıt ekranına dön.</small>
        </div>
        )}
        <form onSubmit={submit}>
          <label>
            Doğrulama kodu
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              placeholder="123456"
            />
          </label>
          <button className="primary full">Doğrula ve giriş yap</button>
        </form>
        {message && <p className="error" role="alert">{message}</p>}
        <button className="resend-button" type="button" onClick={resend} disabled={seconds > 0}>
          <span aria-hidden="true">↻</span>
          {seconds > 0 ? `Yeni kod için ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} bekle` : "Doğrulama kodunu yeniden gönder"}
        </button>
        {resendMessage && <p role="status" style={{ color: "var(--success)", fontWeight: 600 }}>{resendMessage}</p>}
        <p className="fineprint">Kod gelmediyse e-postanın gereksiz (spam/junk) kutusunu kontrol etmeyi unutma.</p>
      </section>
    </main>
  );
}
