"use client";
// Kimlik sayfalarının ortak düzeni (Increment 3.2, direction login/register): ışık lekeli kart
// (nabızlı eyebrow, büyük başlık, giriş koreografisi) + fotoğraflı cam panel (AuthVisual). Layout
// registry'den `auth` (R12: 1200 içinde form ≤520 + isteğe bağlı görsel `aside`); chrome "focus"
// (yalın header, alt menü ve footer yok). Sayfa kendi <PageShell className="auth-card-shell">
// kökünü çizer (G4, layout prop'u yok — G30), AuthCard onun içindeki sütundur.
// Yalnız görünüm: Cognito/Google/Apple çağrıları sayfalarda kalır, bu dosya hiçbirini çağırmaz.
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import {
  Alert,
  Button,
  GoogleLogo,
  Icon,
  IconButton,
  Input,
  PageHeader,
  Progress,
  VisuallyHidden,
  cx,
  type FieldControlProps,
  type IconName,
} from "../ui";
import {
  passwordStrength,
  strengthLabel,
  type PasswordCriterion,
} from "../../lib/auth/password-criteria";
import "./auth-card.css";

const order = (i: number) => ({ "data-enter": "", style: { "--i": i } as CSSProperties });

export function AuthCard({
  title,
  titleText,
  eyebrow,
  description,
  note,
  children,
  footer,
  className,
}: {
  /** Verilmezse route-registry başlığı (tek h1, PageHeader). */
  title?: ReactNode;
  titleText?: string;
  /** Başlık üstü nabızlı hap ("Tekrar hoş geldin"). */
  eyebrow?: string;
  description?: ReactNode;
  /** Başlık altında vurgulu not (ör. hoş geldin kredisi). */
  note?: ReactNode;
  children: ReactNode;
  /** Kart altındaki bağlantılar (ör. "Hesabın yok mu? Kayıt ol"). */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("auth-card", className)} aria-labelledby="page-title">
      <PageHeader
        variant="card"
        enter
        eyebrowPulse={Boolean(eyebrow)}
        eyebrow={eyebrow}
        title={title}
        titleText={titleText}
        description={description}
      />
      {note && (
        <div className="auth-card__note-box" {...order(3)}>
          {note}
        </div>
      )}
      <div className="auth-card__panel" {...order(4)}>
        {children}
      </div>
      {footer && (
        <div className="auth-card__footer" {...order(5)}>
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * Fotoğraflı görsel panel (R13 cam panel, data-surface="inverse"). Yalnız gerçek ürün
 * yetenekleri; <1024'te kısa üst bant (yer etiketi + başlık), ≥1024 tam yükseklik + kartlar.
 */
export function AuthVisual({
  src,
  alt,
  place,
  heading,
  features,
}: {
  src: string;
  alt: string;
  place: string;
  heading: string;
  features: readonly { icon: IconName; title: string; body: string }[];
}) {
  return (
    <div className="auth-visual" data-surface="inverse">
      <img className="auth-visual__img" src={src} alt={alt} />
      <div className="auth-visual__inner" data-surface="inverse">
        <span className="auth-visual__place auth-glass" data-surface="inverse" {...order(2)}>
          <Icon name="compass" size={16} />
          {place}
        </span>
        <div className="auth-visual__body">
          <h2 className="auth-visual__heading" {...order(3)}>
            {heading}
          </h2>
          <ul className="auth-visual__feats">
            {features.map((f, i) => (
              <li
                key={f.title}
                className="auth-visual__feat auth-glass"
                data-surface="inverse"
                {...order(4 + i)}
              >
                <span className="auth-visual__icon">
                  <Icon name={f.icon} size={20} />
                </span>
                <strong className="auth-visual__feat-title">{f.title}</strong>
                <span className="auth-visual__feat-body">{f.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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

/**
 * Apple ile giriş web'de henüz entegre değil (sayfa işleyicileri yalnız "yakında" mesajı verir).
 * I10 gereği düğme render edilmez (karar S20); işleyiciler sayfalarda durur, entegrasyon
 * tamamlanınca bu bayrağı `true` yapmak yeterlidir.
 */
export const APPLE_SIGN_IN_WEB_ENABLED = false;

/** Google (+ etkinse Apple) düğmeleri ve "veya e-posta ile" ayracı; işleyiciler sayfadan gelir. */
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
        {APPLE_SIGN_IN_WEB_ENABLED && (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            iconStart={<AppleLogo />}
            disabled={appleLoading}
            onClick={onApple}
          >
            {appleLoading ? "Bağlanıyor…" : appleLabel}
          </Button>
        )}
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
        iconStart="lock"
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

/**
 * Şifre kuralları + güç çubuğu (direction register): karşılanan kriter tek tek "pop"la onaylanır
 * (yalnız no-preference); renk tek ipucu değil (ikon + görünmez durum metni).
 */
export function AuthPasswordRules({ rules }: { rules: readonly PasswordCriterion[] }) {
  const level = passwordStrength(rules);
  return (
    <div className="auth-card__rules" data-level={level}>
      <Progress
        variant="determinate"
        value={level}
        max={4}
        label={strengthLabel(level)}
        className="auth-card__strength"
      />
      <p className="auth-card__rules-title" id="auth-password-rules">
        {strengthLabel(level)}
      </p>
      <ul className="auth-card__rules-list" aria-labelledby="auth-password-rules">
        {rules.map((r) => (
          <li key={r.id} className="auth-card__rule" data-valid={r.valid ? "true" : "false"}>
            <span className="auth-card__tick" key={r.valid ? "on" : "off"}>
              <Icon name="check" size={16} />
            </span>
            <span>{r.label}</span>
            <VisuallyHidden>{r.valid ? " (karşılandı)" : " (karşılanmadı)"}</VisuallyHidden>
          </li>
        ))}
      </ul>
    </div>
  );
}
