"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AIMemorySettings } from "../../components/ai-memory-settings";
import { AuthGate } from "../../components/auth-gate";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  ChipGroup,
  ConfirmDialog,
  Field,
  Icon,
  IconButton,
  Input,
  LoadingState,
  PageHeader,
  PageShell,
  Section,
  Tabs,
  Textarea,
  useToast,
  VisuallyHidden,
} from "../../components/ui";
import { AVAILABLE_INTERESTS } from "../../features/profile/constants";
import { apiFetch } from "../../lib/api-client";
import { billingService } from "../../lib/billing/billing-service";
import type { WalletData } from "../../lib/billing/billing-types";
import { changePasswordDirect, getStoredSession } from "../../lib/cognito";
import { useLocale } from "../../lib/locale-context";
import { webSocialSync } from "../../lib/social-sync";
import { userStorage } from "../../lib/user-storage";
import "./edit.css";

const NEXT = "/profile/edit/";
const TABS = ["genel", "guvenlik", "odeme", "tehlike"] as const;
const BIO_MAX = 300;

type Details = {
  fullName: string;
  username: string;
  travelTitle: string;
  bio: string;
  location: string;
  languages: string[];
  interests: string[];
  instagram: string;
  youtubeOrBlog: string;
};

const EMPTY: Details = {
  fullName: "",
  username: "",
  travelTitle: "",
  bio: "",
  location: "",
  languages: [],
  interests: [],
  instagram: "",
  youtubeOrBlog: "",
};

/** Kullanıcı adı kuralı (eski sayfayla aynı): küçük harf, rakam, alt çizgi. */
function cleanUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

const PASSWORD_RULES: ReadonlyArray<[test: (p: string) => boolean, key: string, label: string]> = [
  [(p) => p.length >= 12, "edit.pw.rule.length", "En az 12 karakter"],
  [(p) => /[A-Z]/.test(p), "edit.pw.rule.upper", "En az bir büyük harf (A-Z)"],
  [(p) => /[a-z]/.test(p), "edit.pw.rule.lower", "En az bir küçük harf (a-z)"],
  [(p) => /[0-9]/.test(p), "edit.pw.rule.digit", "En az bir rakam (0-9)"],
  [
    (p) => /[^A-Za-z0-9]/.test(p),
    "edit.pw.rule.symbol",
    "En az bir özel karakter (@, #, $, !, %…)",
  ],
];

/**
 * Profili düzenle (design §5.2, F18): misafire AuthGate sayfası. Formlar Field/Input/Textarea;
 * yalnızca gerçekten bir şeye bağlı ayarlar gösterilir (I10): profil bilgileri (cihaz + sunucu
 * `POST /profile/publish`), şifre (Cognito), AI hafızası, bakiye/plan (sunucu cüzdanı).
 */
