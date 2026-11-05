"use client";

import { userStorage } from "../lib/user-storage";
import { useEffect, useId, useRef, useState, type MouseEvent, type RefObject } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getStoredSession, signOut } from "../lib/cognito";
import { billingService } from "../lib/billing/billing-service";
import { useLocale, localeRootPath } from "../lib/locale-context";
import { isNavActive, type ChromeVariant } from "../lib/route-registry";
import { switchLocale } from "../lib/navigation/switch-locale";
import { Avatar, Badge, Icon, VisuallyHidden, type IconName } from "./ui";

/** Chrome varyantı (G19): sayfa CSS'i header'ı override etmez; varyant route-registry'den gelir. */
export type HeaderVariant = ChromeVariant;

// Tek IA (design §5.3): header, mobil web alt menüsü ve native sekmeler aynı öğeleri aynı sırayla
// gösterir. Etiketler i18n nav.* anahtarlarından (adlandırma sözlüğü §5.1).
// "Planlar" ve "Planlar ve kredi" herkese açık fiyat sayfasına gider (design §5.3, §7).
const PLANS_HREF = "/pricing/";

interface NavItem {
  href: string;
  labelKey: string;
  icon: IconName;
}

const GUEST_HEADER: readonly NavItem[] = [
  { href: "/maps/", labelKey: "nav.desk", icon: "map" },
  { href: "/travel-assistant/", labelKey: "nav.ai", icon: "sparkle" },
  { href: "/community/", labelKey: "nav.community", icon: "users" },
  { href: PLANS_HREF, labelKey: "nav.plans", icon: "coin" },
];
const AUTHED_HEADER: readonly NavItem[] = [
  { href: "/maps/", labelKey: "nav.desk", icon: "map" },
  { href: "/travel-assistant/", labelKey: "nav.ai", icon: "sparkle" },
  { href: "/community/", labelKey: "nav.community", icon: "users" },
  { href: "/messages/", labelKey: "nav.messages", icon: "message" },
];

/** Oturum e-postası (HeaderNav ve MobileNav ortak; pathname değişince yeniden okunur). */
function readSessionEmail(): string | null {
  const session = getStoredSession();
  const fallbackEmail =
    typeof window !== "undefined" ? localStorage.getItem("mapsbridge.userEmail") : null;
  return session?.email || fallbackEmail || null;
}

/** Oturum durumu yalnızca mount sonrası okunur (statik HTML oturumsuz render edilir). */
function useSignedIn(pathname: string): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(readSessionEmail()));
  }, [pathname]);
  return signedIn;
}

/** Okunmamış doğrudan mesaj sayısı (localStorage; storage olayıyla güncellenir). */
function useUnreadMessagesCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const checkUnread = () => {
      try {
        const raw = localStorage.getItem("mapsbridge.directMessages");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setCount(
              parsed.filter(
                (m: { status?: string; read?: boolean }) => m.status === "unread" || !m.read,
              ).length,
            );
          }
        }
      } catch {}
    };
    checkUnread();
    window.addEventListener("storage", checkUnread);
    return () => window.removeEventListener("storage", checkUnread);
  }, []);
  return count;
}

/** Kullanıcı kartı bilgisi (profil ayrıntıları localStorage'da). */
function readProfile(email: string): { name: string; handle: string; avatar: string } {
  const fallbackHandle = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") || "gezgin";
  const out = {
    name: fallbackHandle.charAt(0).toUpperCase() + fallbackHandle.slice(1),
    handle: fallbackHandle,
    avatar: "",
  };
  try {
    const stored = userStorage.getItem("mapsbridge.userProfileDetails");
    if (stored) {
      const d = JSON.parse(stored);
      if (d.fullName) out.name = d.fullName;
      else if (d.firstName) out.name = `${d.firstName} ${d.lastName || ""}`.trim();
      if (d.username) out.handle = d.username;
      if (d.avatarUrl) out.avatar = d.avatarUrl;
    }
  } catch {}
  const savedAvatar = userStorage.getItem("mapsbridge.userAvatar");
  if (savedAvatar) out.avatar = savedAvatar;
  return out;
}

