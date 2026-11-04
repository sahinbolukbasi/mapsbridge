"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, confirmForgotPassword, signIn } from "../lib/cognito";
import { Alert, Field, IconButton, PageHeader, PageShell } from "../components/ui";
import "./reset-password.css";
import "./reset-password-layout.css";

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

  return (
    <PageShell layout="landing" className="reset-viewport">
      {/* Main Content */}
      <div className="reset-main">
        <div className="reset-grid-layout">
          {/* LEFT COLUMN: Form Container */}
          <section className="reset-form-container" data-purpose="password-reset-form-container">
            {step === "confirm" ? (
              /* EKRAN: Yeni Şifreni Belirle (Stitch ID: e1448b6e243646aaa7e16ac011c0e6b1) */
              <>
                {/* Header Pill Badge */}
                <div className="reset-pill-badge">
                  <span className="reset-pulse-dot"></span>
                  <span className="reset-pill-text">GÜVENLİ HESAP KURTARMA</span>
                </div>

                {/* Section Title & Subtext */}
                <PageHeader title="Yeni Şifreni Belirle" titleText="Şifre sıfırlama" />
                <p className="reset-desc">
                  E-postanıza gelen 6 haneli doğrulama kodunu ve yeni şifrenizi girerek hesabınızı
                  güncelleyin.
                </p>

                {/* Notification Banner */}
                <div className="reset-notice-banner" data-purpose="email-sent-notice">
                  <svg
                    className="w-5 h-5 rp-1 text-mint-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    style={{ color: "var(--color-success-strong)", marginTop: "2px" }}
                  >
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <div>
                    6 haneli doğrulama kodu{" "}
                    <strong className="reset-notice-strong">
                      {email.trim() || "kayıtlı e-posta"}
                    </strong>{" "}
                    adresine gönderildi. Lütfen gelen kutunuzu (ve Gereksiz/Spam klasörünü) kontrol
                    ediniz.
                  </div>
                </div>

                {/* Recipient Information Strip */}
                <div className="reset-recipient-strip">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Alıcı:</span>
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {email.trim() || "Belirtilmedi"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="reset-change-email-btn"
                    onClick={() => {
                      setStep("send");
                      setMessage("");
                      setStatus("");
                    }}
                  >
                    E-postayı Değiştir
                  </button>
                </div>

                {/* Status / Error Alerts */}
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

                {/* Confirm Form */}
                <form className="reset-form" onSubmit={handleConfirmReset} noValidate>
                  {/* Verification Code Field */}
                  <Field
                    id="verification_code"
                    label="6 Haneli Doğrulama Kodu"
                    required
                    error={fieldError.code}
                  >
                    {(ids) => (
                      <div className="reset-input-container">
                        <input
                          {...ids}
                          className="reset-code-input"
                          maxLength={6}
                          name="verification_code"
                          placeholder="Örn: 849201"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        />
                        {code.length === 6 && <span className="reset-code-badge">Hazır</span>}
                      </div>
                    )}
                  </Field>

                  {/* New Password Field */}
                  <Field
                    id="new_password"
                    label="Yeni Şifreniz"
                    required
                    error={fieldError.newPassword}
                  >
                    {(ids) => (
                      <div className="reset-input-container">
                        <input
                          {...ids}
                          className="reset-standard-input reset-standard-input--toggle"
                          name="new_password"
                          placeholder="Yeni şifrenizi girin"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <IconButton
                          className="reset-eye-btn"
                          variant="ghost"
                          size="sm"
                          icon={showPassword ? "visibility_off" : "visibility"}
                          label="Şifreyi göster"
                          pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                        />
                      </div>
                    )}
                  </Field>

                  {/* Password Strength Rules Box */}
                  <div className="reset-criteria-box" data-purpose="password-criteria-list">
                    <ul className="reset-criteria-list">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.id}
                          className={`reset-criteria-item ${rule.valid ? "valid" : "invalid"}`}
                        >
                          <svg
                            className="w-4 h-4 rp-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            style={{
                              color: rule.valid ? "var(--color-success-strong)" : "#9ca3af",
                            }}
                          >
                            <path
                              d="M5 13l4 4L19 7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                            />
                          </svg>
                          <span>{rule.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* New Password Confirmation Field */}
                  <Field
                    id="confirm_password"
                    label="Yeni Şifreniz (Tekrar)"
                    required
                    error={fieldError.confirm}
                  >
                    {(ids) => (
                      <input
                        {...ids}
                        className="reset-standard-input input-confirm"
                        name="confirm_password"
                        placeholder="Yeni şifrenizi tekrar girin"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    )}
                  </Field>

                  {/* Submit Action Button */}
                  <button
                    className="reset-submit-button"
                    type="submit"
                    disabled={isLoading || !isPasswordValid || code.length < 6}
                  >
                    <span>
                      {isLoading ? "Şifre Güncelleniyor…" : "Şifremi Sıfırla ve Giriş Yap"}
                    </span>
                    <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>→</span>
                  </button>

                  {/* Secondary Bottom Actions */}
                  <div className="reset-secondary-actions">
                    <button className="reset-resend-link" onClick={handleResendCode} type="button">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                      >
                        <path
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                      <span>Kodu Tekrar Gönder</span>
                    </button>
                    <a className="reset-back-link" href="/login/">
                      Giriş Ekranına Dön
                    </a>
                  </div>
                </form>
              </>
            ) : (
              /* EKRAN: Şifreni mi unuttun? (Stitch ID: 734979b6962d45d68aa5b8bacea90b89) */
              <>
                {/* Header Pill Badge */}
                <div className="reset-pill-badge">
                  <span className="reset-pulse-dot"></span>
                  <span className="reset-pill-text">GÜVENLİ ERİŞİM</span>
                </div>

                {/* Section Title & Subtext */}
                <PageHeader title="Şifreni mi unuttun?" titleText="Şifre sıfırlama" />
                <p className="reset-desc">
                  Endişelenme, kayıtlı e-posta adresini girerek şifreni sıfırlama kodunu hemen
                  alabilirsin.
                </p>

                {/* Status / Error Alerts */}
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

                {/* Send Form */}
                <form className="reset-form" onSubmit={handleSendEmailCode} noValidate>
                  <Field
                    id="resetEmailInput"
                    label="Kayıtlı E-posta Adresi"
                    required
                    error={fieldError.email}
                  >
                    {(ids) => (
                      <div className="reset-input-container">
                        <input
                          {...ids}
                          className="reset-standard-input"
                          name="email"
                          placeholder="ornek@alanadi.com"
                          required
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    )}
                  </Field>

                  {/* 15 Minute Notice Box */}
                  <div
                    className="reset-notice-banner"
                    style={{ margin: 0, padding: "0.75rem 1rem" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{ color: "var(--color-success-strong)", flexShrink: 0 }}
                    >
                      lock_clock
                    </span>
                    <span style={{ fontSize: "13px", color: "#0c6b4b" }}>
                      Doğrulama kodu <strong style={{ color: "#085239" }}>15 dakika</strong> boyunca
                      geçerlidir.
                    </span>
                  </div>

                  {/* Submit Action Button */}
                  <button
                    className="reset-submit-button"
                    type="submit"
                    disabled={isLoading || !email.trim()}
                  >
                    <span>{isLoading ? "Kod Gönderiliyor…" : "Doğrulama Kodunu Gönder"}</span>
                    <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>→</span>
                  </button>

                  {/* SMS / Code Option */}
                  <button
                    className="reset-submit-button"
                    style={{
                      backgroundColor: "var(--color-surface-sunken)",
                      color: "#374151",
                      border: "1px solid var(--color-border)",
                    }}
                    type="button"
                    onClick={() => {
                      setStep("confirm");
                      setMessage("");
                      setStatus("");
                    }}
                  >
                    <span>veya 6 Haneli Doğrulama Kodu ile Sıfırla</span>
                  </button>

                  {/* Secondary Bottom Actions */}
                  <div className="reset-secondary-actions" style={{ marginTop: "0.5rem" }}>
                    <a className="reset-resend-link" href="/login/">
                      Şifreni hatırladın mı? Giriş yap →
                    </a>
                    <a className="reset-back-link" href="/register/">
                      Hesabın yok mu? Üye ol
                    </a>
                  </div>
                </form>
              </>
            )}
          </section>

          {/* RIGHT COLUMN: Visual & Security Showcase */}
          <aside className="reset-aside" data-purpose="security-and-visual-aside">
            {/* Imagery Showcase Card with Frosted Overlay */}
            <div className="reset-showcase-card rp-group">
              {/* Background Image (Kapadokya Balloons) */}
              <img
                alt="Kapadokya gün doğumu ve sıcak hava balonları manzarası"
                className="reset-showcase-bg"
                src="/images/kapadokya-balloons.jpg"
              />
              {/* Ambient Gradient Overlay */}
              <div className="reset-showcase-overlay"></div>

              {/* Top Badge in Image */}
              <div className="reset-showcase-top">
                <div className="reset-active-pill">
                  <span
                    className="reset-pulse-dot"
                    style={{
                      backgroundColor: "var(--color-accent-strong)",
                      boxShadow: "0 0 6px var(--color-accent-strong)",
                    }}
                  ></span>
                  <span>Güvenli Oturum Yenileme • Aktif Koruma</span>
                </div>
                <span className="reset-tag-pill">Kapadokya Rotaları</span>
              </div>

              {/* Bottom Card Overlay Content */}
              <div className="reset-showcase-bottom">
                {/* 256-Bit Uçtan Uca Şifreleme */}
                <div className="glass-effect" data-surface="inverse">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div
                      style={{
                        padding: "0.5rem",
                        borderRadius: "0.75rem",
                        backgroundColor:
                          "color-mix(in srgb, var(--color-brand-hover) 80%, transparent)",
                        color: "#6ee7b7",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                      >
                        <path
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        256-Bit Uçtan Uca Şifreleme
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0",
                          fontSize: "12px",
                          color: "color-mix(in srgb, var(--color-on-primary) 80%, transparent)",
                          lineHeight: "1.4",
                        }}
                      >
                        Şifreniz ve kişisel seyahat rotalarınız en güncel SSL ve kriptografik
                        güvenlik protokolleri altında saklanır.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Session Termination Option */}
                <div className="glass-effect" data-surface="inverse">
                  <label className="reset-session-label">
                    <input
                      checked={signOutOtherSessions}
                      onChange={(e) => setSignOutOtherSessions(e.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <strong>Tüm Açık Oturumlardan Çıkış Yap:</strong> Şifre yenilendikten sonra
                      diğer tüm cihazlardaki açık oturumları güvenliğiniz için derhal sonlandır
                      (Önerilir).
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Quick Traveler Reassurance Card */}
            <div className="reset-guarantee-card">
              <div className="reset-guarantee-icon-wrap">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#111827",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  MapsBridge Güvencesi
                </h4>
                <p style={{ margin: "0.125rem 0 0", fontSize: "12px", color: "#6b7280" }}>
                  Hesabınızı güncelledikten sonra favori lokasyonlarınıza kesintisiz erişim
                  sağlamaya devam edebilirsiniz.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
