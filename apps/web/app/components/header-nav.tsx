"use client";

import { userStorage } from "../lib/user-storage";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredSession, signOut } from "../lib/cognito";
import { billingService } from "../lib/billing/billing-service";
import { useLocale, getAlternatePath, localeRootPath } from "../lib/locale-context";
import { SAVED_ADDRESSES_EVENT, type SavedAddressesChangedDetail } from "../lib/chrome-events";
import type { ChromeVariant } from "../lib/route-registry";

/** Chrome varyantı (G19): sayfa CSS'i header'ı override etmez; varyant route-registry'den gelir. */
export type HeaderVariant = ChromeVariant;

interface HeaderNavProps {
  variant?: HeaderVariant;
}

/** Oturum e-postası (HeaderNav ve MobileNav ortak; pathname değişince yeniden okunur). */
function readSessionEmail(): string | null {
  const session = getStoredSession();
  const fallbackEmail =
    typeof window !== "undefined" ? localStorage.getItem("mapsbridge.userEmail") : null;
  return session?.email || fallbackEmail || null;
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

export function HeaderNav({ variant = "default" }: HeaderNavProps) {
  const [storageError, setStorageError] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t, isEnglish } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Traveler");
  const [userHandle, setUserHandle] = useState<string>("traveler");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [localSavedCount, setLocalSavedCount] = useState(0);
  const unreadMessagesCount = useUnreadMessagesCount();
  const [wallet, setWallet] = useState(() => billingService.getWallet());
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Disclosure menü: Esc kapatır ve odağı tetikleyiciye döndürür; dışarı tıklama kapatır.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isOpen]);

  // Harita masası kayıtlı adres listesini değiştirince sayıyı yayar (eski savedCount prop'u).
  useEffect(() => {
    const onSaved = (e: Event) => {
      const count = (e as CustomEvent<Partial<SavedAddressesChangedDetail>>).detail?.count;
      if (typeof count === "number") setLocalSavedCount(count);
    };
    window.addEventListener(SAVED_ADDRESSES_EVENT, onSaved);
    return () => window.removeEventListener(SAVED_ADDRESSES_EVENT, onSaved);
  }, []);

  useEffect(() => {
    const handleWalletUpdated = (e: Event) => {
      const detail = (e as CustomEvent<typeof wallet | null>).detail;
      if (detail) setWallet(detail);
    };
    window.addEventListener("mapsbridge:wallet_updated", handleWalletUpdated);
    void billingService.refreshWallet().catch(() => setWallet(billingService.getWallet()));
    return () => window.removeEventListener("mapsbridge:wallet_updated", handleWalletUpdated);
  }, []);

  useEffect(() => {
    const activeEmail = readSessionEmail();

    if (activeEmail) {
      setUserEmail(activeEmail);
      try {
        const stored = userStorage.getItem("mapsbridge.userProfileDetails");
        if (stored) {
          const d = JSON.parse(stored);
          if (d.fullName) setUserName(d.fullName);
          else if (d.firstName) setUserName(`${d.firstName} ${d.lastName || ""}`.trim());
          if (d.username) setUserHandle(d.username);
          if (d.avatarUrl) setUserAvatar(d.avatarUrl);
        } else {
          const fallbackHandle = activeEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
          if (fallbackHandle) {
            setUserHandle(fallbackHandle);
            setUserName(fallbackHandle.charAt(0).toUpperCase() + fallbackHandle.slice(1));
          }
        }
      } catch {}
      const savedAvatar = userStorage.getItem("mapsbridge.userAvatar");
      if (savedAvatar) setUserAvatar(savedAvatar);
    } else {
      setUserEmail(null);
    }
    try {
      const stored = userStorage.getItem("mapsbridge.savedAddresses");
      if (stored) {
        const addresses = JSON.parse(stored);
        if (Array.isArray(addresses)) setLocalSavedCount(addresses.length);
      }
    } catch {}
    setMounted(true);
  }, [pathname]);

  function handleOpenSavedAddresses() {
    setIsOpen(false);
    router.push("/maps/?modal=saved");
  }

  function handleLogout() {
    signOut();
    setUserEmail(null);
    window.location.assign("/login/");
  }

  return (
    <>
      <header
        className="global-site-header"
        data-variant={variant === "default" ? undefined : variant}
      >
        {storageError && (
          <p role="alert" className="global-storage-error">
            Could not save your change. Check your browser storage and try again.{" "}
            <button type="button" onClick={() => setStorageError(false)}>
              Close
            </button>
          </p>
        )}
        <div className="global-site-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
            <Link className="header-brand-link" href={mounted && userEmail ? "/maps/" : "/"} prefetch={false}>
              <div className="header-brand-icon">
                <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                  explore
                </span>
              </div>
              <span className="header-brand-title">
                Maps<span className="header-brand-emerald">Bridge</span>
              </span>
            </Link>

            <nav className="header-nav-center" aria-label={t("ui.mainMenu")}>
              {!(mounted && userEmail) && (
                <Link
                  className={`header-nav-pill ${
                    pathname === "/" ||
                    pathname === "/en" ||
                    pathname === "/en/" ||
                    (pathname.startsWith("/?") && !pathname.startsWith("/desk"))
                      ? "active"
                      : ""
                  }`}
                  href="/"
                  prefetch={false}
                >
                  {t("nav.explore")}
                </Link>
              )}
              <Link
                className={`header-nav-pill ${pathname.startsWith("/maps") || pathname.startsWith("/haritalar") || pathname.startsWith("/harita") || pathname.startsWith("/desk") ? "active" : ""}`}
                href="/maps/"
                prefetch={false}
              >
                {t("nav.desk")}
              </Link>
              <Link
                className={`header-nav-pill ${pathname.startsWith("/travel-assistant") || pathname.startsWith("/gezi-asistani") || pathname.startsWith("/ai-asistan") || (pathname.startsWith("/ai") && !pathname.startsWith("/ai-asistan")) ? "active" : ""}`}
                href="/travel-assistant/"
                prefetch={false}
              >
                {t("nav.ai")}
              </Link>
              <Link
                className={`header-nav-pill ${pathname.startsWith("/community") ? "active" : ""}`}
                href="/community/"
                prefetch={false}
              >
                {t("nav.community")}
              </Link>
              {mounted && userEmail && (
                <Link
                  className={`header-nav-pill ${pathname.startsWith("/messages") ? "active" : ""}`}
                  href="/messages/"
                  prefetch={false}
                  style={{ position: "relative" }}
                >
                  {t("nav.messages")}
                  {unreadMessagesCount > 0 && (
                    <span
                      style={{
                        marginLeft: "0.35rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "9999px",
                        background: "#10b981",
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      {unreadMessagesCount}
                    </span>
                  )}
                </Link>
              )}
            </nav>
          </div>

          <div className="header-right-group">
            {mounted && userEmail ? (
              /* ── LOGGED IN USER (Stitch Screen ID: 1098cc1c43404574a97e25ddc1a201fa) ── */
              <div className="header-profile-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="header-user-pill-trigger"
                  onClick={() => setIsOpen(!isOpen)}
                  ref={triggerRef}
                  aria-expanded={isOpen}
                  aria-controls={menuId}
                >
                  <div className="header-user-avatar-wrap">
                    <div className="header-user-avatar-circle">
                      {userAvatar ? (
                        <img src={userAvatar} alt={userName} />
                      ) : (
                        <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                          person
                        </span>
                      )}
                    </div>
                    <span className="header-user-online-dot"></span>
                  </div>
                  <div className="header-user-pill-info">
                    <span className="header-user-pill-name">
                      {userName.length > 12 ? userName.slice(0, 11) + "…" : userName}
                    </span>
                    <span className="header-user-pill-role">PRO KAŞİF</span>
                  </div>
                  {/* Dar ekranda .header-user-pill-info gizlenir; erişilebilir ad her genişlikte kalsın. */}
                  <span className="ui-visually-hidden">{t("ui.userMenu")}</span>
                  <span
                    aria-hidden="true"
                    translate="no"
                    className={`material-symbols-outlined header-user-pill-arrow ${isOpen ? "open" : ""}`}
                  >
                    expand_more
                  </span>
                </button>

                {isOpen && (
                  <div className="header-stitch-dropdown" id={menuId}>
                    {/* 1. Üst Kullanıcı Kartı */}
                    <div className="header-stitch-user-card">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.65rem",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div className="header-stitch-avatar-large">
                          {userAvatar ? (
                            <img src={userAvatar} alt={userName} />
                          ) : (
                            <span
                              aria-hidden="true"
                              translate="no"
                              className="material-symbols-outlined"
                              style={{ fontSize: "24px" }}
                            >
                              person
                            </span>
                          )}
                          <span className="header-stitch-online-dot-large"></span>
                        </div>
                        <div className="header-stitch-name-wrap">
                          <div className="header-stitch-name-row">
                            <span className="header-stitch-fullname">{userName}</span>
                            <span className="header-stitch-pro-badge">PRO KAŞİF</span>
                          </div>
                          <span className="header-stitch-handle">@{userHandle}</span>
                        </div>
                      </div>
                      <a
                        href="/profile/edit/"
                        className="header-stitch-edit-btn"
                        title="Profili Düzenle"
                        aria-label="Profili Düzenle"
                        onClick={() => setIsOpen(false)}
                      >
                        <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          edit
                        </span>
                      </a>
                    </div>

                    {/* 2. Mini Grid (Kredi / Kazanç) */}
                    <div className="header-stitch-grid">
                      <div className="header-stitch-stat-box">
                        <div className="header-stitch-stat-top">
                          <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span
                              aria-hidden="true"
                              translate="no"
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px", color: "#10b981" }}
                            >
                              bolt
                            </span>
                            KREDİ
                          </span>
                          <a
                            href="/checkout/?tab=credits"
                            onClick={() => setIsOpen(false)}
                            style={{ color: "#10b981", textDecoration: "none", fontWeight: 700 }}
                          >
                            + Yükle
                          </a>
                        </div>
                        <div className="header-stitch-stat-val">
                          {wallet.credits}{" "}
                          <span style={{ fontSize: "11px", fontWeight: 400, color: "#717974" }}>
                            Adet
                          </span>
                        </div>
                      </div>

                      {/* Stat 2: PLAN & ABONELİK */}
                      <div className="header-stitch-stat-box">
                        <div className="header-stitch-stat-top">
                          <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span
                              aria-hidden="true"
                              translate="no"
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px", color: "#10b981" }}
                            >
                              verified
                            </span>
                            PLAN
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(
                                  new CustomEvent("mapsbridge:open_upgrade_modal", {
                                    detail: { tab: "subscriptions" },
                                  }),
                                );
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              color: "#10b981",
                              textDecoration: "none",
                              fontWeight: 700,
                              fontSize: "12px",
                            }}
                          >
                            Yükselt
                          </button>
                        </div>
                        <div className="header-stitch-stat-val" style={{ fontSize: "12.5px" }}>
                          {wallet.subscriptionTier === "agency"
                            ? "Tur Lideri"
                            : wallet.subscriptionTier === "pro"
                              ? "Pro Kaşif"
                              : wallet.subscriptionTier === "explorer"
                                ? "Kaşif"
                                : "Gezgin (Free)"}
                        </div>
                      </div>
                    </div>

                    {/* 3. Kaydırılabilir Gezgin Menüsü */}
                    <div className="header-stitch-scroll-area">
                      <div className="header-stitch-section-label">Gezgin Paneli</div>

                      <a
                        href="/checkout/?tab=plans"
                        className="header-stitch-item"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsOpen(false);
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("mapsbridge:open_upgrade_modal", {
                                detail: { tab: "subscriptions" },
                              }),
                            );
                          }
                        }}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ color: "#10b981" }}>
                            workspace_premium
                          </span>
                          <span>Üyelik &amp; Kredi Masası</span>
                        </div>
                        <span className="header-stitch-badge-pill header-stitch-badge-green">
                          {wallet.subscriptionTier === "agency"
                            ? "Tur Lideri"
                            : wallet.subscriptionTier === "pro"
                              ? "Pro Kaşif"
                              : wallet.subscriptionTier === "explorer"
                                ? "Kaşif"
                                : "Planlar"}
                        </span>
                      </a>

                      <a
                        href="/profile/"
                        className="header-stitch-item"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined">account_circle</span>
                          <span>Ana Profilim &amp; Gezgin Paneli</span>
                        </div>
                        <span
                          aria-hidden="true"
                          translate="no"
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", color: "#717974" }}
                        >
                          chevron_right
                        </span>
                      </a>

                      <a
                        href="/profile/?tab=routes"
                        className="header-stitch-item"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined">map</span>
                          <span>Rotalarım &amp; Gezilerim</span>
                        </div>
                        <span className="header-stitch-badge-pill">
                          {localSavedCount > 0
                            ? `${Math.max(1, Math.ceil(localSavedCount / 4))} Rota`
                            : "Rotalar"}
                        </span>
                      </a>

                      <button
                        type="button"
                        className="header-stitch-item"
                        onClick={handleOpenSavedAddresses}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined">bookmark_added</span>
                          <span>Kayıtlı Noktalarım &amp; Havuz</span>
                        </div>
                        <span className="header-stitch-badge-pill">{localSavedCount} Nokta</span>
                      </button>

                      <a
                        href="/messages/"
                        className="header-stitch-item"
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ color: "#10b981" }}>
                            forum
                          </span>
                          <span>Gezgin Sohbetleri &amp; Gruplar</span>
                        </div>
                        {unreadMessagesCount > 0 ? (
                          <span className="header-stitch-badge-pill header-stitch-badge-green">
                            {unreadMessagesCount} Yeni
                          </span>
                        ) : (
                          <span
                            className="header-stitch-badge-pill"
                            style={{ color: "#10b981", background: "rgba(16,185,129,0.15)" }}
                          >
                            Canlı
                          </span>
                        )}
                      </a>

                      <a
                        href={`/${userHandle}/`}
                        className="header-stitch-item"
                        style={{ color: "#286954", background: "rgba(236, 253, 245, 0.6)" }}
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="header-stitch-item-left">
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined">public</span>
                          <span style={{ fontSize: "12px" }}>mapsbridge.com/@{userHandle}</span>
                        </div>
                        <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                          open_in_new
                        </span>
                      </a>
                    </div>

                    {/* 6. Alt Aksiyonlar & Çıkış */}
                    <div className="header-stitch-footer">
                      <a
                        href="/support/"
                        className="header-stitch-item"
                        style={{ padding: "0.4rem 0.5rem", color: "#717974" }}
                        onClick={() => setIsOpen(false)}
                      >
                        <div className="header-stitch-item-left">
                          <span
                            aria-hidden="true"
                            translate="no"
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px", color: "#717974" }}
                          >
                            help
                          </span>
                          <span style={{ fontSize: "12.5px" }}>Yardım &amp; Destek Merkezi</span>
                        </div>
                      </a>

                      <button
                        type="button"
                        className="header-stitch-logout-btn"
                        onClick={handleLogout}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                            logout
                          </span>
                          <span>Çıkış Yap</span>
                        </div>
                        <span style={{ fontSize: "10px", color: "#717974", fontWeight: 500 }}>
                          v2.4
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="header-auth-buttons">
                <Link href="/login/" className="header-btn-login" prefetch={false}>
                  {t("nav.signIn")}
                </Link>
                <Link href="/register/" className="header-btn-signup" prefetch={false}>
                  {t("nav.signUp")}
                </Link>
              </div>
            )}
            <button
              type="button"
              className="header-locale-btn"
              onClick={() => {
                // D13: gerçek dil varyantı varsa ona, yoksa dil köküne (404 üreten /en/<path>/ yok).
                const target = isEnglish ? "tr" : "en";
                const alternate = getAlternatePath(pathname);
                const here = pathname.endsWith("/") ? pathname : `${pathname}/`;
                document.cookie = `locale=${target};path=/;max-age=31536000;SameSite=Lax`;
                window.location.assign(alternate !== here ? alternate : localeRootPath(target));
              }}
              title={isEnglish ? "Türkçe ana sayfaya geç" : "İngilizce ana sayfaya geç"}
            >
              <span aria-hidden="true" translate="no" className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>
                translate
              </span>
              <span>{isEnglish ? "TR" : "EN"}</span>
              <span className="ui-visually-hidden">
                {isEnglish ? "Türkçe ana sayfaya geç" : "İngilizce ana sayfaya geç"}
              </span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

