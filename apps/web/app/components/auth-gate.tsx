"use client";

import { useState } from "react";
import { WELCOME_CREDITS_DISPLAY } from "../lib/billing/credit-costs";
import { useLocale } from "../lib/locale-context";
import { DEFAULT_NEXT, safeNext } from "../lib/navigation/safe-next";
import { Button, CreditCostTable, Icon, Modal, PageHeader, PageShell } from "./ui";
import "./auth-gate.css";

export type AuthGateReason = "save" | "ai" | "messages" | "profile";
export type AuthGateProps = {
  variant: "page" | "sheet";
  reason: AuthGateReason;
  /** Misafir yanıtları cihazda saklandı (design §6.5 notu). */
  draft?: boolean;
  /** Dönüş yolu; safe-next ile doğrulanır (R8), geçersizse /maps/. */
  next?: string;
  /** sheet: açık mı. */
  open?: boolean;
  /** sheet: "Şimdilik devam et", Escape ve kapat düğmesi. */
  onClose?: () => void;
};

// safe-next yalnızca göreli yolları kabul eder; origin karşılaştırması için sabit kök yeterli
// (aynı-origin göreli yol her origin'de aynı sonucu verir, SSR'da window gerekmez).
const GATE_ORIGIN = "https://mapsbridge.com";

const TITLE: Record<AuthGateReason, [key: string, fallback: string]> = {
  ai: ["gate.title.ai", "Rotanı oluşturmak için ücretsiz hesap aç"],
  save: ["gate.title.save", "Kaydetmek ve paylaşmak için ücretsiz hesap aç"],
  messages: ["gate.title.messages", "Mesajlaşmak için ücretsiz hesap aç"],
  profile: ["gate.title.profile", "Profilini yönetmek için ücretsiz hesap aç"],
};
const BODY: Record<AuthGateReason, [key: string, fallback: string]> = {
  ai: ["gate.body.ai", "Asistan rotanı hesabınla oluşturur ve kaydeder."],
  save: ["gate.body.save", "Rotaların hesabında saklanır; süreli bağlantıyla paylaşabilirsin."],
  messages: ["gate.body.messages", "Gezginlerle gerçek zamanlı mesajlaşmak için hesabınla gir."],
  profile: ["gate.body.profile", "Profilini, rotalarını ve tercihlerini hesabından yönetirsin."],
};

/** /register/ ve /login/ bağlantıları: tek dönüş parametresi `next` (design §5.4, R8). */
export function gateLinks(next: string | undefined) {
  const target = safeNext(next ?? DEFAULT_NEXT, GATE_ORIGIN);
  const q = `?next=${encodeURIComponent(target)}`;
  return { register: `/register/${q}`, login: `/login/${q}`, next: target };
}

