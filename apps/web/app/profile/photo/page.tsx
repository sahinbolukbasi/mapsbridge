"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "../../components/auth-gate";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Icon,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  useToast,
  type IconName,
} from "../../components/ui";
import { getStoredSession } from "../../lib/cognito";
import { color } from "../../lib/design-tokens";
import { iconPaths } from "../../lib/icon-paths";
import { useLocale } from "../../lib/locale-context";
import { userStorage } from "../../lib/user-storage";
import "./photo.css";

const NEXT = "/profile/photo/";
const MAX_BYTES = 2 * 1024 * 1024;

/** Hazır avatarlar: ikon seti + tasarım token'ı zemin (emoji yok, R3). */
const PRESETS: ReadonlyArray<{
  id: string;
  icon: IconName;
  key: string;
  label: string;
  bg: string;
}> = [
  {
    id: "compass",
    icon: "compass",
    key: "photo.preset.explorer",
    label: "Kaşif",
    bg: color.primary,
  },
  { id: "walk", icon: "walk", key: "photo.preset.hiker", label: "Yürüyüşçü", bg: color.brand },
  {
    id: "globe",
    icon: "globe",
    key: "photo.preset.world",
    label: "Dünya gezgini",
    bg: color.primary,
  },
  { id: "route", icon: "route", key: "photo.preset.route", label: "Rota", bg: color.brand },
  {
    id: "camera",
    icon: "camera",
    key: "photo.preset.camera",
    label: "Fotoğrafçı",
    bg: color.primary,
  },
  {
    id: "landmark",
    icon: "landmark",
    key: "photo.preset.culture",
    label: "Kültür",
    bg: color.brand,
  },
];

function presetDataUrl(icon: IconName, bg: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="12" fill="${bg}"/>` +
    `<g transform="translate(6 6) scale(0.5)" fill="none" stroke="${color.onPrimary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${iconPaths[icon]}"/></g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Profil fotoğrafı (design §5.2): misafire AuthGate; görsel yalnızca bu cihazda saklanır. */
export default function ProfilePhotoPage() {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setEmail(session.email);
    const saved = userStorage.getItem("mapsbridge.userAvatar");
    if (saved) {
      setCurrent(saved);
      setPreview(saved);
    }
  }, []);

  if (authed === false) return <AuthGate variant="page" reason="profile" next={NEXT} />;
  if (authed === null) {
    return (
      <PageShell>
        <PageHeader enter />
        <LoadingState />
      </PageShell>
    );
  }

  function pick(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("photo.error.type", "Bir görsel dosyası seç (JPG, PNG ya da WebP)."));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("photo.error.size", "Görsel en fazla 2 MB olabilir."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result;
      if (typeof url === "string") setPreview(url);
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) pick(file);
  }

  function save() {
    if (!preview) return;
    try {
      userStorage.setItem("mapsbridge.userAvatar", preview);
    } catch {
      setError(t("photo.error.save", "Fotoğraf kaydedilemedi. Daha küçük bir görsel dene."));
      return;
    }
    setCurrent(preview);
    toast.show({ tone: "success", message: t("photo.saved", "Profil fotoğrafın güncellendi.") });
    router.push("/profile/");
  }

  function remove() {
    userStorage.removeItem("mapsbridge.userAvatar");
    setCurrent(null);
    setPreview(null);
    toast.show({ tone: "success", message: t("photo.removed", "Profil fotoğrafı kaldırıldı.") });
  }

  const name = email ? email.split("@")[0] : "?";

  return (
    <PageShell className="photo-page">
      <PageHeader
        enter
        breadcrumb={[
          { label: t("nav.profile", "Profil"), href: "/profile/" },
          { label: t("photo.title", "Profil fotoğrafı") },
        ]}
        description={t(
          "photo.description",
          "Profilinde ve paylaşımlarında görünür. Görsel bu cihazda saklanır.",
        )}
      />

      <Card className="photo-preview">
        <Avatar src={preview} name={name} size="lg" />
        <p className="photo-preview__hint" role="status">
          {preview
            ? t("photo.preview", "Önizleme: profilinde böyle görünür.")
            : t("photo.none", "Henüz bir fotoğraf seçmedin.")}
        </p>
        <div className="photo-preview__actions">
          <Button onClick={save} disabled={!preview || preview === current}>
            {t("photo.save", "Fotoğrafı kaydet")}
          </Button>
          {current && (
            <Button variant="ghost" onClick={remove}>
              {t("photo.remove", "Fotoğrafı kaldır")}
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <Alert tone="danger" live="assertive">
          {error}
        </Alert>
      )}

      <Section reveal title={t("photo.upload", "Kendi fotoğrafını yükle")} level={2}>
        <div
          className="photo-drop"
          data-dragging={dragging || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Icon name="image" size={24} />
          <p className="photo-drop__text">
            {t(
              "photo.drop",
              "Görseli buraya sürükle ya da dosya seç. PNG, JPG, WebP; en fazla 2 MB.",
            )}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="photo-drop__input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pick(file);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {t("photo.choose", "Dosya seç")}
          </Button>
        </div>
      </Section>

      <Section reveal title={t("photo.presets", "Hazır avatarlar")} level={2}>
        <ul className="photo-presets">
          {PRESETS.map((p) => {
            const url = presetDataUrl(p.icon, p.bg);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="photo-preset"
                  aria-pressed={preview === url}
                  onClick={() => {
                    setError(null);
                    setPreview(url);
                  }}
                >
                  <img src={url} alt="" className="photo-preset__img" />
                  <span>{t(p.key, p.label)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </PageShell>
  );
}
