"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, confirmForgotPassword, signIn } from "../lib/cognito";
import Link from "next/link";
import { Alert, Button, Checkbox, Field, Input, PageShell } from "../components/ui";
import { AuthCard, AuthPasswordInput, AuthPasswordRules } from "../components/auth/auth-card";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"send" | "confirm">("send");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signOutOtherSessions, setSignOutOtherSessions] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Alan hatası (design §6.2): mesaj Alert'te özetlenir, alan aria-invalid + odak alır.
  type ResetField = "email" | "code" | "newPassword" | "confirm";
  const [fieldError, setFieldError] = useState<Partial<Record<ResetField, string>>>({});
  const FIELD_IDS: Record<ResetField, string> = {
    email: "resetEmailInput",
    code: "verification_code",
    newPassword: "new_password",
    confirm: "confirm_password",
  };
  function failField(field: ResetField, text: string) {
    setMessage(text);
    setFieldError({ [field]: text });
    setIsLoading(false);
    document.getElementById(FIELD_IDS[field])?.focus();
  }

  // URL'den email, code veya step parametrelerini al
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get("email");
      const urlCode = params.get("code");
      const urlStep = params.get("step");

      if (urlEmail) setEmail(urlEmail);
      if (urlCode) setCode(urlCode);

      // Sadece URL'de açıkça kod veya confirm adımı belirtilmişse confirm'e geç, aksi halde her zaman önce e-posta iste
      if (urlCode || urlStep === "confirm") {
        setStep("confirm");
      } else {
        setStep("send");
      }
    }
  }, []);

  const passwordRules = [
    { id: "rule-length", label: "En az 12 karakter", valid: newPassword.length >= 12 },
    { id: "rule-lower", label: "En az bir küçük harf", valid: /[a-zğüşıöç]/.test(newPassword) },
    { id: "rule-upper", label: "En az bir büyük harf", valid: /[A-ZĞÜŞİÖÇ]/.test(newPassword) },
    { id: "rule-number", label: "En az bir rakam", valid: /[0-9]/.test(newPassword) },
    {
      id: "rule-symbol",
      label: "En az bir sembol (ör. !, ?, @, #)",
      valid: /[^A-Za-z0-9ğüşıöçĞÜŞİÖÇ]/.test(newPassword),
    },
  ];

  const isPasswordValid = passwordRules.every((r) => r.valid);

  // Adım 1: Sıfırlama kodu gönder
  async function handleSendEmailCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setStatus("");

    setFieldError({});
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      failField("email", "Lütfen e-posta adresinizi girin.");
      return;
    }

    try {
      await forgotPassword(cleanEmail);
      setStep("confirm");
      setStatus(
        `6 haneli doğrulama kodu ${cleanEmail} adresine gönderildi. Lütfen gelen kutunuzu kontrol ediniz.`,
      );
    } catch (err: unknown) {
      setMessage(
        (err instanceof Error ? err.message : null) ||
          "Doğrulama kodu gönderilemedi. Lütfen e-posta adresinizi kontrol edin.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  // Adım 2: Gelen kod ve yeni şifre ile şifreyi sıfırla
  async function handleConfirmReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    setFieldError({});

    if (!cleanEmail) {
      setMessage("Lütfen geçerli bir e-posta adresi belirtin.");
      setIsLoading(false);
      return;
    }

    if (!cleanCode || cleanCode.length < 6) {
      failField("code", "Lütfen e-postanıza gönderilen 6 haneli doğrulama kodunu eksiksiz girin.");
      return;
    }

    if (!isPasswordValid) {
      failField("newPassword", "Yeni şifreniz tüm güvenlik kurallarını sağlamalıdır.");
      return;
    }

    if (newPassword !== confirmPassword) {
      failField("confirm", "Girdiğiniz yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    try {
      await confirmForgotPassword(cleanEmail, cleanCode, newPassword);
      setStatus("Şifreniz başarıyla güncellendi. Giriş yapılıyor…");
      try {
        await signIn(cleanEmail, newPassword);
      } catch {
        router.replace("/login/?reset=success");
        return;
      }

      setTimeout(() => {
        router.push("/maps/");
      }, 1000);
    } catch (err: unknown) {
      setMessage(
        (err instanceof Error ? err.message : null) ||
          "Şifre güncellenemedi. Lütfen kodu kontrol edip tekrar deneyin.",
      );
      setIsLoading(false);
    }
  }

  // Kodu tekrar gönder
  async function handleResendCode() {
    setIsLoading(true);
    setMessage("");
    setStatus("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMessage(
        "Kodu tekrar göndermek için e-posta adresi gereklidir. Lütfen 'E-postayı Değiştir'e basıp e-postanızı girin.",
      );
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(cleanEmail);
      setStatus(`Yeni 6 haneli doğrulama kodu ${cleanEmail} adresine tekrar gönderildi.`);
    } catch (err: unknown) {
      setMessage(
        (err instanceof Error ? err.message : null) ||
          "Kod tekrar gönderilemedi. Lütfen biraz bekleyin.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const alerts = (
    <>
      {status && (
        <Alert tone="success" live="polite">
          {status}
        </Alert>
      )}
      {message && (
        <Alert tone="danger" live="assertive">
          {message}
        </Alert>
      )}
    </>
  );

  if (step === "confirm") {
    return (
      <PageShell layout="form" className="auth-card-shell">
        <AuthCard
          title="Yeni şifreni belirle"
          titleText="Şifre sıfırlama"
          description="E-postana gelen 6 haneli kodu ve yeni şifreni gir."
          footer={
            <p className="auth-card__footer-line">
              <Link className="auth-card__link" href="/login/">
                Girişe dön
              </Link>
            </p>
          }
        >
          <div className="auth-card__recipient">
            <span>
              Kod gönderilen adres:{" "}
              <span className="auth-card__recipient-email">{email.trim() || "Belirtilmedi"}</span>
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setStep("send");
                setMessage("");
                setStatus("");
              }}
            >
              E-postayı değiştir
            </Button>
          </div>
          <p className="auth-card__note">Kod gelmediyse gereksiz (spam) klasörünü de kontrol et.</p>

          {alerts}

          <form className="auth-card__form" onSubmit={handleConfirmReset} noValidate>
            <Field
              id="verification_code"
              label="6 haneli doğrulama kodu"
              required
              error={fieldError.code}
            >
              {(ids) => (
                <Input
                  {...ids}
                  size="lg"
                  maxLength={6}
                  name="verification_code"
                  placeholder="849201"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              )}
            </Field>

            <Field id="new_password" label="Yeni şifre" required error={fieldError.newPassword}>
              {(ids) => (
                <AuthPasswordInput
                  ids={ids}
                  name="new_password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  shown={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                />
              )}
            </Field>

            <AuthPasswordRules rules={passwordRules} />

            <Field
              id="confirm_password"
              label="Yeni şifre (tekrar)"
              required
              error={fieldError.confirm}
            >
              {(ids) => (
                <Input
                  {...ids}
                  size="lg"
                  name="confirm_password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              )}
            </Field>

            <Checkbox
              name="sign_out_other_sessions"
              label="Tüm açık oturumlardan çıkış yap"
              hint="Şifre yenilendikten sonra diğer cihazlardaki oturumları sonlandır (önerilir)."
              checked={signOutOtherSessions}
              onChange={setSignOutOtherSessions}
            />

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={!isPasswordValid || code.length < 6}
            >
              Şifremi sıfırla ve giriş yap
            </Button>
            <Button variant="secondary" fullWidth onClick={handleResendCode}>
              Kodu tekrar gönder
            </Button>
          </form>
        </AuthCard>
      </PageShell>
    );
  }

  return (
    <PageShell layout="form" className="auth-card-shell">
      <AuthCard
        title="Şifreni mi unuttun?"
        titleText="Şifre sıfırlama"
        description="Kayıtlı e-posta adresini gir, şifre sıfırlama kodunu hemen gönderelim."
        footer={
          <>
            <p className="auth-card__footer-line">
              Şifreni hatırladın mı?{" "}
              <Link className="auth-card__link" href="/login/">
                Giriş yap
              </Link>
            </p>
            <p className="auth-card__footer-line">
              Hesabın yok mu?{" "}
              <Link className="auth-card__link" href="/register/">
                Kayıt ol
              </Link>
            </p>
          </>
        }
      >
        {alerts}

        <form className="auth-card__form" onSubmit={handleSendEmailCode} noValidate>
          <Field
            id="resetEmailInput"
            label="Kayıtlı e-posta adresi"
            required
            error={fieldError.email}
          >
            {(ids) => (
              <Input
                {...ids}
                size="lg"
                name="email"
                placeholder="ornek@alanadi.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <p className="auth-card__note">Doğrulama kodu 15 dakika boyunca geçerlidir.</p>

          <Button type="submit" size="lg" fullWidth loading={isLoading} disabled={!email.trim()}>
            Doğrulama kodunu gönder
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setStep("confirm");
              setMessage("");
              setStatus("");
            }}
          >
            Kodum var, şifremi sıfırla
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
