"use client";

import { userStorage } from "../../lib/user-storage";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FullPagePromotion } from "../../components/auth-gate";
import { getStoredSession } from "../../lib/cognito";
import "./photo.css";
import { PageHeader, PageShell } from "../../components/ui";

const PRESET_AVATARS = [
  {
    id: "avatar-1",
    label: "Kaşif Gezgin",
    emoji: "🧭",
    bg: "linear-gradient(135deg, #0284c7, #2563eb)",
  },
  {
    id: "avatar-2",
    label: "Dağ & Kamp",
    emoji: "⛰️",
    bg: "linear-gradient(135deg, #059669, #10b981)",
  },
  {
    id: "avatar-3",
    label: "Dünya Seyyahı",
    emoji: "🌍",
    bg: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  },
  {
    id: "avatar-4",
    label: "Güneş & Deniz",
    emoji: "🏖️",
    bg: "linear-gradient(135deg, #f59e0b, #f97316)",
  },
  {
    id: "avatar-5",
    label: "Uçak & Rota",
    emoji: "✈️",
    bg: "linear-gradient(135deg, #ec4899, #ef4444)",
  },
  {
    id: "avatar-6",
    label: "Kamera & Anı",
    emoji: "📸",
    bg: "linear-gradient(135deg, #06b6d4, #0ea5e9)",
  },
];