export default function EditProfilePage() {
  const { t } = useLocale();
  const toast = useToast();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY);
  const [stored, setStored] = useState<Record<string, unknown>>({});
  const [avatar, setAvatar] = useState<string | null>(null);
  const [newLanguage, setNewLanguage] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  // Sunucu cüzdanı gelene kadar varsayılan (Gezgin, 0) gerçekmiş gibi gösterilmez.
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletFailed, setWalletFailed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    if (!session?.email || !session?.token) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const prefix = session.email.split("@")[0] || "";
    const next: Details = { ...EMPTY, username: cleanUsername(prefix) };
    try {
      const raw = userStorage.getItem("mapsbridge.userProfileDetails");
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        setStored(d);
        const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
        next.fullName = s("fullName") || `${s("firstName")} ${s("lastName")}`.trim();
        next.username = s("username") || next.username;
        next.travelTitle = s("travelTitle");
        next.bio = s("bio");
        next.location = s("location") || s("currentCountry");
        next.languages = Array.isArray(d.languages) ? (d.languages as string[]) : [];
        next.interests = Array.isArray(d.interests) ? (d.interests as string[]) : [];
        next.instagram = s("instagram");
        next.youtubeOrBlog = s("youtubeOrBlog");
      }
    } catch {}
    setDetails(next);
    setAvatar(userStorage.getItem("mapsbridge.userAvatar"));
    const onWallet = () => setWallet(billingService.getWallet());
    window.addEventListener("mapsbridge:wallet_updated", onWallet);
    void billingService
      .refreshWallet()
      .then(setWallet)
      .catch(() => setWalletFailed(true));
    return () => window.removeEventListener("mapsbridge:wallet_updated", onWallet);
  }, []);

  if (authed === false) return <AuthGate variant="page" reason="profile" next={NEXT} />;
  if (authed === null) {
    return (
      <PageShell>
        <PageHeader />
        <LoadingState />
      </PageShell>
    );
  }

  const set = <K extends keyof Details>(key: K, value: Details[K]) =>
    setDetails((d) => ({ ...d, [key]: value }));

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    const username = cleanUsername(details.username);
    if (!username) {
      setNameError(t("edit.username.required", "Kullanıcı adı en az bir harf ya da rakam içerir."));
      return;
    }
    setNameError(null);
    const clean: Details = {
      ...details,
      username,
      fullName: details.fullName.trim(),
      travelTitle: details.travelTitle.trim(),
      bio: details.bio.trim(),
      location: details.location.trim(),
      instagram: details.instagram.trim(),
      youtubeOrBlog: details.youtubeOrBlog.trim(),
    };
    setDetails(clean);
    // Bu sayfada artık düzenlenmeyen eski alanlar (ör. showProBadge, emailPrivacy) korunur;
    // updateProfile kayıtlı ayrıntıların üzerine birleştirir (diller, ilgi alanları, bağlantılar).
    const merged = { ...stored, ...clean };
    userStorage.setItem("mapsbridge.userProfileDetails", JSON.stringify(merged));
    setStored(merged);
    webSocialSync.updateProfile({
      fullName: clean.fullName,
      username,
      travelTitle: clean.travelTitle,
      bio: clean.bio,
      location: clean.location,
      ...(avatar ? { avatarUrl: avatar } : {}),
    });
    toast.show({ tone: "success", message: t("edit.saved", "Değişikliklerin kaydedildi.") });
    // Sunucuya kalıcı yaz (best-effort): başka cihaz/oturumda da görünsün.
    if (getStoredSession()?.token) {
      const parts = clean.fullName.split(" ");
      void apiFetch("/profile/publish", {
        method: "POST",
        body: JSON.stringify({
          username,
          profile: {
            firstName: parts[0] || username,
            lastName: parts.slice(1).join(" ") || "",
            bio: clean.bio,
            avatar: avatar || "",
          },
        }),
      }).catch(() => {});
    }
  }

  function addLanguage() {
    const lang = newLanguage.trim();
    if (lang && !details.languages.includes(lang)) set("languages", [...details.languages, lang]);
    setNewLanguage("");
  }

  const profileTab = (
    <form className="edit-form" onSubmit={saveProfile} noValidate>
      <Card className="edit-avatar">
        <Avatar src={avatar} name={details.fullName || details.username || "?"} size="lg" />
        <div className="edit-avatar__text">
          <p className="edit-avatar__title">{t("photo.title", "Profil fotoğrafı")}</p>
          <p className="edit-avatar__hint">
            {t("edit.avatar.hint", "Fotoğraf bu cihazda saklanır.")}
          </p>
        </div>
        <Button
          href="/profile/photo/"
          variant="secondary"
          iconStart={<Icon name="camera" size={16} />}
        >
          {t("profile.photo", "Fotoğrafı değiştir")}
        </Button>
      </Card>

      <Section title={t("edit.basic", "Temel bilgiler")} level={2}>
        <div className="edit-grid">
          <Field label={t("edit.fullName", "Ad soyad")}>
            {(ids) => (
              <Input
                {...ids}
                autoComplete="name"
                maxLength={80}
                value={details.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("edit.username", "Kullanıcı adı")}
            hint={t("edit.username.hint", "Küçük harf, rakam ve alt çizgi.")}
            error={nameError}
            required
          >
            {(ids) => (
              <Input
                {...ids}
                autoComplete="username"
                maxLength={30}
                value={details.username}
                onChange={(e) => set("username", e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("edit.title", "Gezgin unvanı")}
            optionalLabel={t("ui.optional", "isteğe bağlı")}
          >
            {(ids) => (
              <Input
                {...ids}
                maxLength={60}
                value={details.travelTitle}
                onChange={(e) => set("travelTitle", e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("edit.location", "Konum")}
            optionalLabel={t("ui.optional", "isteğe bağlı")}
          >
            {(ids) => (
              <Input
                {...ids}
                autoComplete="address-level2"
                maxLength={80}
                value={details.location}
                onChange={(e) => set("location", e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field
          label={t("edit.bio", "Tanıtım")}
          hint={`${details.bio.length} / ${BIO_MAX}`}
          optionalLabel={t("ui.optional", "isteğe bağlı")}
        >
          {(ids) => (
            <Textarea
              {...ids}
              rows={4}
              maxLength={BIO_MAX}
              value={details.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title={t("edit.languages", "Konuştuğun diller")} level={2}>
        {details.languages.length > 0 && (
          <ul className="edit-tags">
            {details.languages.map((lang) => (
              <li key={lang} className="edit-tag">
                <span>{lang}</span>
                <IconButton
                  icon="x"
                  size="sm"
                  label={t("edit.languages.remove", "{lang} dilini kaldır").replace("{lang}", lang)}
                  onClick={() =>
                    set(
                      "languages",
                      details.languages.filter((l) => l !== lang),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <div className="edit-inline">
          <Field label={t("edit.languages.add", "Dil ekle")} className="edit-inline__field">
            {(ids) => (
              <Input
                {...ids}
                maxLength={40}
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLanguage();
                  }
                }}
              />
            )}
          </Field>
          <Button variant="secondary" onClick={addLanguage} disabled={!newLanguage.trim()}>
            {t("edit.languages.addCta", "Ekle")}
          </Button>
        </div>
      </Section>

      <Section title={t("edit.interests", "İlgi alanların")} level={2}>
        <ChipGroup label={t("edit.interests.label", "Sana uyanları seç")} mode="multi">
          {AVAILABLE_INTERESTS.map((item) => {
            const on = details.interests.includes(item.label);
            return (
              <Chip
                key={item.id}
                pressed={on}
                onPress={() =>
                  set(
                    "interests",
                    on
                      ? details.interests.filter((x) => x !== item.label)
                      : [...details.interests, item.label],
                  )
                }
              >
                {t(`edit.interest.${item.id}`, item.label)}
              </Chip>
            );
          })}
        </ChipGroup>
      </Section>

      <Section title={t("edit.links", "Bağlantılar")} level={2}>
        <div className="edit-grid">
          <Field label="Instagram" optionalLabel={t("ui.optional", "isteğe bağlı")}>
            {(ids) => (
              <Input
                {...ids}
                maxLength={60}
                placeholder="@kullanici"
                value={details.instagram}
                onChange={(e) => set("instagram", e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("edit.web", "Web sitesi ya da YouTube")}
            optionalLabel={t("ui.optional", "isteğe bağlı")}
          >
            {(ids) => (
              <Input
                {...ids}
                type="url"
                inputMode="url"
                autoComplete="url"
                maxLength={200}
                placeholder="https://"
                value={details.youtubeOrBlog}
                onChange={(e) => set("youtubeOrBlog", e.target.value)}
              />
            )}
          </Field>
        </div>
      </Section>

      <div className="edit-actions">
        <Button type="submit" size="lg">
          {t("edit.save", "Değişiklikleri kaydet")}
        </Button>
        <Button href="/profile/" variant="ghost" size="lg">
          {t("ui.cancel", "Vazgeç")}
        </Button>
      </div>
    </form>
  );

  const tierLabel: Record<string, [string, string]> = {
    free: ["plan.free", "Gezgin"],
    explorer: ["plan.explorer", "Kaşif"],
    pro: ["plan.pro", "Pro Kaşif"],
    agency: ["plan.agency", "Tur Lideri"],
  };
  const tier = wallet ? (tierLabel[wallet.subscriptionTier] ?? tierLabel.free) : null;
  const walletPending = walletFailed
    ? t("profile.balanceFailed", "Bakiye şu an alınamadı.")
    : t("profile.balanceUnknown", "Bakiye yükleniyor…");

  const billingTab = (
    <div className="edit-stack">
      <Card className="edit-plan">
        <p className="edit-plan__label">{t("edit.plan", "Planın")}</p>
        <p className="edit-plan__value">{tier ? t(...tier) : walletPending}</p>
        <p className="edit-plan__label">{t("profile.balance", "Kredi bakiyen")}</p>
        <p className="edit-plan__value">{wallet ? wallet.credits : walletPending}</p>
        {wallet?.subscriptionRenewsAt && (
          <p className="edit-plan__meta">
            {t("edit.plan.renews", "Yenilenme: {date}").replace(
              "{date}",
              new Date(wallet.subscriptionRenewsAt).toLocaleDateString(),
            )}
          </p>
        )}
        <div className="edit-actions">
          <Button href="/checkout/">{t("profile.balanceCta", "Bakiye ve ödeme")}</Button>
          <Button href="/pricing/" variant="secondary">
            {t("profile.plans", "Planlar ve kredi")}
          </Button>
        </div>
      </Card>
    </div>
  );

  const dangerTab = (
    <Card className="edit-danger">
      <p className="edit-danger__title">
        {t("edit.clear.title", "Bu cihazdaki profil bilgilerini sil")}
      </p>
      <p className="edit-danger__body">
        {t(
          "edit.clear.body",
          "Ad, tanıtım, fotoğraf ve tercihlerin bu tarayıcıdan silinir. Hesabın ve sunucudaki verilerin silinmez; hesabını kapatmak için destek ekibine yaz.",
        )}
      </p>
      <div className="edit-actions">
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          {t("edit.clear.cta", "Cihazdaki bilgileri sil")}
        </Button>
        <Button href="/support/" variant="ghost">
          {t("edit.clear.support", "Destek")}
        </Button>
      </div>
    </Card>
  );

  return (
    <PageShell className="edit-page">
      <PageHeader
        breadcrumb={[
          { label: t("nav.profile", "Profil"), href: "/profile/" },
          { label: t("edit.pageTitle", "Profili düzenle") },
        ]}
      />
      <Tabs
        label={t("edit.tabs", "Profil ayarları")}
        urlParam="tab"
        items={[
          { id: TABS[0], label: t("edit.tab.profile", "Profil"), panel: profileTab },
          {
            id: TABS[1],
            label: t("edit.tab.security", "Güvenlik"),
            panel: (
              <div className="edit-stack">
                <PasswordForm />
                <AIMemorySettings />
              </div>
            ),
          },
          { id: TABS[2], label: t("edit.tab.billing", "Plan ve bakiye"), panel: billingTab },
          { id: TABS[3], label: t("edit.tab.device", "Cihaz verisi"), panel: dangerTab },
        ]}
      />
      <ConfirmDialog
        open={confirmClear}
        title={t("edit.clear.confirmTitle", "Cihazdaki profil bilgileri silinsin mi?")}
        consequence={t(
          "edit.clear.confirmBody",
          "Bu tarayıcıdaki ad, tanıtım, fotoğraf ve tercihler silinir. Hesabın silinmez.",
        )}
        confirmLabel={t("edit.clear.confirm", "Sil")}
        tone="danger"
        onConfirm={async () => {
          userStorage.removeItem("mapsbridge.userProfileDetails");
          userStorage.removeItem("mapsbridge.userAvatar");
          userStorage.removeItem("mapsbridge.userCoverPhoto");
          userStorage.removeItem("mapsbridge.userPreferences");
          window.location.href = "/";
        }}
        onClose={() => setConfirmClear(false)}
      />
    </PageShell>
  );
}

function PasswordForm() {
  const { t } = useLocale();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const valid = PASSWORD_RULES.every(([test]) => test(password));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmError(null);
    if (!valid) {
      setError(t("edit.pw.invalid", "Şifre tüm kuralları karşılamalı."));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t("edit.pw.mismatch", "Şifreler eşleşmiyor."));
      return;
    }
    setBusy(true);
    try {
      await changePasswordDirect(password);
      setPassword("");
      setConfirm("");
      toast.show({ tone: "success", message: t("edit.pw.done", "Şifren güncellendi.") });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("edit.pw.failed", "Şifre güncellenemedi."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t("edit.pw.title", "Şifreyi değiştir")} level={2}>
      <form className="edit-form" onSubmit={submit} noValidate>
        {error && (
          <Alert tone="danger" live="assertive">
            {error}
          </Alert>
        )}
        <Field label={t("edit.pw.new", "Yeni şifre")} required>
          {(ids) => (
            <div className="edit-password">
              <Input
                {...ids}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <IconButton
                icon={show ? "eye-off" : "eye"}
                label={
                  show ? t("edit.pw.hide", "Şifreyi gizle") : t("edit.pw.show", "Şifreyi göster")
                }
                pressed={show}
                onClick={() => setShow((v) => !v)}
              />
            </div>
          )}
        </Field>
        <ul className="edit-rules" aria-label={t("edit.pw.rules", "Şifre kuralları")}>
          {PASSWORD_RULES.map(([test, key, label]) => {
            const ok = test(password);
            return (
              <li key={key} className="edit-rule" data-ok={ok || undefined}>
                <Icon name={ok ? "check" : "minus"} size={16} />
                <span>{t(key, label)}</span>
                <VisuallyHidden>
                  {ok ? t("edit.pw.ok", "karşılandı") : t("edit.pw.missing", "eksik")}
                </VisuallyHidden>
              </li>
            );
          })}
        </ul>
        <Field label={t("edit.pw.confirm", "Yeni şifre (tekrar)")} error={confirmError} required>
          {(ids) => (
            <Input
              {...ids}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        <div className="edit-actions">
          <Button type="submit" loading={busy}>
            {t("edit.pw.submit", "Şifreyi güncelle")}
          </Button>
        </div>
      </form>
    </Section>
  );
}