function BrandLink({ href }: { href: string }) {
  return (
    <Link className="global-site-header__brand" href={href} prefetch={false}>
      <span className="global-site-header__brand-mark" aria-hidden="true">
        <Icon name="compass" size={20} />
      </span>
      <span className="global-site-header__brand-name">
        Maps<span className="global-site-header__brand-accent">Bridge</span>
      </span>
    </Link>
  );
}

function LocaleButton({ pathname }: { pathname: string }) {
  const { t, isEnglish } = useLocale();
  return (
    <button
      type="button"
      className="global-site-header__locale"
      onClick={() => switchLocale(pathname, isEnglish)}
    >
      <Icon name="globe" size={16} />
      <span lang={isEnglish ? "tr" : "en"}>{isEnglish ? "TR" : "EN"}</span>
      <VisuallyHidden>
        <span lang={isEnglish ? "tr" : undefined}>{t("nav.switchLanguage")}</span>
      </VisuallyHidden>
    </button>
  );
}

/** Hesap menüsü (disclosure): Esc kapatır ve odağı tetikleyiciye döndürür; dışarı tıklama kapatır. */
function AccountMenu({ email, pathname }: { email: string; pathname: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(() => readProfile(email));
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    setProfile(readProfile(email));
    setOpen(false);
  }, [email, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const items: readonly NavItem[] = [
    { href: "/profile/", labelKey: "nav.profile", icon: "user" },
    { href: "/maps/?view=trips", labelKey: "nav.myTrips", icon: "route" },
    { href: PLANS_HREF, labelKey: "nav.plansAndCredits", icon: "coin" },
    { href: "/support/", labelKey: "nav.help", icon: "help" },
  ];

  return (
    <div className="global-site-header__account" ref={wrapRef}>
      <button
        type="button"
        className="global-site-header__account-trigger"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("ui.userMenu")}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar src={profile.avatar || null} name={profile.name} size="sm" decorative />
        <Icon name="chevron" size={16} />
      </button>
      <div className="global-site-header__menu" id={menuId} hidden={!open}>
        <div className="global-site-header__menu-user">
          <Avatar src={profile.avatar || null} name={profile.name} decorative />
          <div className="global-site-header__menu-id">
            <span className="global-site-header__menu-name">{profile.name}</span>
            <span className="global-site-header__menu-handle">@{profile.handle}</span>
          </div>
        </div>
        <ul className="global-site-header__menu-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                className="global-site-header__menu-item"
                href={item.href}
                prefetch={false}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="global-site-header__menu-item"
              onClick={() => {
                signOut();
                window.location.assign("/login/");
              }}
            >
              <Icon name="logout" />
              <span>{t("nav.logout")}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Sunucu bakiyesi (billingService.refreshWallet); istemci kredi hesaplamaz. */
function CreditPill() {
  const { t } = useLocale();
  const [credits, setCredits] = useState(() => billingService.getWallet().credits);
  useEffect(() => {
    const onWallet = (e: Event) => {
      const detail = (e as CustomEvent<{ credits?: number } | null>).detail;
      if (detail && typeof detail.credits === "number") setCredits(detail.credits);
    };
    window.addEventListener("mapsbridge:wallet_updated", onWallet);
    void billingService
      .refreshWallet()
      .then((w) => setCredits(w.credits))
      .catch(() => setCredits(billingService.getWallet().credits));
    return () => window.removeEventListener("mapsbridge:wallet_updated", onWallet);
  }, []);
  return (
    <Link className="global-site-header__credits" href="/checkout/" prefetch={false}>
      <Icon name="coin" size={16} />
      <span>{credits}</span>
      <span className="global-site-header__credits-unit">{t("nav.credits")}</span>
    </Link>
  );
}

/** Geri: aynı origin'den gelindiyse tarayıcı geçmişi, yoksa dil kökü. */
function BackLink({ fallback }: { fallback: string }) {
  const { t } = useLocale();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        e.preventDefault();
        window.history.back();
      }
    } catch {}
  };
  return (
    <Link className="global-site-header__back" href={fallback} prefetch={false} onClick={onClick}>
      <Icon name="chevron-left" />
      <span>{t("nav.back")}</span>
    </Link>
  );
}