const mobileIcons = {
  explore: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M16 8l-2.5 5.5L8 16l2.5-5.5L16 8Z",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6m6-3v15m6-12v15",
  ai: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z M20 2v4m-2-2h4",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-8a4 4 0 0 1 0 8",
  message: "M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h8m-8 4h5",
  profile: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
} as const;

/** Mobil alt navigasyon; SiteChrome'da footer'dan sonra tek kez render edilir. */
export function MobileNav() {
  const pathname = usePathname();
  const { t, isEnglish } = useLocale();
  const unreadCount = useUnreadMessagesCount();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(readSessionEmail()));
  }, [pathname]);
  const path = pathname.replace(/\/$/, "") || "/";
  const items = signedIn
    ? ([
        { href: "/maps/", label: "Harita", english: "Map", icon: "map" },
        { href: "/community/", label: "Topluluk", english: "Community", icon: "people" },
        { href: "/travel-assistant/", label: "AI Asistan", english: "AI Guide", icon: "ai" },
        { href: "/messages/", label: "Mesajlar", english: "Messages", icon: "message" },
        { href: "/profile/", label: "Profil", english: "Profile", icon: "profile" },
      ] as const)
    : ([
        { href: isEnglish ? "/en/" : "/", label: "Keşfet", english: "Explore", icon: "explore" },
        { href: "/maps/", label: "Harita", english: "Map", icon: "map" },
        { href: "/travel-assistant/", label: "AI Asistan", english: "AI Guide", icon: "ai" },
        { href: "/community/", label: "Topluluk", english: "Community", icon: "people" },
        { href: "/login/", label: "Giriş", english: "Sign in", icon: "profile" },
      ] as const);

  return (
    <nav
      className="mobile-primary-nav"
      aria-label={t("ui.mobileMenu")}
    >
      <div className="mobile-nav-track">
        {items.map((item) => {
          const target = item.href.replace(/\/$/, "") || "/";
          const active = path === target || (target !== "/" && path.startsWith(`${target}/`));
          const hasUnread = item.icon === "message" && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`mobile-nav-item${item.icon === "ai" ? " mobile-nav-assistant" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-nav-icon-wrap">
                <svg
                  className="mobile-nav-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={mobileIcons[item.icon]} />
                </svg>
                {hasUnread && (
                  <span className="mobile-nav-badge" aria-hidden="true">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="mobile-nav-label">{isEnglish ? item.english : item.label}</span>
              {hasUnread && <span className="sr-only">{unreadCount} okunmamış mesaj</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