export default function ProfilePhotoPage() {
  const router = useRouter();
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setIsAuthenticated(false);
      return;
    }
    setIsAuthenticated(true);
    setUserEmail(session.email);
    const saved = userStorage.getItem("mapsbridge.userAvatar");
    if (saved) {
      setCurrentAvatar(saved);
      setPreviewUrl(saved);
    }
  }, []);

  function triggerToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      triggerToast("⚠️ Lütfen geçerli bir görsel dosyası seçin (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      triggerToast("⚠️ Görsel boyutu en fazla 2MB olmalıdır.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
      triggerToast("✓ Görsel seçildi. Kaydetmek için 'Fotoğrafı Kaydet'e basın.");
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handlePresetSelect(preset: (typeof PRESET_AVATARS)[0]) {
    // Generate an SVG data URL for the preset avatar
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="50%" y="54%" font-size="80" dominant-baseline="middle" text-anchor="middle">${preset.emoji}</text></svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setPreviewUrl(dataUrl);
    triggerToast(`✓ "${preset.label}" şablonu seçildi.`);
  }

  function handleSave() {
    if (!previewUrl) {
      triggerToast("⚠️ Lütfen bir görsel yükleyin veya hazır avatar seçin.");
      return;
    }
    try {
      userStorage.setItem("mapsbridge.userAvatar", previewUrl);
    } catch {
      triggerToast("Fotoğraf kaydedilemedi. Daha küçük bir görsel deneyin.");
      return;
    }
    setCurrentAvatar(previewUrl);
    triggerToast("✓ Profil fotoğrafınız başarıyla güncellendi!");
    setTimeout(() => {
      router.push("/profile/");
    }, 1000);
  }

  function handleRemove() {
    userStorage.removeItem("mapsbridge.userAvatar");
    setCurrentAvatar(null);
    setPreviewUrl(null);
    triggerToast("✓ Profil fotoğrafı kaldırıldı.");
  }

  const initialLetter = userEmail ? userEmail.charAt(0).toUpperCase() : "G";

  if (isAuthenticated === false) {
    return (
      <FullPagePromotion
        badgeIcon="📸"
        badgeText="Gezgin Avatarı ve Fotoğrafı"
        heroTitle="Profil Fotoğrafınızı Özelleştirin"
        heroSubtitle="MapsBridge profilinizde görünecek avatar veya gezi fotoğrafınızı yüklemek için lütfen hesabınıza giriş yapın veya ücretsiz kayıt olun."
        nextUrl="/profile/photo/"
        primaryButtonText="Ücretsiz Kayıt Ol"
        secondaryButtonText="Giriş Yap"
        features={[
          {
            icon: "📸",
            title: "Özel Gezgin Fotoğrafı",
            description:
              "Kendi fotoğrafınızı veya seyahat karenizi profil avatarı olarak yükleyin.",
          },
          {
            icon: "🧭",
            title: "Tematik Avatarlar",
            description:
              "Kaşif, kampçı veya dünya seyyahı hazır avatarlarından dilediğinizi seçin.",
          },
          {
            icon: "🌟",
            title: "Toplulukta Görünürlük",
            description: "Yayınladığınız gezi rotalarında ve mesajlarda profilinizle fark yaratın.",
          },
          {
            icon: "🔒",
            title: "Güvenli Depolama",
            description: "Görselleriniz daima sizin cihaz ve hesap kontrolünüzde güvenle saklanır.",
          },
        ]}
      />
    );
  }

  return (
    <PageShell layout="landing" className="photo-page-root">
      {/* Tek h1 (AC-34): görsel başlık sayfa içinde <p> olarak kalır; kabuk başlığı ekran okuyucuya. */}
      <PageHeader variant="hidden" title="Profil Fotoğrafı Yükle" />
      <div className="photo-page-container">
        {/* Üst Başlık & Geri Dön */}
        <div className="photo-page-header">
          <a href="/profile/" className="back-link">
            ← Profile Geri Dön
          </a>
          <span className="photo-eyebrow">HESAP GÖRÜNÜMÜ</span>
          <p className="photo-title">Profil Fotoğrafı Yükle</p>
          <p className="photo-sub">
            MapsBridge profilinizde, seyahat gruplarınızda ve harita paylaşımlarınızda görünecek
            fotoğrafınızı belirleyin.
          </p>
        </div>

        <div className="photo-grid-layout">
          {/* Sol Kolon: Canlı Önizleme */}
          <div className="preview-card">
            <h3 className="card-heading">Canlı Dairesel Önizleme</h3>
            <div className="avatar-preview-wrapper">
              {previewUrl ? (
                <img src={previewUrl} alt="Profil Önizleme" className="avatar-preview-img" />
              ) : (
                <div className="avatar-fallback-placeholder">
                  <span>{initialLetter}</span>
                </div>
              )}
              <div className="preview-ring" />
            </div>

            <p className="preview-hint">
              {previewUrl
                ? "Fotoğrafınız profilde ve paylaşımlarda bu şekilde görünecektir."
                : "Henüz bir fotoğraf yüklemediniz. Aşağıdan dosya seçebilir veya hazır avatar kullanabilirsiniz."}
            </p>

            <div className="preview-actions-row">
              <button
                type="button"
                className="save-photo-btn"
                onClick={handleSave}
                disabled={!previewUrl || previewUrl === currentAvatar}
              >
                ✓ Fotoğrafı Kaydet
              </button>

              {currentAvatar && (
                <button type="button" className="remove-photo-btn" onClick={handleRemove}>
                  Fotoğrafı Kaldır
                </button>
              )}
            </div>
          </div>

          {/* Sağ Kolon: Yükleme Alanı & Hazır Şablonlar */}
          <div className="upload-options-card">
            <h3 className="card-heading">1. Kendi Fotoğrafını Yükle</h3>

            <div
              className={`drop-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="drop-icon">📷</div>
              <strong className="drop-title">Fotoğrafı Buraya Sürükleyin veya Tıklayın</strong>
              <span className="drop-sub">PNG, JPG, WebP (Maksimum 5 MB)</span>
              <button
                type="button"
                className="browse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Bilgisayarımdan / Telefonumdan Seç
              </button>
            </div>

            <div className="section-divider">
              <span>VEYA</span>
            </div>

            <h3 className="card-heading">2. Hazır Gezgin Avatarları</h3>
            <p className="preset-sub">
              Fotoğraf yüklemek istemiyorsanız stilinize uygun bir seyahat avatarı seçin:
            </p>

            <div className="preset-avatars-grid">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-avatar-btn"
                  onClick={() => handlePresetSelect(preset)}
                  title={preset.label}
                >
                  <span className="preset-emoji">{preset.emoji}</span>
                  <span className="preset-label">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Toast Bildirimi */}
        {toast && (
          <div role="status" className="photo-toast">
            {toast}
          </div>
        )}
      </div>
    </PageShell>
  );
}