/** Header yükseltisi: 1px gözcü görünümden çıkınca data-elevated (scroll dinleyicisi yok). */
function useElevated(): [RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = useRef<HTMLDivElement>(null);
  const [elevated, setElevated] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setElevated(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [sentinel, elevated];
}

export function HeaderNav({ variant = "default" }: { variant?: HeaderVariant }) {
  const pathname = usePathname() ?? "/";
  const { t, locale } = useLocale();
  const [sentinel, elevated] = useElevated();
  const [email, setEmail] = useState<string | null>(null);
  const unread = useUnreadMessagesCount();
  useEffect(() => {
    setEmail(readSessionEmail());
  }, [pathname]);
  const home = localeRootPath(locale);
  const focus = variant === "focus";
  const items = email ? AUTHED_HEADER : GUEST_HEADER;

  return (
    <>
      <div className="global-site-header-sentinel" ref={sentinel} aria-hidden="true" />
      <header
        className="global-site-header"
        data-variant={variant === "default" ? undefined : variant}
        data-elevated={elevated ? "true" : undefined}
      >
        <div className="global-site-header__inner">
          <BrandLink href={home} />
          {!focus && (
            <nav className="global-site-header__nav" aria-label={t("ui.mainMenu")}>
              {items.map((item) => {
                const active = isNavActive(pathname, item.href.split("?")[0]);
                const showUnread = item.href === "/messages/" && unread > 0;
                return (
                  <Link
                    key={item.href}
                    className="global-site-header__link"
                    href={item.href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon name={item.icon} className="global-site-header__link-icon" />
                    <span>{t(item.labelKey)}</span>
                    {showUnread && (
                      <Badge tone="highlight">
                        {unread > 9 ? "9+" : unread}
                        <VisuallyHidden> {t("nav.unread")}</VisuallyHidden>
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="global-site-header__end">
            <LocaleButton pathname={pathname} />
            {focus ? (
              <BackLink fallback={home} />
            ) : email ? (
              <>
                <CreditPill />
                <AccountMenu email={email} pathname={pathname} />
              </>
            ) : (
              <>
                <Link className="global-site-header__signin" href="/login/" prefetch={false}>
                  <Icon name="user" className="global-site-header__signin-icon" />
                  <span className="global-site-header__signin-label">{t("nav.signIn")}</span>
                </Link>
                <Link className="global-site-header__signup" href="/register/" prefetch={false}>
                  {t("nav.signUpFree")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

/** Klavye açık mı (visualViewport < %75 innerHeight); alt menü alanların üstüne binmez (S5). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setOpen(vv.height < 0.75 * window.innerHeight);
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return open;
}

/** Mobil web alt menüsü (<768, native sekmelerle aynı 5 öğe); focus chrome'da SiteChrome çizmez. */
export function MobileNav() {
  const pathname = usePathname() ?? "/";
  const { t, isEnglish } = useLocale();
  const signedIn = useSignedIn(pathname);
  const unread = useUnreadMessagesCount();
  const keyboardOpen = useKeyboardOpen();
  const items: readonly NavItem[] = signedIn
    ? [
        { href: "/maps/", labelKey: "nav.desk", icon: "map" },
        { href: "/travel-assistant/", labelKey: "nav.ai", icon: "sparkle" },
        { href: "/community/", labelKey: "nav.community", icon: "users" },
        { href: "/messages/", labelKey: "nav.messages", icon: "message" },
        { href: "/profile/", labelKey: "nav.profile", icon: "user" },
      ]
    : [
        { href: isEnglish ? "/en/" : "/", labelKey: "nav.explore", icon: "compass" },
        { href: "/maps/", labelKey: "nav.desk", icon: "map" },
        { href: "/travel-assistant/", labelKey: "nav.ai", icon: "sparkle" },
        { href: "/community/", labelKey: "nav.community", icon: "users" },
        { href: "/login/", labelKey: "nav.signInShort", icon: "user" },
      ];

  return (
    <nav
      className="mobile-primary-nav"
      aria-label={t("ui.mobileMenu")}
      data-keyboard={keyboardOpen ? "open" : undefined}
    >
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const showUnread = item.href === "/messages/" && unread > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="mobile-primary-nav__item"
            aria-current={active ? "page" : undefined}
          >
            <span className="mobile-primary-nav__icon">
              <Icon name={item.icon} size={24} />
              {showUnread && (
                <span className="mobile-primary-nav__badge" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span className="mobile-primary-nav__label">{t(item.labelKey)}</span>
            {showUnread && (
              <VisuallyHidden>
                {unread} {t("nav.unread")}
              </VisuallyHidden>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