function GateContent({
  reason,
  draft,
  next,
  onContinue,
}: {
  reason: AuthGateReason;
  draft?: boolean;
  next?: string;
  onContinue?: () => void;
}) {
  const { t } = useLocale();
  const links = gateLinks(next);
  return (
    <div className="auth-gate__content">
      <p className="auth-gate__body">{t(...BODY[reason])}</p>
      {draft && (
        <p className="auth-gate__draft">
          {t(
            "gate.draftNote",
            "Yanıtların bu cihazda saklandı. Hesap açınca kaldığın yerden devam edersin.",
          )}
        </p>
      )}
      <ul className="auth-gate__perks">
        <li className="auth-gate__perk">
          <Icon name="check" size={20} className="auth-gate__check" />
          <span>
            {t("gate.welcome", "{n} hoş geldin kredisi").replace(
              "{n}",
              String(WELCOME_CREDITS_DISPLAY),
            )}
          </span>
        </li>
        {reason === "ai" && (
          <li className="auth-gate__perk">
            <Icon name="check" size={20} className="auth-gate__check" />
            <span>
              {t("gate.serverCredits", "Kredi yalnızca sunucuda, işlem başlarken ayrılır")}
            </span>
          </li>
        )}
      </ul>
      {reason === "ai" && (
        <div className="auth-gate__costs">
          <CreditCostTable
            caption={t("gate.costs.caption", "Bu adımın kredi maliyeti")}
            actions={["ai_deep_trip"]}
          />
        </div>
      )}
      <div className="auth-gate__actions">
        <Button href={links.register} variant="primary" size="lg" fullWidth>
          {t("gate.register", "Ücretsiz hesap aç")}
        </Button>
        <Button href={links.login} variant="secondary" size="lg" fullWidth>
          {t("gate.login", "Giriş yap")}
        </Button>
        {onContinue ? (
          <Button variant="ghost" fullWidth onClick={onContinue}>
            {t("gate.continue", "Şimdilik devam et")}
          </Button>
        ) : (
          <Button href="/maps/" variant="ghost" fullWidth>
            {t("gate.continue", "Şimdilik devam et")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Tek kimlik kapısı (design §4.2, §6.5, F18; design-system.md §6 R7).
 * - page: sayfanın yerine kendi PageShell + PageHeader'ını (tek h1) çizer (G4 kapı sözleşmesi).
 * - sheet: Modal primitive'i (role=dialog, odak tuzağı, Escape = "Şimdilik devam et").
 * Kredi bilgisi yalnızca gösterimdir (credit-costs.ts); istemci kredi hesaplamaz ya da düşmez.
 * ⚠ UI hoş geldin 5 / ai_chat 1 gösterir; sunucu değeri yayından önce kullanıcı tarafından
 * teyit edilmeli.
 */
export function AuthGate({ variant, reason, draft, next, open = false, onClose }: AuthGateProps) {
  const { t } = useLocale();
  const eyebrow = t("gate.eyebrow", "Bir adım kaldı");
  const title = t(...TITLE[reason]);
  if (variant === "page") {
    return (
      <PageShell layout="form" className="auth-gate-page">
        <PageHeader eyebrow={eyebrow} title={title} titleText={title} />
        <div className="auth-gate auth-gate--page" data-surface="default">
          <GateContent reason={reason} draft={draft} next={next} />
        </div>
      </PageShell>
    );
  }
  const close = onClose ?? (() => {});
  return (
    <Modal
      open={open}
      onClose={close}
      size="sheet"
      className="auth-gate auth-gate--sheet"
      title={
        <>
          <span className="auth-gate__eyebrow">{eyebrow}</span>
          <span className="auth-gate__title">{title}</span>
        </>
      }
    >
      <GateContent reason={reason} draft={draft} next={next} onContinue={close} />
    </Modal>
  );
}

// ── Geriye uyumlu sarmalayıcılar (FEAT-009'da silinir) ─────────────────────────────────────
// Eski çağıranlar derlenmeye devam etsin diye imzalar korunur; görünüm tamamen AuthGate'tir.

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** @deprecated AuthGate variant="page" kullanın. Görsel alanlar (features, samples…) yok sayılır. */
export interface FullPagePromotionProps {
  nextUrl: string;
  badgeText?: string;
  badgeIcon?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  features?: unknown[];
  samplesTitle?: string;
  samples?: unknown[];
  primaryButtonText?: string;
  secondaryButtonText?: string;
  titleText?: string;
}

/** @deprecated AuthGate variant="page" kullanın. */
export function FullPagePromotion({ nextUrl }: FullPagePromotionProps) {
  const reason: AuthGateReason = nextUrl.startsWith("/messages")
    ? "messages"
    : nextUrl.startsWith("/profile")
      ? "profile"
      : "save";
  return <AuthGate variant="page" reason={reason} next={nextUrl} />;
}

/** @deprecated AuthGate variant="sheet" kullanın. title/subtitle/featureName yok sayılır. */
export interface AuthActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  featureName?: string;
  nextUrl?: string;
}

/** @deprecated AuthGate variant="sheet" kullanın. */
export function AuthActionModal({ isOpen, onClose, nextUrl }: AuthActionModalProps) {
  const reason: AuthGateReason = decodeSafe(nextUrl ?? "").includes("/travel-assistant")
    ? "ai"
    : "save";
  return (
    <AuthGate variant="sheet" reason={reason} next={nextUrl} open={isOpen} onClose={onClose} />
  );
}

/** @deprecated Planlayıcı misafir rozeti FEAT-007'de yeniden yazılır. */
export interface PanelGuestBannerProps {
  onRegisterClick?: () => void;
  nextUrl?: string;
}

/** @deprecated Kısa misafir notu + AuthGate sheet (reason="save"). */
export function PanelGuestBanner({ nextUrl = "/maps/" }: PanelGuestBannerProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <div className="auth-gate-banner" data-surface="default">
      <p className="auth-gate-banner__text">
        {t("gate.banner", "Cihazında taslak · Kaydetmek için hesap aç")}
      </p>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        {t("gate.register", "Ücretsiz hesap aç")}
      </Button>
      <AuthGate
        variant="sheet"
        reason="save"
        next={nextUrl}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
