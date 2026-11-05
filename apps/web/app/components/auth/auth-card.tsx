"use client";
// Kimlik sayfalarının ortak düzeni (design §4.3 FocusForm, F13/F14): tek 440 px sütun, görsel yan
// panel yok. Chrome "focus" route-registry'den gelir (yalın header, alt menü ve footer yok).
// Sayfa kendi <PageShell layout="form" className="auth-card-shell"> kökünü çizer (G4), AuthCard
// onun içindeki sütundur.
// Yalnız görünüm: Cognito/Google/Apple çağrıları sayfalarda kalır, bu dosya hiçbirini çağırmaz.
import { forwardRef, type ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  GoogleLogo,
  Icon,
  IconButton,
  Input,
  PageHeader,
  VisuallyHidden,
  cx,
  type FieldControlProps,
} from "../ui";
import "./auth-card.css";

export function AuthCard({
  title,
  titleText,
  description,
  children,
  footer,
  className,
}: {
  /** Verilmezse route-registry başlığı (tek h1, PageHeader). */
  title?: ReactNode;
  titleText?: string;
  description?: ReactNode;
  children: ReactNode;
  /** Kart altındaki bağlantılar (ör. "Hesabın yok mu? Kayıt ol"). */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("auth-card", className)}>
      <PageHeader title={title} titleText={titleText} description={description} />
      <Card padding="lg" className="auth-card__panel">
        {children}
      </Card>
      {footer && <div className="auth-card__footer">{footer}</div>}
    </div>
  );
}

function AppleLogo() {
  return (
    <svg
      className="auth-card__apple"
      viewBox="0 0 170 170"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.13-10.74-19.55-14.22-31.26-3.48-11.71-5.22-22.95-5.22-33.72 0-14.13 3.59-26.06 10.76-35.79 7.18-9.73 16.2-14.65 27.08-14.77 5.22 0 10.79 1.39 16.71 4.17 5.92 2.78 9.78 4.22 11.58 4.31 1.41 0 5.48-1.57 12.21-4.71 6.74-3.14 12.63-4.52 17.68-4.14 13.48.87 23.97 5.86 31.47 14.97-12.06 7.28-17.98 17.26-17.76 29.95.22 9.89 3.96 18.06 11.22 24.51 7.26 6.45 15.82 10.12 25.68 11.01-2.17 6.74-4.78 13.32-7.84 19.74zM119.22 31.81c0-7.39 2.66-14.39 7.99-20.99 5.33-6.61 11.85-10.55 19.57-11.82.22 1.3.33 2.39.33 3.26 0 7.39-2.83 14.45-8.49 21.18-5.65 6.74-12.28 10.59-19.89 11.56-.11-1.09-.17-2.17-.17-3.19z" />
    </svg>
  );
}

/** Google + Apple düğmeleri ve "veya e-posta ile" ayracı; işleyiciler sayfadan gelir. */
export function AuthSocialButtons({
  googleLabel,
  appleLabel,
  googleLoading,
  appleLoading,
  onGoogle,
  onApple,
}: {
  googleLabel: string;
  appleLabel: string;
  googleLoading: boolean;
  appleLoading: boolean;
  onGoogle: () => void;
  onApple: () => void;
}) {
  return (
    <>
      <div className="auth-card__social">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          iconStart={<GoogleLogo size={18} />}
          disabled={googleLoading}
          onClick={onGoogle}
        >
          {googleLoading ? "Bağlanıyor…" : googleLabel}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          iconStart={<AppleLogo />}
          disabled={appleLoading}
          onClick={onApple}
        >
          {appleLoading ? "Bağlanıyor…" : appleLabel}
        </Button>
      </div>
      <p className="auth-card__divider">
        <span>veya e-posta ile</span>
      </p>
    </>
  );
}

export type AuthFieldError = { id: string; label: string; text: string };

/** Gönderim hata özeti (design-system §10): role="alert", bağlantı ilgili alana odaklar. */
export function AuthErrorSummary({ errors }: { errors: readonly AuthFieldError[] }) {
  if (errors.length === 0) return null;
  return (
    <Alert tone="danger" live="assertive" title="Lütfen şu alanları düzeltin:">
      <ul className="auth-card__summary">
        {errors.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(e.id)?.focus();
              }}
            >
              {e.label}: {e.text}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

/** Şifre alanı + göster/gizle düğmesi. Field'ın enjekte ettiği id/aria-* `ids` ile gelir. */
export const AuthPasswordInput = forwardRef<
  HTMLInputElement,
  {
    ids: FieldControlProps;
    name: string;
    value: string;
    onChange: (value: string) => void;
    shown: boolean;
    onToggle: () => void;
    autoComplete: "current-password" | "new-password";
    placeholder?: string;
  }
>(function AuthPasswordInput(
  { ids, name, value, onChange, shown, onToggle, autoComplete, placeholder },
  ref,
) {
  return (
    <div className="auth-card__password">
      <Input
        {...ids}
        ref={ref}
        size="lg"
        className="auth-card__password-input"
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <IconButton
        className="auth-card__reveal"
        variant="ghost"
        size="sm"
        icon={shown ? "eye-off" : "eye"}
        label="Şifreyi göster"
        pressed={shown}
        onClick={onToggle}
      />
    </div>
  );
});

/** Şifre kuralları; renk tek ipucu değil (ikon + görünmez durum metni). */
export function AuthPasswordRules({
  rules,
}: {
  rules: readonly { id: string; label: string; valid: boolean }[];
}) {
  return (
    <div className="auth-card__rules">
      <p className="auth-card__rules-title" id="auth-password-rules">
        Şifre kuralları
      </p>
      <ul className="auth-card__rules-list" aria-labelledby="auth-password-rules">
        {rules.map((r) => (
          <li key={r.id} className="auth-card__rule" data-valid={r.valid ? "true" : "false"}>
            <Icon name={r.valid ? "check" : "minus"} size={16} className="auth-card__rule-icon" />
            <span>{r.label}</span>
            <VisuallyHidden>{r.valid ? " (karşılandı)" : " (karşılanmadı)"}</VisuallyHidden>
          </li>
        ))}
      </ul>
    </div>
  );
}
