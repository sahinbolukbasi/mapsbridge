"use client";
// /profiles/?u=<kullanıcı> (Increment 1.12, bug 7): topluluktaki yazar bağlantılarının hedefi.
// Statik export her kullanıcı için sayfa üretemez; kullanıcı adı sorgudan (useSearchParams değil,
// mount sonrası location.search; G21) okunur ve [username] profil bileşeni yeniden kullanılır.
import { useEffect, useState } from "react";
import PublicProfileClient from "../[username]/public-profile-client";
import { EmptyState, LoadingState, PageHeader, PageShell } from "../components/ui";
import { useLocale } from "../lib/locale-context";
import { normalizeUsername } from "../lib/navigation/profile-href";

export default function ProfilesClient() {
  const { t } = useLocale();
  const [user, setUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setUser(normalizeUsername(new URLSearchParams(window.location.search).get("u")));
  }, []);
  if (user)
    return (
      <PublicProfileClient
        initialUsername={user}
        canonicalPath={`/profiles/?u=${encodeURIComponent(user)}`}
      />
    );
  return (
    <PageShell
      layout="content"
      header={<PageHeader title={t("profiles.title", "Gezgin profili")} />}
    >
      {user === undefined ? (
        <LoadingState label={t("profiles.loading", "Profil yükleniyor…")} />
      ) : (
        <EmptyState
          icon="user"
          title={t("profiles.missing", "Profil bulunamadı")}
          description={t("profiles.missingBody", "Bağlantıdaki kullanıcı adı geçersiz.")}
        />
      )}
    </PageShell>
  );
}
