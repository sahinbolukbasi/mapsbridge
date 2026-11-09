import { API_ENDPOINT } from "./api";
import { getStoredSession } from "./cognito";
import { userStorage } from "./user-storage";

export async function publishProfile(username: string, unpublish = false) {
  const session = getStoredSession();
  if (!session?.token) throw new Error("Lütfen giriş yapın.");
  const details = JSON.parse(userStorage.getItem("mapsbridge.userProfileDetails") || "{}");
  const groups: string[] = JSON.parse(userStorage.getItem("mapsbridge.publicRoutes") || "[]");
  const stops: Array<{ group?: string }> = JSON.parse(
    userStorage.getItem("mapsbridge.savedAddresses") || "[]",
  );
  const response = await fetch(`${API_ENDPOINT}/profile/${unpublish ? "unpublish" : "publish"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      username,
      profile: {
        firstName: details.firstName || "Gezgin",
        lastName: details.lastName || "",
        visitedCountries: details.visitedCountries || [],
        routes: groups.map((name) => ({
          name,
          stops: stops.filter((stop) => (stop.group || "Genel") === name),
        })),
      },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Profil kaydedilemedi.");
  return `${window.location.origin}/u/?username=${encodeURIComponent(username)}`;
}

// G18 publish ZAMANLAMASI: kayıt anında token YOK; seçilen kullanıcı adı
// `mapsbridge.userProfileDetails`'te saklanır ve kullanıcı DOĞRULAYIP GİRİNCE burada
// yayınlanır. En iyi çaba — girişi bloklamaz. Token yoksa sessizce atlar.
export async function publishPendingUsername(): Promise<void> {
  const session = getStoredSession();
  if (!session?.token) return;
  let username = "";
  try {
    username = JSON.parse(userStorage.getItem("mapsbridge.userProfileDetails") || "{}").username || "";
  } catch {
    username = "";
  }
  if (!/^[a-z0-9_.-]{1,40}$/.test(username)) return;
  try {
    await publishProfile(username);
  } catch {
    // yayın başarısızsa girişe dokunma; kullanıcı adı yerelde saklı kalır
  }
}
