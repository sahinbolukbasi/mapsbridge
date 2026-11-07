// Derin bağlantılar (K4, Increment 4.7). Saf ayrıştırıcı: RN/Expo bağımlılığı yok (test:
// apps/web/tests/mobile/deep-links.test.cjs). Desteklenen biçimler:
//   https://mapsbridge.com/k/?code=ABC      · mapsbridge://k?code=ABC   (eski ?kod= yalnız okunur)
//   https://mapsbridge.com/traveler/?u=ayse · mapsbridge://traveler?u=ayse
//   https://mapsbridge.com/maps/?tripId=…   · mapsbridge://maps?tripId=…
// Google OAuth dönüşü (id_token/access_token/error) burada ayrıştırılmaz: "oauth" döner ve App'in
// mevcut akışı işler. Başka alan adı ya da bilinmeyen yol null döner (açık yönlendirme yok).
import { readShareCode } from "../share/share-code";

export type DeepLink =
  | { kind: "share"; code: string }
  | { kind: "traveler"; username: string }
  | { kind: "trip"; tripId: string }
  | { kind: "oauth" };

export const APP_SCHEME = "mapsbridge";
const WEB_HOSTS = new Set(["mapsbridge.com", "www.mapsbridge.com"]);
const USERNAME = /^[a-z0-9_.-]{2,40}$/i;
const TRIP_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** URL'yi parçalar (URL sınıfı RN'de sınırlı olabilir; elle ve güvenli). */
function split(
  url: string,
): { scheme: string; host: string; path: string; query: string; hash: string } | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(url.trim());
  if (!m) return null;
  return {
    scheme: m[1].toLowerCase(),
    host: m[2].toLowerCase(),
    path: m[3] || "",
    query: (m[4] || "").slice(1),
    hash: (m[5] || "").slice(1),
  };
}

function param(query: string, name: string): string | null {
  for (const pair of query.split("&")) {
    const [k, v = ""] = pair.split("=");
    if (k !== name) continue;
    try {
      return decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      return null;
    }
  }
  return null;
}

export function parseDeepLink(url: string | null | undefined): DeepLink | null {
  if (!url) return null;
  const parts = split(url);
  if (!parts) return null;
  const { scheme, host, query, hash } = parts;
  let route: string;
  if (scheme === APP_SCHEME) {
    // mapsbridge://k?code= → host "k"; mapsbridge:///k?code= → yol "/k".
    route = (host || parts.path.replace(/^\/+/, "").split("/")[0] || "").toLowerCase();
  } else if ((scheme === "https" || scheme === "http") && WEB_HOSTS.has(host)) {
    route = parts.path.replace(/^\/+/, "").split("/")[0].toLowerCase();
  } else {
    return null;
  }
  if (
    /(^|&)(id_token|access_token|error)=/.test(hash) ||
    /(^|&)(id_token|access_token|error)=/.test(query)
  )
    return route === "auth" || route === "" || scheme === APP_SCHEME ? { kind: "oauth" } : null;
  if (route === "auth") return { kind: "oauth" };
  if (route === "k") {
    const code = readShareCode(param(query, "code") ?? param(query, "kod"));
    return code ? { kind: "share", code } : null;
  }
  if (route === "traveler") {
    const u = (param(query, "u") ?? "").replace(/^@/, "").trim();
    return USERNAME.test(u) ? { kind: "traveler", username: u.toLowerCase() } : null;
  }
  if (route === "maps") {
    const id = (param(query, "tripId") ?? "").trim();
    return TRIP_ID.test(id) ? { kind: "trip", tripId: id } : null;
  }
  return null;
}
