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
