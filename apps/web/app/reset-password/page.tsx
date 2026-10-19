"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, confirmForgotPassword, signIn } from "../lib/cognito";
import { HeaderNav } from "../components/header-nav";
import { SiteFooter } from "../components/site-footer";
import "./reset-password.css";

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

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setMessage("Lütfen e-posta adresinizi girin.");
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(cleanEmail);
      setStep("confirm");
      setStatus(
        `6 haneli doğrulama kodu ${cleanEmail} adresine gönderildi. Lütfen gelen kutunuzu kontrol ediniz.`,
      );
    } catch (err: any) {
      setMessage(
        err.message || "Doğrulama kodu gönderilemedi. Lütfen e-posta adresinizi kontrol edin.",
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

    if (!cleanEmail) {
      setMessage("Lütfen geçerli bir e-posta adresi belirtin.");
      setIsLoading(false);
      return;
    }

    if (!cleanCode || cleanCode.length < 6) {
      setMessage("Lütfen e-postanıza gönderilen 6 haneli doğrulama kodunu eksiksiz girin.");
      setIsLoading(false);
      return;
    }

    if (!isPasswordValid) {
      setMessage("Yeni şifreniz tüm güvenlik kurallarını sağlamalıdır.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor.");
      setIsLoading(false);
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
    } catch (err: any) {
      setMessage(err.message || "Şifre güncellenemedi. Lütfen kodu kontrol edip tekrar deneyin.");
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
    } catch (err: any) {
      setMessage(err.message || "Kod tekrar gönderilemedi. Lütfen biraz bekleyin.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="reset-viewport">
      <HeaderNav />

      {/* Main Content */}
      <main className="reset-main">
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
                <h1 className="reset-heading">Yeni Şifreni Belirle</h1>
                <p className="reset-desc">
                  E-postanıza gelen 6 haneli doğrulama kodunu ve yeni şifrenizi girerek hesabınızı
                  güncelleyin.
                </p>

                {/* Notification Banner */}
                <div className="reset-notice-banner" data-purpose="email-sent-notice">
                  <svg
                    className="w-5 h-5 flex-shrink-0 text-mint-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    style={{ color: "var(--mb-mint-600)", marginTop: "2px" }}
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
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: "#eafaf3",
                      border: "1px solid #c4f0dd",
                      color: "#0c6b4b",
                      fontSize: "13px",
                    }}
                  >
                    {status}
                  </div>
                )}
                {message && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontSize: "13px",
                    }}
                  >
                    {message}
                  </div>
                )}

                {/* Confirm Form */}
                <form className="reset-form" onSubmit={handleConfirmReset}>
                  {/* Verification Code Field */}
                  <div>
                    <label className="reset-field-label" htmlFor="verification_code">
                      6 Haneli Doğrulama Kodu
                    </label>
                    <div className="reset-input-container">
                      <input
                        className="reset-code-input"
                        id="verification_code"
                        maxLength={6}
                        name="verification_code"
                        placeholder="Örn: 849201"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      />
                      {code.length === 6 && <span className="reset-code-badge">Hazır</span>}
                    </div>
                  </div>

                  {/* New Password Field */}
                  <div>
                    <label className="reset-field-label" htmlFor="new_password">
                      Yeni Şifreniz
                    </label>
                    <div className="reset-input-container">
                      <input
                        className="reset-standard-input"
                        id="new_password"
                        name="new_password"
                        placeholder="Yeni şifrenizi girin"
                        style={{ paddingRight: "3rem" }}
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        className="reset-eye-btn"
                        id="togglePassword"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                        type="button"
                      >
                        {showPassword ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Rules Box */}
                  <div className="reset-criteria-box" data-purpose="password-criteria-list">
                    <ul className="reset-criteria-list">
                      {passwordRules.map((rule) => (
                        <li
                          key={rule.id}
                          className={`reset-criteria-item ${rule.valid ? "valid" : "invalid"}`}
                        >
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            style={{ color: rule.valid ? "var(--mb-mint-600)" : "#9ca3af" }}
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
                  <div>
                    <label className="reset-field-label" htmlFor="confirm_password">
                      Yeni Şifreniz (Tekrar)
                    </label>
                    <input
                      className="reset-standard-input input-confirm"
                      id="confirm_password"
                      name="confirm_password"
                      placeholder="Yeni şifrenizi tekrar girin"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

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
                <h1 className="reset-heading">Şifreni mi unuttun?</h1>
                <p className="reset-desc">
                  Endişelenme, kayıtlı e-posta adresini girerek şifreni sıfırlama kodunu hemen
                  alabilirsin.
                </p>

                {/* Status / Error Alerts */}
                {status && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: "#eafaf3",
                      border: "1px solid #c4f0dd",
                      color: "#0c6b4b",
                      fontSize: "13px",
                    }}
                  >
                    {status}
                  </div>
                )}
                {message && (
                  <div
                    style={{
                      marginTop: "1rem",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontSize: "13px",
                    }}
                  >
                    {message}
                  </div>
                )}

                {/* Send Form */}
                <form className="reset-form" onSubmit={handleSendEmailCode}>
                  <div>
                    <label className="reset-field-label" htmlFor="resetEmailInput">
                      Kayıtlı E-posta Adresi
                    </label>
                    <div className="reset-input-container">
                      <input
                        className="reset-standard-input"
                        id="resetEmailInput"
                        name="email"
                        placeholder="ornek@alanadi.com"
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 15 Minute Notice Box */}
                  <div
                    className="reset-notice-banner"
                    style={{ margin: 0, padding: "0.75rem 1rem" }}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ color: "var(--mb-mint-600)", flexShrink: 0 }}
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
                      backgroundColor: "#f1f5f9",
                      color: "#374151",
                      border: "1px solid #e2e8f0",
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
            <div className="reset-showcase-card group">
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
                    style={{ backgroundColor: "#34d399", boxShadow: "0 0 6px #34d399" }}
                  ></span>
                  <span>Güvenli Oturum Yenileme • Aktif Koruma</span>
                </div>
                <span className="reset-tag-pill">Kapadokya Rotaları</span>
              </div>

              {/* Bottom Card Overlay Content */}
              <div className="reset-showcase-bottom">
                {/* 256-Bit Uçtan Uca Şifreleme */}
                <div className="glass-effect">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div
                      style={{
                        padding: "0.5rem",
                        borderRadius: "0.75rem",
                        backgroundColor: "rgba(30, 77, 62, 0.8)",
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
                        style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#ffffff" }}
                      >
                        256-Bit Uçtan Uca Şifreleme
                      </h3>
                      <p
                        style={{
                          margin: "0.25rem 0 0",
                          fontSize: "12px",
                          color: "rgba(255, 255, 255, 0.8)",
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
                <div className="glass-effect">
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
      </main>

      {/* Unified Global Site Footer */}
      <SiteFooter />
    </div>
  );
}
