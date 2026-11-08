"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { confirmSignUp, resendConfirmationCode } from "../lib/cognito";
import { Alert, Button, Celebrate, Field, Input, PageShell } from "../components/ui";
import { AuthCard, AuthVisual } from "../components/auth/auth-card";
import { AUTH_VISUALS } from "../components/auth/auth-visuals";
import { DEFAULT_NEXT, readNext } from "../lib/navigation/safe-next";

export default function VerifyPage() {
  const [message, setMessage] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [seconds, setSeconds] = useState(120);
  const [busy, setBusy] = useState(false);
  // Kayıt başarısı (Increment 2.8): doğrulanınca Celebrate, kısa süre sonra girişe geçilir.
  const [verifiedHref, setVerifiedHref] = useState<string | null>(null);
  // Sorgu parametreleri mount sonrası okunur: render sırasında `location` okumak statik HTML ile
  // hidrasyon uyuşmazlığı (React #418) üretiyordu. `ready` öncesi "adres bulunamadı" çizilmez.
  const [params, setParams] = useState<{ email: string; phone: string; next: string } | null>(null);
  const email = params?.email ?? "";
  const phone = params?.phone ?? "";
  // Kayıt ekranına dönüşte `next` korunur (login/register ile aynı desen, design §5.4).
  const nextUrl = params?.next ?? DEFAULT_NEXT;
  const registerHref =
    nextUrl !== DEFAULT_NEXT ? `/register/?next=${encodeURIComponent(nextUrl)}` : "/register/";

  // Doğrulama e-postası bağlantısı (/dogrula/ → /verify/, karar S20) `?code=` taşır: yalnız
  // 6 haneli ise alana doldurulur. Statik HTML ile eşleşmesi için mount sonrası yazılır.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      email: search.get("email") ?? "",
      phone: search.get("phone") ?? "",
      next: readNext(window.location.search, window.location.origin),
    });
    const code = search.get("code")?.trim() ?? "";
    if (/^\d{6}$/.test(code) && codeRef.current && !codeRef.current.value) {
      codeRef.current.value = code;
    }
  }, []);

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
    setBusy(true);
    try {
      await confirmSignUp(email, code);
      // Dönüş yolu safe-next ile doğrulanır (design §5.4, R8).
      const nextTarget = readNext(window.location.search, window.location.origin);
      const nextParam =
        nextTarget !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextTarget)}` : "";
      const href = `/login/${nextParam}`;
      setVerifiedHref(href);
      window.setTimeout(() => window.location.assign(href), 1800);
    } catch (error) {
      setBusy(false);
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
    <PageShell className="auth-card-shell" aside={<AuthVisual {...AUTH_VISUALS.verify} />}>
      <AuthCard
        eyebrow="E-posta doğrulama"
        description="E-postana gönderilen 6 haneli kodu gir."
        footer={
          <p className="auth-card__footer-line">
            Kod gelmediyse e-postanın gereksiz (spam) kutusunu kontrol et.
          </p>
        }
      >
        {!params ? null : !email && !phone ? (
          <Alert
            tone="danger"
            title="E-posta adresi bulunamadı."
            action={
              <Button href={registerHref} variant="link">
                Kayıt ekranına dön
              </Button>
            }
          >
            Lütfen kayıt ekranına dönerek tekrar deneyin.
          </Alert>
        ) : (
          <div className="auth-card__recipient">
            <span>
              Kod gönderilen adres:{" "}
              <span className="auth-card__recipient-email">{email || phone}</span>
            </span>
            <Button href={registerHref} variant="link" size="sm">
              Adres yanlış mı?
            </Button>
          </div>
        )}
        {verifiedHref ? (
          <Celebrate
            title="Hesabın doğrulandı"
            message="Giriş sayfasına yönlendiriliyorsun."
            action={
              <Button href={verifiedHref} variant="primary">
                Şimdi giriş yap
              </Button>
            }
          />
        ) : (
          <form className="auth-card__form" onSubmit={submit} noValidate>
            <Field label="Doğrulama kodu" required error={codeError}>
              {(ids) => (
                <Input
                  {...ids}
                  ref={codeRef}
                  size="lg"
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
            <Button type="submit" size="lg" fullWidth loading={busy} loadingLabel="Doğrulanıyor…">
              Doğrula ve giriş yap
            </Button>
          </form>
        )}
        {message && (
          <Alert tone="danger" live="assertive">
            {message}
          </Alert>
        )}
        <Button variant="secondary" fullWidth onClick={resend} disabled={seconds > 0}>
          {seconds > 0
            ? `Yeni kod için ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} bekle`
            : "Doğrulama kodunu yeniden gönder"}
        </Button>
        {resendMessage && (
          <Alert tone="info" live="polite">
            {resendMessage}
          </Alert>
        )}
      </AuthCard>
    </PageShell>
  );
}
