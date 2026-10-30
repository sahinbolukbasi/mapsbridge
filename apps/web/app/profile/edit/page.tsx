"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { FullPagePromotion } from "../../components/auth-gate";
import { getStoredSession, changePasswordDirect } from "../../lib/cognito";
import { userStorage } from "../../lib/user-storage";
import { billingService } from "../../lib/billing/billing-service";
import { WalletData, BillingDetails, BillingTransaction } from "../../lib/billing/billing-types";
import "./edit.css";
import { AIMemorySettings } from "../../components/ai-memory-settings";
import { webSocialSync } from "../../lib/social-sync";

import type { ProfileSidebarTab, SidebarTab } from "../../features/profile/types";
import {
  DEFAULT_COVER_IMAGE,
  DEFAULT_AVATAR_IMAGE,
  AVAILABLE_INTERESTS,
} from "../../features/profile/constants";
import "./edit-layout.css";
import { PageHeader, PageShell } from "../../components/ui";

export default function EditProfilePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileSidebarTab>("genel");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavedAnimation, setIsSavedAnimation] = useState(false);

  // User session

  // Media
  const [coverPhoto, setCoverPhoto] = useState<string>(DEFAULT_COVER_IMAGE);
  const [userAvatar, setUserAvatar] = useState<string>(DEFAULT_AVATAR_IMAGE);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Basic Details
  const [fullName, setFullName] = useState<string>("Gezgin");
  const [username, setUsername] = useState<string>("gezgin");
  const [travelTitle, setTravelTitle] = useState<string>("Kaşif & Gezgin");
  const [bio, setBio] = useState<string>("");
  const [location, setLocation] = useState<string>("Türkiye");
  const [languages, setLanguages] = useState<string[]>(["Türkçe (Anadil)"]);
  const [newLanguageInput, setNewLanguageInput] = useState<string>("");
  const [showAddLanguage, setShowAddLanguage] = useState<boolean>(false);

  // Interests & Badges
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    "Tarih & Arkeoloji",
    "Doğa Yürüyüşü",
    "Gastronomi",
  ]);
  const [showProBadge, setShowProBadge] = useState<boolean>(false);

  // Social & Privacy
  const [instagram, setInstagram] = useState<string>("");
  const [youtubeOrBlog, setYoutubeOrBlog] = useState<string>("");
  const [emailPrivacy, setEmailPrivacy] = useState<"public" | "friends">("friends");

  // Şifre Değiştirme State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Bildirim Tercihleri
  const [notifTravelReminders, setNotifTravelReminders] = useState(true);
  const [notifEmailSummaries, setNotifEmailSummaries] = useState(false);
  const [notifCommunityTips, setNotifCommunityTips] = useState(true);

  // Webcam Modal
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Danger Zone Modal
  const [showDangerModal, setShowDangerModal] = useState(false);

  // Billing, Monetization & Transactions State
  const [wallet, setWallet] = useState<WalletData>(() => billingService.getWallet());
  const [billingDetails, setBillingDetails] = useState<BillingDetails>(() =>
    billingService.getBillingDetails(),
  );
  const [transactions, setTransactions] = useState<BillingTransaction[]>(() =>
    billingService.getTransactions(),
  );
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutIban, setPayoutIban] = useState<string>(wallet.payoutIban || "");
  const [payoutHolder, setPayoutHolder] = useState<string>(wallet.payoutAccountHolder || "");
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<BillingTransaction | null>(null);

  useEffect(() => {
    const handleWallet = () => setWallet(billingService.getWallet());
    const handleTx = () => setTransactions(billingService.getTransactions());
    const handleDetails = () => setBillingDetails(billingService.getBillingDetails());
    window.addEventListener("mapsbridge:wallet_updated", handleWallet);
    window.addEventListener("mapsbridge:transactions_updated", handleTx);
    window.addEventListener("mapsbridge:billing_details_updated", handleDetails);
    return () => {
      window.removeEventListener("mapsbridge:wallet_updated", handleWallet);
      window.removeEventListener("mapsbridge:transactions_updated", handleTx);
      window.removeEventListener("mapsbridge:billing_details_updated", handleDetails);
    };
  }, []);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      // Check query param for demo / guest view
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("demo") !== "1" && urlParams.get("auth") !== "1") {
        setIsAuthenticated(false);
        return;
      }
    }
    setIsAuthenticated(true);

    // Load stored media
    const storedCover = userStorage.getItem("mapsbridge.userCoverPhoto");
    if (storedCover) setCoverPhoto(storedCover);

    const storedAvatar = userStorage.getItem("mapsbridge.userAvatar");
    if (storedAvatar) setUserAvatar(storedAvatar);

    // Load stored profile details
    try {
      const stored = userStorage.getItem("mapsbridge.userProfileDetails");
      if (stored) {
        const d = JSON.parse(stored);
        if (d.fullName) setFullName(d.fullName);
        else if (d.firstName) setFullName(`${d.firstName} ${d.lastName || ""}`.trim());
        if (d.username) setUsername(d.username);
        if (d.travelTitle) setTravelTitle(d.travelTitle);
        if (d.bio) setBio(d.bio);
        if (d.location) setLocation(d.location);
        else if (d.currentCountry) setLocation(d.currentCountry);
        if (Array.isArray(d.languages) && d.languages.length > 0) setLanguages(d.languages);
        if (Array.isArray(d.interests) && d.interests.length > 0) setSelectedInterests(d.interests);
        if (typeof d.showProBadge === "boolean") setShowProBadge(d.showProBadge);
        if (d.instagram) setInstagram(d.instagram);
        if (d.youtubeOrBlog) setYoutubeOrBlog(d.youtubeOrBlog);
        if (d.emailPrivacy) setEmailPrivacy(d.emailPrivacy);
      }
    } catch {
      // ignore
    }

    // Load preferences
    try {
      const prefs = userStorage.getItem("mapsbridge.userPreferences");
      if (prefs) {
        const p = JSON.parse(prefs);
        if (typeof p.notifTravelReminders === "boolean")
          setNotifTravelReminders(p.notifTravelReminders);
        if (typeof p.notifEmailSummaries === "boolean")
          setNotifEmailSummaries(p.notifEmailSummaries);
        if (typeof p.notifCommunityTips === "boolean") setNotifCommunityTips(p.notifCommunityTips);
      }
    } catch {
      // ignore
    }

    // URL tab check
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") as SidebarTab;
    if (
      tabParam &&
      ["genel", "guvenlik", "bildirimler", "entegrasyonlar", "odeme", "tehlike"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, []);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }

  // Cover photo upload
  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("⚠️ Kapak fotoğrafı boyutu 5 MB'dan küçük olmalıdır.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        setCoverPhoto(res);
        userStorage.setItem("mapsbridge.userCoverPhoto", res);
        showToast("✓ Profil kapak fotoğrafınız başarıyla güncellendi!");
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveCover() {
    setCoverPhoto(DEFAULT_COVER_IMAGE);
    userStorage.removeItem("mapsbridge.userCoverPhoto");
    showToast("Kapak fotoğrafı varsayılana sıfırlandı.");
  }

  // Avatar upload
  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("⚠️ Profil görseli boyutu 5 MB'dan küçük olmalıdır.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = ev.target?.result as string;
      if (res) {
        setUserAvatar(res);
        userStorage.setItem("mapsbridge.userAvatar", res);
        showToast("✓ Profil fotoğrafınız başarıyla güncellendi!");
      }
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAvatar() {
    setUserAvatar(DEFAULT_AVATAR_IMAGE);
    userStorage.removeItem("mapsbridge.userAvatar");
    showToast("Profil fotoğrafı varsayılana sıfırlandı.");
  }

  // Webcam handlers
  async function openWebcam() {
    setIsWebcamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      showToast("⚠️ Kameraya erişilemedi veya izin verilmedi.");
      setIsWebcamOpen(false);
    }
  }

  function closeWebcam() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsWebcamOpen(false);
  }

  function captureWebcamPhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const v = videoRef.current;
      const minDim = Math.min(v.videoWidth || 640, v.videoHeight || 480);
      const startX = ((v.videoWidth || 640) - minDim) / 2;
      const startY = ((v.videoHeight || 480) - minDim) / 2;
      ctx.drawImage(v, startX, startY, minDim, minDim, 0, 0, 480, 480);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setUserAvatar(dataUrl);
      userStorage.setItem("mapsbridge.userAvatar", dataUrl);
      showToast("✓ Webcam fotoğrafınız profil resmi yapıldı!");
      closeWebcam();
    }
  }

  // Interests toggle
  function toggleInterest(label: string) {
    if (selectedInterests.includes(label)) {
      setSelectedInterests(selectedInterests.filter((item) => item !== label));
    } else {
      setSelectedInterests([...selectedInterests, label]);
    }
  }

  // Language management
  function removeLanguage(lang: string) {
    setLanguages(languages.filter((l) => l !== lang));
  }

  function addLanguage() {
    if (!newLanguageInput.trim()) return;
    if (!languages.includes(newLanguageInput.trim())) {
      setLanguages([...languages, newLanguageInput.trim()]);
      showToast(`✓ "${newLanguageInput.trim()}" eklendi.`);
    }
    setNewLanguageInput("");
    setShowAddLanguage(false);
  }

  // Calculate Profile Completion %
  const completionPercentage = (() => {
    let score = 0;
    if (userAvatar && userAvatar !== DEFAULT_AVATAR_IMAGE) score += 15;
    else score += 10;
    if (coverPhoto) score += 15;
    if (fullName.trim()) score += 15;
    if (username.trim()) score += 10;
    if (travelTitle.trim()) score += 10;
    if (bio.trim().length > 30) score += 15;
    if (location.trim()) score += 10;
    if (instagram.trim() || youtubeOrBlog.trim()) score += 10;
    return Math.min(score, 100);
  })();

  // Save All Changes
  function handleSaveAll(e?: FormEvent) {
    if (e) e.preventDefault();

    const cleanUser = (username || "gezgin")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    setUsername(cleanUser);

    const details = {
      fullName: fullName.trim(),
      username: cleanUser,
      travelTitle: travelTitle.trim(),
      bio: bio.trim(),
      location: location.trim(),
      languages,
      interests: selectedInterests,
      showProBadge,
      instagram: instagram.trim(),
      youtubeOrBlog: youtubeOrBlog.trim(),
      emailPrivacy,
    };

    userStorage.setItem("mapsbridge.userProfileDetails", JSON.stringify(details));

    // Synchronize across platforms and cascade author updates to community posts
    webSocialSync.updateProfile({
      fullName: fullName.trim(),
      username: cleanUser,
      travelTitle: travelTitle.trim(),
      bio: bio.trim(),
      location: location.trim(),
      avatarUrl: userAvatar,
      coverPhotoUrl: coverPhoto,
    });

    const prefs = {
      notifTravelReminders,
      notifEmailSummaries,
      notifCommunityTips,
    };
    userStorage.setItem("mapsbridge.userPreferences", JSON.stringify(prefs));

    setIsSavedAnimation(true);
    showToast("✓ Değişiklikleriniz başarıyla kaydedildi!");
    setTimeout(() => setIsSavedAnimation(false), 2400);
  }

  // Password Rules Check
  const passwordRules = [
    [newPassword.length >= 12, "En az 12 karakter içermeli"],
    [/[A-Z]/.test(newPassword), "En az bir büyük harf (A-Z) içermeli"],
    [/[a-z]/.test(newPassword), "En az bir küçük harf (a-z) içermeli"],
    [/[0-9]/.test(newPassword), "En az bir rakam (0-9) içermeli"],
    [/[^A-Za-z0-9]/.test(newPassword), "En az bir özel karakter (@, #, $, !, %, * vb.) içermeli"],
  ] as const;
  const isPasswordValid = passwordRules.every(([valid]) => valid);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordStatus("");

    if (!newPassword || !isPasswordValid) {
      setPasswordError("Lütfen tüm şifre güvenlik gereksinimlerini karşılayın.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Girdiğiniz yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePasswordDirect(newPassword);
      setPasswordStatus("✓ Şifreniz başarıyla güncellendi!");
      setNewPassword("");
      setConfirmPassword("");
      showToast("✓ Şifreniz başarıyla değiştirildi!");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Şifre güncellenemedi.");
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  if (isAuthenticated === false) {
    return (
      <FullPagePromotion
        badgeIcon="⚙️"
        badgeText="Hesap ve Gezgin Kimliği Yönetimi"
        heroTitle="Gezgin Profilinizi ve Ayarlarınızı Düzenleyin"
        heroSubtitle="Kişisel seyahat profilinizi güncellemek, rozetlerinizi belirlemek ve seyahat topluluğunda öne çıkmak için lütfen hesabınıza giriş yapın veya ücretsiz üye olun."
        nextUrl="/profile/edit/"
        primaryButtonText="Ücretsiz Kayıt Ol"
        secondaryButtonText="Giriş Yap"
        features={[
          {
            icon: "👤",
            title: "Gezgin Kimliği",
            description:
              "Ad, soyad, biyografi ve özel kullanıcı adınızı dilediğiniz gibi belirleyin.",
          },
          {
            icon: "🎨",
            title: "Görsel ve Kapak Yönetimi",
            description:
              "Manzara kapak fotoğrafınız ve seyyah profil avatarınızla profilinizi kişiselleştirin.",
          },
          {
            icon: "🔑",
            title: "Güvenli Hesap & Şifre",
            description: "Hesap şifrenizi ve oturum tercihlerinizi uçtan uca güvenle güncelleyin.",
          },
          {
            icon: "🛡️",
            title: "Gizlilik & Sosyal Bağlantılar",
            description:
              "Hangi sosyal bağlantılarınızın ve e-posta bilgilerinizin paylaşılacağını kontrol edin.",
          },
        ]}
      />
    );
  }

  return (
    <PageShell layout="landing" className="stitch-profile-root">
      {/* Tek h1 (AC-34): görsel başlık sayfa içinde <p> olarak kalır; kabuk başlığı ekran okuyucuya. */}
      <PageHeader variant="hidden" title="Profilini ve Tercihlerini Düzenle" />

      {/* Hidden File Inputs for Media Upload */}
      <input
        type="file"
        ref={coverInputRef}
        onChange={handleCoverFile}
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFile}
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Sticky üst eylem çubuğu (site header'ı SiteChrome'da; ikinci banner landmark'ı olmasın) */}
      <div className="stitch-profile-sticky-bar">
        <div className="stitch-sticky-bar-inner">
          <div className="pe-1">
            <nav aria-label="Breadcrumb" className="stitch-breadcrumb-row">
              <Link href="/profile/" className="stitch-breadcrumb-link">
                Hesabım
              </Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <Link href="/profile/edit/" className="stitch-breadcrumb-link">
                Profil Ayarları
              </Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <span className="stitch-breadcrumb-current">Profili Düzenle</span>
            </nav>
            <div className="stitch-sticky-title-row">
              <p className="stitch-sticky-title">Profilini ve Tercihlerini Düzenle</p>
              <span className="stitch-draft-badge">TASLAK AKTİF</span>
            </div>
            <p className="stitch-sticky-subtitle">
              MapsBridge topluluğunda ve harita masanda nasıl görüneceğini kişiselleştir.
            </p>
          </div>

          <div className="stitch-sticky-actions">
            <Link href="/profile/" className="stitch-btn-cancel">
              İptal / Vazgeç
            </Link>
            <button
              type="button"
              className={`stitch-btn-save ${isSavedAnimation ? "saved" : ""}`}
              onClick={() => handleSaveAll()}
            >
              <span className="material-symbols-outlined">
                {isSavedAnimation ? "done_all" : "check"}
              </span>
              <span>{isSavedAnimation ? "Kaydedildi!" : "Değişiklikleri Kaydet"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="stitch-profile-workspace">
        <div className="stitch-workspace-grid">
          {/* Left Sub-Navigation Sidebar (4 cols) */}
          <aside className="stitch-profile-sidebar">
            {/* Explorer Status Card */}
            <div className="stitch-explorer-card">
              <div className="stitch-explorer-avatar-wrap">
                <div className="stitch-explorer-avatar-inner">
                  {userAvatar ? (
                    <img src={userAvatar} alt={fullName} className="stitch-explorer-avatar-img" />
                  ) : (
                    fullName.charAt(0)
                  )}
                </div>
                <span className="stitch-online-ring-dot" title="Çevrimiçi" />
              </div>
              <div className="stitch-explorer-info">
                <div className="stitch-explorer-name-row">
                  <span className="stitch-explorer-name">{fullName || "Gezgin"}</span>
                  <span
                    className="material-symbols-outlined stitch-verified-badge"
                    title="Doğrulanmış Rota Küratörü"
                  >
                    verified
                  </span>
                </div>
                <span className="stitch-explorer-handle">@{username || "gezgin"}</span>
                <span className="stitch-explorer-tagline">
                  {wallet.subscriptionTier === "free" ? "GEZGİN" : "PRO KAŞİF"}
                </span>
              </div>
            </div>

            {/* Sidebar Navigation Menu */}
            <nav className="stitch-sidebar-nav" aria-label="Profil Menüsü">
              <button
                type="button"
                className={`stitch-nav-item ${activeTab === "genel" ? "active" : ""}`}
                onClick={() => setActiveTab("genel")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">person</span>
                  <span>Genel Profil Bilgileri</span>
                </div>
                <span className="material-symbols-outlined">
                  {activeTab === "genel" ? "arrow_right" : "chevron_right"}
                </span>
              </button>

              <button
                type="button"
                className={`stitch-nav-item ${activeTab === "guvenlik" ? "active" : ""}`}
                onClick={() => setActiveTab("guvenlik")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">lock</span>
                  <span>Hesap Güvenliği & Şifre</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>

              <button
                type="button"
                className={`stitch-nav-item ${activeTab === "bildirimler" ? "active" : ""}`}
                onClick={() => setActiveTab("bildirimler")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">
                    notifications_active
                  </span>
                  <span>Bildirim & E-posta Tercihleri</span>
                </div>
                <span className="stitch-nav-badge">2 YENİ</span>
              </button>

              <button
                type="button"
                className={`stitch-nav-item ${activeTab === "entegrasyonlar" ? "active" : ""}`}
                onClick={() => setActiveTab("entegrasyonlar")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">hub</span>
                  <span>Sosyal Hesaplar & Entegrasyonlar</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>

              <button
                type="button"
                className={`stitch-nav-item ${activeTab === "odeme" ? "active" : ""}`}
                onClick={() => setActiveTab("odeme")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">payments</span>
                  <span>Ödeme & Rota Satış Ayarları</span>
                </div>
                <span className="material-symbols-outlined text-outline">chevron_right</span>
              </button>

              <div className="stitch-nav-divider" />

              <button
                type="button"
                className={`stitch-nav-item danger ${activeTab === "tehlike" ? "active" : ""}`}
                onClick={() => setActiveTab("tehlike")}
              >
                <div className="stitch-nav-item-left">
                  <span className="material-symbols-outlined stitch-nav-item-icon">warning</span>
                  <span>Hesabı Dondur / Sil</span>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </nav>

            {/* Profile Completion Indicator Widget */}
            <div className="stitch-completion-card">
              <div className="stitch-completion-top">
                <span className="stitch-completion-title">Profil Doluluk Oranı</span>
                <span className="stitch-completion-pct">%{completionPercentage}</span>
              </div>
              <div className="stitch-progress-track">
                <div
                  className="stitch-progress-bar"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="stitch-completion-tip">
                {completionPercentage >= 90
                  ? "Tebrikler! Profiliniz neredeyse kusursuz. Toplulukta en yüksek görünürlüktesiniz."
                  : "Topluluk görünürlüğünü en üst düzeye çıkarmak için YouTube veya Blog URL bağlantını tamamla."}
              </p>
            </div>
          </aside>

          {/* Right Main Form Area (8 cols) */}
          <section className="stitch-profile-form-pane">
            {activeTab === "genel" && (
              <>
                {/* Section 1: Visual & Media Management */}
                <div className="stitch-form-section">
                  <div className="stitch-section-header">
                    <div className="stitch-section-title-wrap">
                      <span className="stitch-section-dot" />
                      <h2 className="stitch-section-title">Görsel & Medya Yönetimi</h2>
                    </div>
                    <span className="stitch-section-badge">1920×480 ÖNERİLEN</span>
                  </div>

                  {/* Cover Photo Studio */}
                  <div className="stitch-cover-block">
                    <label className="stitch-field-label">Profil Kapak Fotoğrafı</label>
                    <div className="stitch-cover-container">
                      <img
                        src={coverPhoto}
                        alt="Profil Kapak Fotoğrafı"
                        className="stitch-cover-img"
                      />
                      <div className="stitch-cover-overlay">
                        <button
                          type="button"
                          className="stitch-cover-action-btn primary"
                          onClick={() => coverInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined">wallpaper</span>
                          <span>Kapağı Değiştir</span>
                        </button>
                        <button
                          type="button"
                          className="stitch-cover-action-btn danger"
                          onClick={handleRemoveCover}
                        >
                          <span className="material-symbols-outlined">delete</span>
                          <span>Kaldır</span>
                        </button>
                      </div>
                    </div>
                    <p className="stitch-helper-text">
                      <span className="material-symbols-outlined">info</span>
                      En iyi sonuç için yatay, yüksek çözünürlüklü manzara fotoğrafları (PNG veya
                      JPG, maks. 5MB) tercih edin.
                    </p>
                  </div>

                  {/* Profile Avatar Studio */}
                  <div className="stitch-avatar-studio">
                    <div className="stitch-avatar-preview-wrap">
                      <div className="stitch-avatar-circle">
                        <img src={userAvatar} alt={fullName} />
                      </div>
                      <div className="stitch-avatar-badge-icon" title="Profil Fotoğrafı">
                        <span className="material-symbols-outlined">photo_camera</span>
                      </div>
                    </div>

                    <div className="stitch-avatar-controls">
                      <span className="stitch-avatar-title">Profil Fotoğrafı</span>
                      <p className="stitch-helper-text">
                        Topluluk yorumlarında, paylaşılan rotalarda ve seyahat haritalarında
                        görünür.
                      </p>
                      <div className="stitch-avatar-buttons-row">
                        <button
                          type="button"
                          className="stitch-avatar-btn primary"
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <span className="material-symbols-outlined">upload</span>
                          <span>Yeni Fotoğraf Yükle</span>
                        </button>
                        <button
                          type="button"
                          className="stitch-avatar-btn secondary"
                          onClick={openWebcam}
                        >
                          <span className="material-symbols-outlined">videocam</span>
                          <span>Webcam ile Çek</span>
                        </button>
                        <button
                          type="button"
                          className="stitch-avatar-btn text-danger"
                          onClick={handleRemoveAvatar}
                        >
                          Kaldır
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Basic Information Form */}
                <div className="stitch-form-section">
                  <div className="stitch-section-header">
                    <div className="stitch-section-title-wrap">
                      <span className="stitch-section-dot" />
                      <h2 className="stitch-section-title">Temel Bilgiler</h2>
                    </div>
                  </div>

                  <div className="stitch-inputs-grid">
                    {/* Full Name */}
                    <div className="stitch-input-group">
                      <label className="stitch-field-label" htmlFor="fullname">
                        Ad Soyad
                      </label>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon">badge</span>
                        <input
                          id="fullname"
                          type="text"
                          className="stitch-text-input"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Ad Soyad"
                        />
                      </div>
                    </div>

                    {/* Username & Availability */}
                    <div className="stitch-input-group">
                      <div className="pe-2">
                        <label className="stitch-field-label" htmlFor="username">
                          Kullanıcı Adı
                        </label>
                        <span className="stitch-username-status">
                          <span className="material-symbols-outlined">check_circle</span>
                          MÜSAİT
                        </span>
                      </div>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon accent">
                          alternate_email
                        </span>
                        <input
                          id="username"
                          type="text"
                          className="stitch-text-input mint-highlight"
                          value={username}
                          onChange={(e) =>
                            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                          }
                          placeholder="kullanici_adi"
                        />
                      </div>
                      <p className="stitch-input-preview-note">
                        Önizleme:{" "}
                        <span className="pe-3 text-secondary">
                          mapsbridge.com/@{username || "gezgin"}
                        </span>
                      </p>
                    </div>

                    {/* Title / Tagline */}
                    <div className="stitch-input-group full-width">
                      <label className="stitch-field-label" htmlFor="title">
                        Başlık / Seyahat Ünvanı
                      </label>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon">explore</span>
                        <input
                          id="title"
                          type="text"
                          className="stitch-text-input"
                          value={travelTitle}
                          onChange={(e) => setTravelTitle(e.target.value)}
                          placeholder="Örn: Sırt Çantalı Gezgin & Rota Küratörü"
                        />
                      </div>
                    </div>

                    {/* Bio Textarea with Live Counter */}
                    <div className="stitch-input-group full-width">
                      <div className="pe-2">
                        <label className="stitch-field-label" htmlFor="bio">
                          Biyografi & Seyahat Felsefesi
                        </label>
                        <span className="stitch-char-counter">{bio.length} / 300</span>
                      </div>
                      <textarea
                        id="bio"
                        rows={4}
                        maxLength={300}
                        className="stitch-textarea"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Seyahat tarzınızı, sevdiğiniz rotaları ve kaşif felsefenizi kısaca anlatın..."
                      />
                    </div>

                    {/* Location */}
                    <div className="stitch-input-group">
                      <label className="stitch-field-label" htmlFor="location">
                        Mevcut Konum
                      </label>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon">
                          location_on
                        </span>
                        <input
                          id="location"
                          type="text"
                          className="stitch-text-input"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Örn: İstanbul, Türkiye"
                        />
                      </div>
                    </div>

                    {/* Spoken Languages */}
                    <div className="stitch-input-group">
                      <label className="stitch-field-label">Konuştuğun Diller</label>
                      <div className="stitch-tags-container">
                        {languages.map((lang) => (
                          <span key={lang} className="stitch-language-chip">
                            <span>{lang}</span>
                            <span
                              className="material-symbols-outlined stitch-chip-remove"
                              onClick={() => removeLanguage(lang)}
                              title="Kaldır"
                            >
                              close
                            </span>
                          </span>
                        ))}
                        {showAddLanguage ? (
                          <div className="pe-4">
                            <input
                              type="text"
                              value={newLanguageInput}
                              onChange={(e) => setNewLanguageInput(e.target.value)}
                              placeholder="Dil ekle..."
                              className="pe-5 border-subtle bg-surface"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addLanguage();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={addLanguage}
                              className="pe-6 text-secondary"
                            >
                              ✓
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="stitch-chip-add-btn"
                            onClick={() => setShowAddLanguage(true)}
                          >
                            <span className="material-symbols-outlined">add</span>
                            <span>Ekle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Explorer Interests & Badges */}
                <div className="stitch-form-section">
                  <div className="stitch-section-header">
                    <div className="stitch-section-title-wrap">
                      <span className="stitch-section-dot" />
                      <h2 className="stitch-section-title">
                        Gezgin İlgi Alanları & Rozet Tercihleri
                      </h2>
                    </div>
                    <span className="stitch-section-badge highlight">
                      {selectedInterests.length} SEÇİLDİ
                    </span>
                  </div>

                  <div className="pe-7">
                    <label className="stitch-field-label">
                      İlgi Alanı Kategorileri (Topluluk aramalarında eşleşmek için seçin)
                    </label>
                    <div className="stitch-interests-wrap">
                      {AVAILABLE_INTERESTS.map((item) => {
                        const isSelected = selectedInterests.includes(item.label);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`stitch-interest-pill ${isSelected ? "active" : "inactive"}`}
                            onClick={() => toggleInterest(item.label)}
                          >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PRO Badge Visibility Toggle */}
                  <div className="stitch-toggle-card">
                    <div className="stitch-toggle-card-left">
                      <div className="stitch-badge-icon-box">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          military_tech
                        </span>
                      </div>
                      <div className="pe-8">
                        <span className="stitch-toggle-title">
                          PRO Kaşif Rozetini Profilde Göster
                        </span>
                        <p className="stitch-toggle-desc">
                          Doğrulanmış küratör simgesi harita rotalarınızda ve topluluk
                          yayınlarınızda görünür.
                        </p>
                      </div>
                    </div>

                    <label className="stitch-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="PRO Kaşif Rozetini Profilde Göster"
                        checked={showProBadge}
                        onChange={(e) => setShowProBadge(e.target.checked)}
                      />
                      <span className="stitch-slider" />
                    </label>
                  </div>
                </div>

                {/* Section 4: Contact & Social Links */}
                <div className="stitch-form-section">
                  <div className="stitch-section-header">
                    <div className="stitch-section-title-wrap">
                      <span className="stitch-section-dot" />
                      <h2 className="stitch-section-title">İletişim & Sosyal Bağlantılar</h2>
                    </div>
                  </div>

                  <div className="stitch-inputs-grid">
                    {/* Instagram */}
                    <div className="stitch-input-group">
                      <label className="stitch-field-label" htmlFor="instagram">
                        Instagram Kullanıcı Adı
                      </label>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon">
                          photo_camera_front
                        </span>
                        <input
                          id="instagram"
                          type="text"
                          className="stitch-text-input"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          placeholder="@kullanici_adi"
                        />
                      </div>
                    </div>

                    {/* YouTube / Web */}
                    <div className="stitch-input-group">
                      <label className="stitch-field-label" htmlFor="youtube">
                        YouTube / Kişisel Blog URL
                      </label>
                      <div className="stitch-input-wrapper">
                        <span className="material-symbols-outlined stitch-input-icon">
                          language
                        </span>
                        <input
                          id="youtube"
                          type="url"
                          className="stitch-text-input"
                          value={youtubeOrBlog}
                          onChange={(e) => setYoutubeOrBlog(e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Privacy Selection */}
                  <div className="pe-9">
                    <label className="stitch-field-label">E-posta Adresi Görünürlük Tercihi</label>
                    <div className="stitch-radio-grid">
                      <label
                        className={`stitch-radio-card ${emailPrivacy === "public" ? "active" : ""}`}
                        onClick={() => setEmailPrivacy("public")}
                      >
                        <input
                          type="radio"
                          name="email-privacy"
                          checked={emailPrivacy === "public"}
                          onChange={() => setEmailPrivacy("public")}
                        />
                        <div className="pe-8">
                          <span className="stitch-radio-title">Herkese Açık</span>
                          <span className="stitch-radio-desc">
                            Tüm MapsBridge gezginleri e-posta adresinizi görebilir.
                          </span>
                        </div>
                      </label>

                      <label
                        className={`stitch-radio-card ${emailPrivacy === "friends" ? "active" : ""}`}
                        onClick={() => setEmailPrivacy("friends")}
                      >
                        <input
                          type="radio"
                          name="email-privacy"
                          checked={emailPrivacy === "friends"}
                          onChange={() => setEmailPrivacy("friends")}
                        />
                        <div className="pe-8">
                          <span className="stitch-radio-title">
                            Yalnızca Seyahat Arkadaşlarıma Açık
                          </span>
                          <span className="stitch-radio-desc">
                            Sadece karşılıklı takipleştiğiniz kaşifler iletişim kurabilir.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 5: Bottom Navigation Action Strip */}
                <div className="stitch-bottom-strip">
                  <Link
                    href={`/profil/?u=${username || "gezgin"}`}
                    className="stitch-public-preview-link"
                    target="_blank"
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    <span>Kamu Ön İzlemesini Gör (mapsbridge.com/@{username || "gezgin"})</span>
                  </Link>

                  <div className="stitch-sticky-actions">
                    <Link href="/profile/" className="stitch-btn-cancel">
                      Vazgeç
                    </Link>
                    <button
                      type="button"
                      className={`stitch-btn-save ${isSavedAnimation ? "saved" : ""}`}
                      onClick={() => handleSaveAll()}
                    >
                      <span className="material-symbols-outlined">
                        {isSavedAnimation ? "done_all" : "save"}
                      </span>
                      <span>{isSavedAnimation ? "Kaydedildi!" : "Değişiklikleri Kaydet"}</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Tab 2: Security & Password */}
            {activeTab === "guvenlik" && (
              <div className="stitch-form-section">
                <div className="stitch-section-header">
                  <div className="stitch-section-title-wrap">
                    <span className="stitch-section-dot" />
                    <h2 className="stitch-section-title">Hesap Güvenliği & Şifre Değiştir</h2>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="pe-8 gap-4 max-w-xl">
                  {passwordError && (
                    <div className="pe-10 bg-error-container text-error">
                      <span className="material-symbols-outlined">error</span>
                      <span>{passwordError}</span>
                    </div>
                  )}
                  {passwordStatus && (
                    <div className="pe-11 bg-mint-subtle text-secondary">
                      <span className="material-symbols-outlined">check_circle</span>
                      <span>{passwordStatus}</span>
                    </div>
                  )}

                  <div className="stitch-input-group">
                    <label className="stitch-field-label" htmlFor="new-pass">
                      Yeni Şifre
                    </label>
                    <div className="stitch-input-wrapper">
                      <span className="material-symbols-outlined stitch-input-icon">lock</span>
                      <input
                        id="new-pass"
                        type={showPassword ? "text" : "password"}
                        className="stitch-text-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        className="pe-12 right-3 text-muted"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <span className="material-symbols-outlined">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="stitch-input-group">
                    <label className="stitch-field-label" htmlFor="confirm-pass">
                      Yeni Şifre (Tekrar)
                    </label>
                    <div className="stitch-input-wrapper">
                      <span className="material-symbols-outlined stitch-input-icon">
                        lock_reset
                      </span>
                      <input
                        id="confirm-pass"
                        type={showPassword ? "text" : "password"}
                        className="stitch-text-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>

                  {/* Password Rules List */}
                  <div className="p-3.5 pe-13 bg-canvas-base border-subtle">
                    <span className="pe-6 text-main">Şifre Güvenlik Kriterleri:</span>
                    {passwordRules.map(([isValid, desc], idx) => (
                      <div key={idx} className="pe-14">
                        <span
                          className={`material-symbols-outlined ${
                            isValid ? "text-emerald-accent" : "text-outline"
                          }`}
                        >
                          {isValid ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span className={isValid ? "text-main pe-15" : "text-muted"}>{desc}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword || !isPasswordValid}
                    className="stitch-btn-save mt-2 pe-16"
                  >
                    {isUpdatingPassword ? "Güncelleniyor..." : "Şifremi Güncelle"}
                  </button>
                </form>
              </div>
            )}

            {/* Tab 3: Notifications */}
            {activeTab === "bildirimler" && (
              <div className="stitch-form-section">
                <div className="stitch-section-header">
                  <div className="stitch-section-title-wrap">
                    <span className="stitch-section-dot" />
                    <h2 className="stitch-section-title">Bildirim & E-posta Tercihleri</h2>
                  </div>
                </div>

                <div className="pe-8 gap-4">
                  <div className="stitch-toggle-card">
                    <div className="stitch-toggle-card-left">
                      <div className="stitch-badge-icon-box">
                        <span className="material-symbols-outlined">calendar_month</span>
                      </div>
                      <div className="pe-8">
                        <span className="stitch-toggle-title">
                          Seyahat ve Durak Hatırlatıcıları
                        </span>
                        <p className="stitch-toggle-desc">
                          Yaklaşan gezi günleri ve planlanan durak saatleri öncesinde bildirim alın.
                        </p>
                      </div>
                    </div>
                    <label className="stitch-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Seyahat ve Durak Hatırlatıcıları"
                        checked={notifTravelReminders}
                        onChange={(e) => setNotifTravelReminders(e.target.checked)}
                      />
                      <span className="stitch-slider" />
                    </label>
                  </div>

                  <div className="stitch-toggle-card">
                    <div className="stitch-toggle-card-left">
                      <div className="stitch-badge-icon-box">
                        <span className="material-symbols-outlined">mail</span>
                      </div>
                      <div className="pe-8">
                        <span className="stitch-toggle-title">Haftalık Rota ve İlham Bülteni</span>
                        <p className="stitch-toggle-desc">
                          Haftanın en popüler rotaları ve gezgin topluluğunun yeni keşifleri
                          e-postanıza gelsin.
                        </p>
                      </div>
                    </div>
                    <label className="stitch-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Haftalık Rota ve İlham Bülteni"
                        checked={notifEmailSummaries}
                        onChange={(e) => setNotifEmailSummaries(e.target.checked)}
                      />
                      <span className="stitch-slider" />
                    </label>
                  </div>

                  <div className="stitch-toggle-card">
                    <div className="stitch-toggle-card-left">
                      <div className="stitch-badge-icon-box">
                        <span className="material-symbols-outlined">tips_and_updates</span>
                      </div>
                      <div className="pe-8">
                        <span className="stitch-toggle-title">
                          Topluluk Yorumları & Bahsetmeler
                        </span>
                        <p className="stitch-toggle-desc">
                          Rotalarınıza yapılan yorumlar ve topluluk etkileşimleri anlık bildirilsin.
                        </p>
                      </div>
                    </div>
                    <label className="stitch-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Topluluk Yorumları & Bahsetmeler"
                        checked={notifCommunityTips}
                        onChange={(e) => setNotifCommunityTips(e.target.checked)}
                      />
                      <span className="stitch-slider" />
                    </label>
                  </div>

                  <div className="stitch-sticky-actions pe-17">
                    <button
                      type="button"
                      className="stitch-btn-save"
                      onClick={() => handleSaveAll()}
                    >
                      <span>Tercihleri Kaydet</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Integrations */}
            {activeTab === "entegrasyonlar" && (
              <div className="stitch-form-section">
                <div className="stitch-section-header">
                  <div className="stitch-section-title-wrap">
                    <span className="stitch-section-dot" />
                    <h2 className="stitch-section-title">Sosyal Hesaplar & Entegrasyonlar</h2>
                  </div>
                </div>

                <div className="pe-18">
                  <div className="p-4 pe-19 bg-canvas-base border-subtle">
                    <div className="pe-20">
                      <div className="w-10 h-10 pe-21 shadow-sm bg-surface-card">
                        <span className="text-xl">🌐</span>
                      </div>
                      <div>
                        <span className="pe-22 text-main block">Google Hesabı</span>
                        <span className="pe-23 text-muted">
                          Hızlı oturum açma ve Maps senkronizasyonu aktif
                        </span>
                      </div>
                    </div>
                    <span className="stitch-draft-badge">BAĞLI</span>
                  </div>

                  <div className="p-4 pe-19 bg-canvas-base border-subtle">
                    <div className="pe-20">
                      <div className="w-10 h-10 pe-21 shadow-sm bg-surface-card">
                        <span className="text-xl">🗺️</span>
                      </div>
                      <div>
                        <span className="pe-22 text-main block">Strava & GPX Aktarımı</span>
                        <span className="pe-23 text-muted">
                          Doğa yürüyüşü ve bisiklet rotalarını doğrudan aktar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="stitch-avatar-btn secondary"
                      onClick={() => showToast("Strava entegrasyonu yakında aktif olacaktır.")}
                    >
                      Bağla
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Payment, Subscription & Billing Hub */}
            {activeTab === "odeme" && (
              <div
                className="stitch-form-section"
                style={{ display: "flex", flexDirection: "column", gap: "24px" }}
              >
                <div className="stitch-section-header">
                  <div className="stitch-section-title-wrap">
                    <span className="stitch-section-dot" />
                    <h2 className="stitch-section-title">Üyelik, Fatura & Para Kazanma Merkezi</h2>
                  </div>
                  <a
                    href="/checkout/"
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--color-primary, var(--color-accent))",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>Ödeme Masasını Aç</span>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                      open_in_new
                    </span>
                  </a>
                </div>

                {/* 1. Aktif Abonelik ve Kredi Durumu */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "14px",
                    background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "10px",
                          background: "var(--color-accent)",
                          color: "#031c13",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                          verified
                        </span>
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: 800,
                              color: "var(--color-on-primary)",
                            }}
                          >
                            {wallet.subscriptionTier === "pro"
                              ? "PRO KAŞİF (Pro Traveler)"
                              : wallet.subscriptionTier === "agency"
                                ? "TUR LİDERİ & ACENTA"
                                : wallet.subscriptionTier === "explorer"
                                  ? "KAŞİF (Explorer)"
                                  : "GEZGİN (Ücretsiz Plan)"}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              color: "var(--color-accent)",
                              background:
                                "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              border: "1px solid var(--color-accent-a30)",
                            }}
                          >
                            AKTİF PLAN
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                          }}
                        >
                          Dönem:{" "}
                          {wallet.subscriptionCycle === "yearly"
                            ? "Yıllık Taahhüt (%20 İndirimli)"
                            : "Aylık"}{" "}
                          · Yenilenme: 30 Gün Sonra
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <a
                        href="/checkout/?tab=credits"
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          background: "var(--color-accent)",
                          color: "#031c13",
                          fontWeight: 700,
                          fontSize: "12px",
                          textDecoration: "none",
                        }}
                      >
                        + Kredi Yükle
                      </a>
                      <a
                        href="/checkout/?tab=plans"
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 6%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontWeight: 600,
                          fontSize: "12px",
                          textDecoration: "none",
                        }}
                      >
                        Planı Yükselt
                      </a>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "12px",
                      paddingTop: "10px",
                      borderTop:
                        "1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                        }}
                      >
                        Kalan AI Kredisi:
                      </span>
                      <div
                        style={{ fontSize: "15px", fontWeight: 800, color: "var(--color-accent)" }}
                      >
                        ⚡ {wallet.credits} Kredi
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                        }}
                      >
                        Pazar Yeri Komisyonu:
                      </span>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        %10 (Kazancınız %90 Net)
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                        }}
                      >
                        Öncelikli AI &amp; OSRM:
                      </span>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        Açık / Aktif
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Fatura ve Vergi Bilgileri Formu */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "14px",
                    background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                    border: "1px solid var(--color-white-a08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "var(--color-accent)" }}
                    >
                      receipt_long
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                      }}
                    >
                      Fatura &amp; Yasal Bilgiler
                    </h3>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        cursor: "pointer",
                        color: "var(--color-on-primary)",
                      }}
                    >
                      <input
                        type="radio"
                        name="invoiceType"
                        checked={billingDetails.invoiceType === "individual"}
                        onChange={() =>
                          setBillingDetails({ ...billingDetails, invoiceType: "individual" })
                        }
                      />
                      <span>Bireysel Fatura</span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        cursor: "pointer",
                        color: "var(--color-on-primary)",
                      }}
                    >
                      <input
                        type="radio"
                        name="invoiceType"
                        checked={billingDetails.invoiceType === "corporate"}
                        onChange={() =>
                          setBillingDetails({ ...billingDetails, invoiceType: "corporate" })
                        }
                      />
                      <span>Kurumsal / Şirket Faturası</span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "14px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        {billingDetails.invoiceType === "corporate"
                          ? "Şirket Unvanı *"
                          : "Ad Soyad *"}
                      </label>
                      <input
                        type="text"
                        value={billingDetails.fullNameOrCompany}
                        onChange={(e) =>
                          setBillingDetails({
                            ...billingDetails,
                            fullNameOrCompany: e.target.value,
                          })
                        }
                        className="form-input"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        {billingDetails.invoiceType === "corporate"
                          ? "Vergi Numarası *"
                          : "T.C. Kimlik No *"}
                      </label>
                      <input
                        type="text"
                        value={billingDetails.taxOrIdNumber}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, taxOrIdNumber: e.target.value })
                        }
                        className="form-input"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>

                  {billingDetails.invoiceType === "corporate" && (
                    <div style={{ marginBottom: "14px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Vergi Dairesi
                      </label>
                      <input
                        type="text"
                        value={billingDetails.taxOffice || ""}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, taxOffice: e.target.value })
                        }
                        className="form-input"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr",
                      gap: "14px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Fatura Adresi
                      </label>
                      <input
                        type="text"
                        value={billingDetails.address}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, address: e.target.value })
                        }
                        className="form-input"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Şehir / Ülke
                      </label>
                      <input
                        type="text"
                        value={billingDetails.city}
                        onChange={(e) =>
                          setBillingDetails({ ...billingDetails, city: e.target.value })
                        }
                        className="form-input"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      billingService.saveBillingDetails(billingDetails);
                      showToast("✓ Fatura bilgileri başarıyla kaydedildi");
                    }}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "var(--color-accent)",
                      color: "#031c13",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Fatura Bilgilerini Kaydet
                  </button>
                </div>

                {/* 3. Gezgin Cüzdanı & Gelir Çekme (IBAN) */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "14px",
                    background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                    border: "1px solid var(--color-white-a08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "20px", color: "var(--color-accent)" }}
                    >
                      account_balance_wallet
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                      }}
                    >
                      Gezgin Cüzdanı &amp; Gelir Çekme
                    </h3>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "12px",
                      marginBottom: "18px",
                    }}
                  >
                    <div
                      style={{
                        background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                        padding: "14px",
                        borderRadius: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                        }}
                      >
                        Çekilebilir Bakiye
                      </span>
                      <div
                        style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-accent)" }}
                      >
                        ₺{wallet.creatorEarningsTry.toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--color-neutral-0) 10%, transparent)",
                        padding: "14px",
                        borderRadius: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                        }}
                      >
                        Bekleyen Transfer
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        ₺{wallet.creatorPendingPayoutTry.toLocaleString("tr-TR")}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--color-neutral-0) 10%, transparent)",
                        padding: "14px",
                        borderRadius: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                        }}
                      >
                        Toplam Çekilen
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        ₺{wallet.totalWithdrawnTry.toLocaleString("tr-TR")}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr",
                      gap: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Banka IBAN Numarası
                      </label>
                      <input
                        type="text"
                        value={payoutIban}
                        onChange={(e) => setPayoutIban(e.target.value)}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Hesap Sahibi
                      </label>
                      <input
                        type="text"
                        value={payoutHolder}
                        onChange={(e) => setPayoutHolder(e.target.value)}
                        placeholder="Ad Soyad"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "color-mix(in srgb, var(--color-on-primary) 70%, transparent)",
                          marginBottom: "4px",
                        }}
                      >
                        Çekim Tutarı (₺)
                      </label>
                      <input
                        type="number"
                        min="250"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="Min ₺250"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--color-neutral-0) 15%, transparent)",
                          color: "var(--color-on-primary)",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const amount = Number(payoutAmount);
                      if (!amount || amount < 250) {
                        showToast("⚠️ Minimum çekim tutarı ₺250 olmalıdır.");
                        return;
                      }
                      const res = await billingService.requestPayout(
                        amount,
                        payoutIban,
                        payoutHolder,
                      );
                      if (res.success) {
                        setPayoutAmount("");
                        showToast(`✓ ${res.message}`);
                      } else {
                        showToast(`⚠️ ${res.message}`);
                      }
                    }}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "var(--color-accent-a20)",
                      border: "1px solid var(--color-accent)",
                      color: "var(--color-accent)",
                      fontWeight: 700,
                      fontSize: "12.5px",
                      cursor: "pointer",
                    }}
                  >
                    Para Çekme Talebi Oluştur
                  </button>
                </div>

                {/* 4. Satın Alma ve Fatura Geçmişi Tablosu */}
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "14px",
                    background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                    border: "1px solid var(--color-white-a08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "20px", color: "var(--color-accent)" }}
                      >
                        history
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: "var(--color-on-primary)",
                        }}
                      >
                        Satın Alma &amp; Fatura Geçmişi
                      </h3>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                      }}
                    >
                      {transactions.length} Kayıt
                    </span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12.5px",
                        color: "var(--color-on-primary)",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom:
                              "1px solid color-mix(in srgb, var(--color-neutral-0) 10%, transparent)",
                            textAlign: "left",
                          }}
                        >
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                            }}
                          >
                            Tarih
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                            }}
                          >
                            Hizmet / Açıklama
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                            }}
                          >
                            Tutar (₺)
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                            }}
                          >
                            Kredi
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                            }}
                          >
                            Durum
                          </th>
                          <th
                            style={{
                              padding: "10px 8px",
                              color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                              fontWeight: 600,
                              textAlign: "right",
                            }}
                          >
                            Belge
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            style={{
                              borderBottom:
                                "1px solid color-mix(in srgb, var(--color-neutral-0) 5%, transparent)",
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 8px",
                                color:
                                  "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                              }}
                            >
                              {new Date(tx.date).toLocaleDateString("tr-TR")}
                            </td>
                            <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                              {tx.description}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              {tx.amountTry !== undefined
                                ? `₺${Math.abs(tx.amountTry).toLocaleString("tr-TR")}`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "10px 8px",
                                color:
                                  tx.creditsDelta && tx.creditsDelta > 0 ? "#10b981" : "inherit",
                              }}
                            >
                              {tx.creditsDelta
                                ? tx.creditsDelta > 0
                                  ? `+${tx.creditsDelta}`
                                  : `${tx.creditsDelta}`
                                : "—"}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background:
                                    tx.status === "completed"
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : "rgba(234, 179, 8, 0.15)",
                                  color: tx.status === "completed" ? "#10b981" : "#eab308",
                                }}
                              >
                                {tx.status === "completed" ? "Tamamlandı" : "İşlemde"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptTx(tx)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--color-accent)",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  textDecoration: "underline",
                                }}
                              >
                                Makbuz
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "guvenlik" && <AIMemorySettings />}

            {/* Tab 6: Danger Zone */}
            {activeTab === "tehlike" && (
              <div className="stitch-form-section">
                <div className="stitch-section-header">
                  <div className="stitch-section-title-wrap">
                    <span className="w-2.5 h-2.5 pe-24 bg-error" />
                    <h2 className="stitch-section-title text-error">Tehlike Bölgesi</h2>
                  </div>
                </div>

                <div className="p-4 pe-25 bg-error-container/30 border-error/20">
                  <span className="pe-22 text-error">Hesabı Dondur veya Kalıcı Olarak Sil</span>
                  <p className="pe-23 text-muted">
                    Hesabınızı sildiğinizde yayınladığınız tüm rotalar, favori duraklarınız ve
                    harita masası verileriniz geri döndürülemez biçimde silinir.
                  </p>
                  <div className="pe-26">
                    <button
                      type="button"
                      className="stitch-avatar-btn secondary"
                      onClick={() =>
                        showToast(
                          "Hesabınız geçici olarak donduruldu. Giriş yaparak istediğiniz zaman açabilirsiniz.",
                        )
                      }
                    >
                      Hesabı Geçici Dondur
                    </button>
                    <button
                      type="button"
                      className="stitch-cover-action-btn danger"
                      onClick={() => setShowDangerModal(true)}
                    >
                      Hesabı Kalıcı Olarak Sil
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Webcam Modal */}
      {isWebcamOpen && (
        <div className="stitch-modal-overlay">
          <div className="stitch-modal-card">
            <div className="pe-2">
              <h3 className="pe-27 text-main text-base">Webcam ile Fotoğraf Çek</h3>
              <button type="button" onClick={closeWebcam} className="text-muted hover:text-main">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <video ref={videoRef} className="stitch-webcam-preview" autoPlay playsInline />
            <div className="pe-28 justify-end">
              <button type="button" className="stitch-btn-cancel" onClick={closeWebcam}>
                İptal
              </button>
              <button type="button" className="stitch-btn-save" onClick={captureWebcamPhoto}>
                <span className="material-symbols-outlined">camera</span>
                <span>Fotoğrafı Çek</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Delete Confirmation Modal */}
      {showDangerModal && (
        <div className="stitch-modal-overlay">
          <div className="stitch-modal-card">
            <div className="pe-29 text-error">
              <span className="material-symbols-outlined">warning</span>
              <h3 className="pe-27 text-base">Hesabı Silmek İstediğinizden Emin misiniz?</h3>
            </div>
            <p className="pe-30 text-muted">
              Bu işlem geri alınamaz. Profiliniz, rotalarınız ve seyahat verileriniz kalıcı olarak
              silinecektir. Devam etmek istiyor musunuz?
            </p>
            <div className="pe-28 justify-end">
              <button
                type="button"
                className="stitch-btn-cancel"
                onClick={() => setShowDangerModal(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="stitch-cover-action-btn danger"
                onClick={() => {
                  userStorage.removeItem("mapsbridge.userProfileDetails");
                  userStorage.removeItem("mapsbridge.userAvatar");
                  userStorage.removeItem("mapsbridge.userCoverPhoto");
                  userStorage.removeItem("mapsbridge.userPreferences");
                  showToast("Hesap verileriniz temizlendi.");
                  setShowDangerModal(false);
                  window.location.href = "/";
                }}
              >
                Evet, Hesabımı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt / Invoice Modal */}
      {selectedReceiptTx && (
        <div className="stitch-modal-overlay" onClick={() => setSelectedReceiptTx(null)}>
          <div
            className="stitch-modal-card"
            style={{
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              color: "var(--color-on-primary)",
              background: "var(--color-surface-inverse)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                borderBottom:
                  "1px solid color-mix(in srgb, var(--color-neutral-0) 10%, transparent)",
                paddingBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "24px", color: "var(--color-accent)" }}
                >
                  receipt
                </span>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                  Resmi Ödeme Makbuzu
                </h3>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                }}
              >
                #{selectedReceiptTx.id}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{ color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)" }}
                >
                  Hizmet:
                </span>
                <span style={{ fontWeight: 600 }}>{selectedReceiptTx.description}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{ color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)" }}
                >
                  Tarih:
                </span>
                <span>{new Date(selectedReceiptTx.date).toLocaleString("tr-TR")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span
                  style={{ color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)" }}
                >
                  Tutar:
                </span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--color-accent)" }}>
                  {selectedReceiptTx.amountTry !== undefined
                    ? `₺${Math.abs(selectedReceiptTx.amountTry).toLocaleString("tr-TR")}`
                    : "0 ₺"}
                </span>
              </div>
              {selectedReceiptTx.creditsDelta !== undefined &&
                selectedReceiptTx.creditsDelta !== 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span
                      style={{
                        color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                      }}
                    >
                      Kredi Hareketi:
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: selectedReceiptTx.creditsDelta > 0 ? "#10b981" : "#fff",
                      }}
                    >
                      {selectedReceiptTx.creditsDelta > 0
                        ? `+${selectedReceiptTx.creditsDelta}`
                        : `${selectedReceiptTx.creditsDelta}`}{" "}
                      Kredi
                    </span>
                  </div>
                )}
              <div
                style={{
                  borderTop: "1px solid var(--color-white-a08)",
                  paddingTop: "10px",
                  marginTop: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                    marginBottom: "4px",
                  }}
                >
                  Fatura Sahibi:
                </div>
                <div style={{ fontWeight: 600 }}>{billingDetails.fullNameOrCompany}</div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "color-mix(in srgb, var(--color-on-primary) 60%, transparent)",
                  }}
                >
                  {billingDetails.invoiceType === "corporate"
                    ? `Vergi No: ${billingDetails.taxOrIdNumber}`
                    : `TCKN: ${billingDetails.taxOrIdNumber}`}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "color-mix(in srgb, var(--color-on-primary) 50%, transparent)",
                  }}
                >
                  {billingDetails.address}, {billingDetails.city}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  background: "var(--color-accent)",
                  color: "#031c13",
                  fontWeight: 700,
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                  print
                </span>
                Yazdır / PDF Kaydet
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceiptTx(null)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "var(--color-white-a08)",
                  color: "var(--color-on-primary)",
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="stitch-toast-notification">
          <span className="material-symbols-outlined text-mint-glow">info</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </PageShell>
  );
}
