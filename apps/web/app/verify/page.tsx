"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { confirmSignUp, resendConfirmationCode } from "../lib/cognito";
import { Alert, Button, Card, Field, Input, PageHeader, PageShell } from "../components/ui";
import "./verify.css";
import { DEFAULT_NEXT, readNext } from "../lib/navigation/safe-next";

export default function VerifyPage() {
  const [message, setMessage] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [seconds, setSeconds] = useState(120);
  const email =
    typeof window === "undefined" ? "" : (new URLSearchParams(location.search).get("email") ?? "");
  const phone =
    typeof window === "undefined" ? "" : (new URLSearchParams(location.search).get("phone") ?? "");

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    // İstemci doğrulaması gönderimde (design §6.2): hata alanın altında, odak alana.
    if (!/^\d{6}$/.test(code)) {
      setCodeError("6 haneli doğrulama kodunu girin.");
      codeRef.current?.focus();
      return;
    }
    setCodeError(null);
    try {
      await confirmSignUp(email, code);
      // Dönüş yolu safe-next ile doğrulanır (design §5.4, R8).
      const nextTarget = readNext(window.location.search, window.location.origin);
      const nextParam =
        nextTarget !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextTarget)}` : "";
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
    <PageShell
      className="verify-page"
      header={<PageHeader eyebrow="HESAP DOĞRULAMA" description="Doğrulama kodunu gir." />}
    >
      <Card padding="lg" className="verify-card">
        <div className="sms-icon" aria-hidden="true">
          ✉
        </div>
        {!email && !phone ? (
          <Alert
            tone="danger"
            title="E-posta adresi bulunamadı."
            action={
              <Button href="/register/" variant="link">
                Kayıt ekranına dön
              </Button>
            }
          >
            Lütfen kayıt ekranına dönerek tekrar deneyin.
          </Alert>
        ) : (
          <div className="phone-card">
            <span>Doğrulama kodu şu adrese gönderildi:</span>
            <strong>{email || phone}</strong>
            <small>Adres yanlışsa kayıt ekranına dön.</small>
          </div>
        )}
        <form className="verify-form" onSubmit={submit} noValidate>
          <Field label="Doğrulama kodu" required error={codeError}>
            {(ids) => (
              <Input
                {...ids}
                ref={codeRef}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                placeholder="123456"
              />
            )}
          </Field>
          <Button type="submit" fullWidth>
            Doğrula ve giriş yap
          </Button>
        </form>
        {message && (
          <Alert tone="danger" live="assertive">
            {message}
          </Alert>
        )}
        <Button variant="secondary" fullWidth onClick={resend} disabled={seconds > 0}>
          <span aria-hidden="true">↻</span>{" "}
          {seconds > 0
            ? `Yeni kod için ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} bekle`
            : "Doğrulama kodunu yeniden gönder"}
        </Button>
        {resendMessage && (
          <Alert tone="info" live="polite">
            {resendMessage}
          </Alert>
        )}
        <p className="fineprint">
          Kod gelmediyse e-postanın gereksiz (spam/junk) kutusunu kontrol etmeyi unutma.
        </p>
      </Card>
    </PageShell>
  );
}
