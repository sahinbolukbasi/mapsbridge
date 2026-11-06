// Topluluk gönderileri: uygulama katmanı (Increment 1.13, M3). AWS SDK YOK; doğrulama, PII
// maskeleme (I5 guardrail), yetki ve yanıt biçimi burada. Kalıcılık community.repo.ts'te.
import { maskPII } from "../../../../services/ai-assistant/src/domain/guardrails";

export const LIMITS = {
  content: 1000,
  category: 40,
  location: 120,
  hashtags: 10,
  hashtag: 40,
  displayName: 60,
  routeTitle: 120,
  routeStops: 50,
  pageSize: 20,
} as const;

export type LinkedRoute = {
  title: string;
  destination: string;
  stopCount: number;
  stops: { label: string; lat: number; lng: number; address?: string; category?: string }[];
};
export type PostRecord = {
  id: string;
  authorSub: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
  content: string;
  category: string;
  locationTag?: string;
  hashtags: string[];
  image?: string;
  linkedRoute?: LinkedRoute;
  likesCount: number;
  savesCount: number;
  createdAt: string;
};
export type PostInput = Pick<
  PostRecord,
  "content" | "category" | "locationTag" | "hashtags" | "image" | "linkedRoute"
>;

export class CommunityError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "CommunityError";
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = stripTags(v);
  return s ? s.slice(0, max) : undefined;
};

/** Metin: etiket temizliği + PII maskeleme (e-posta, kart, TCKN, telefon…). */
export function cleanText(text: string): string {
  return maskPII(stripTags(text)).maskedText;
}

/** Görsel yalnız kendi medya alanımızdan (MEDIA_PUBLIC_BASE_URL önekli https). */
export function isAllowedImage(url: unknown, base = process.env.MEDIA_PUBLIC_BASE_URL): boolean {
  if (typeof url !== "string" || !base) return false;
  const prefix = base.replace(/\/+$/, "") + "/";
  return url.startsWith("https://") && url.startsWith(prefix) && url.length <= 600;
}

function cleanRoute(raw: unknown): LinkedRoute | undefined {
  if (!isRecord(raw)) return undefined;
  const title = str(raw.title, LIMITS.routeTitle);
  if (!title) return undefined;
  const stops = (Array.isArray(raw.stops) ? raw.stops : [])
    .slice(0, LIMITS.routeStops)
    .filter(isRecord)
    .map((s) => ({
      label: str(s.label, 120) ?? "",
      lat: Number(s.lat),
      lng: Number(s.lng),
      ...(str(s.address, 200) ? { address: str(s.address, 200) } : {}),
      ...(str(s.category, 40) ? { category: str(s.category, 40) } : {}),
    }))
    .filter(
      (s) =>
        s.label &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        Math.abs(s.lat) <= 90 &&
        Math.abs(s.lng) <= 180,
    );
  return { title, destination: str(raw.destination, 120) ?? "", stopCount: stops.length, stops };
}

/** Gönderi girdisi; `partial` iken yalnız gönderilen alanlar. Geçersizse CommunityError(400). */
export function validatePostInput(raw: unknown, partial = false): Partial<PostInput> {
  if (!isRecord(raw)) throw new CommunityError(400, "Geçersiz istek.");
  const out: Partial<PostInput> = {};
  if (!partial || raw.content !== undefined) {
    if (typeof raw.content !== "string" || !stripTags(raw.content))
      throw new CommunityError(400, "Paylaşım metni boş olamaz.");
    if (raw.content.length > LIMITS.content)
      throw new CommunityError(400, "Paylaşım metni en fazla 1000 karakter olabilir.");
    out.content = cleanText(raw.content);
  }
  if (!partial || raw.category !== undefined)
    out.category = str(raw.category, LIMITS.category) ?? "Genel";
  if (raw.locationTag !== undefined) {
    const loc = str(raw.locationTag, LIMITS.location);
    out.locationTag = loc ? cleanText(loc) : undefined;
  }
  if (!partial || raw.hashtags !== undefined) {
    const tags = Array.isArray(raw.hashtags) ? raw.hashtags : [];
    out.hashtags = [
      ...new Set(
        tags
          .map((t) => str(t, LIMITS.hashtag))
          .filter((t): t is string => !!t && /^#[\p{L}\p{N}_]+$/u.test(t)),
      ),
    ].slice(0, LIMITS.hashtags);
  }
  if (raw.image !== undefined && raw.image !== null && raw.image !== "") {
    if (!isAllowedImage(raw.image))
      throw new CommunityError(400, "Görsel yalnız MapsBridge medya yüklemesinden eklenebilir.");
    out.image = raw.image as string;
  } else if (partial && (raw.image === null || raw.image === "")) out.image = undefined;
  if (raw.linkedRoute !== undefined) out.linkedRoute = cleanRoute(raw.linkedRoute);
  return out;
}

/** Yazar kimliği sunucuda: yayınlanmış profil kullanıcı adı ya da e-posta öneki (istemci değil). */
export function authorIdentity(
  reservedUsername: string | undefined,
  email: string | undefined,
  displayName: unknown,
): { username: string; displayName: string } {
  const handle = (email?.split("@")[0] || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const username = (reservedUsername || handle || "gezgin").slice(0, 40);
  const name = str(displayName, LIMITS.displayName);
  return { username, displayName: name ? cleanText(name) : username };
}

export function assertOwner(post: PostRecord | null, sub: string): PostRecord {
  if (!post) throw new CommunityError(404, "Paylaşım bulunamadı.");
  if (post.authorSub !== sub) throw new CommunityError(403, "Bu paylaşım sana ait değil.");
  return post;
}

/** İstemci CommunityPost biçimi; authorSub dışarı verilmez. */
export function toPublicPost(
  p: PostRecord,
  viewer?: { liked: boolean; saved: boolean },
): Record<string, unknown> {
  const { authorSub: _sub, ...rest } = p;
  return {
    ...rest,
    tags: p.hashtags,
    comments: [],
    likedByMe: viewer?.liked ?? false,
    savedByMe: viewer?.saved ?? false,
  };
}

/** Sayfalama imleci: DynamoDB LastEvaluatedKey ↔ base64url. Bozuksa yok sayılır. */
export function encodeCursor(key: Record<string, unknown> | undefined): string | undefined {
  return key ? Buffer.from(JSON.stringify(key)).toString("base64url") : undefined;
}
export function decodeCursor(raw: string | undefined): Record<string, string> | undefined {
  if (!raw || raw.length > 400) return undefined;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return isRecord(v) && typeof v.PK === "string" && typeof v.SK === "string"
      ? { PK: v.PK, SK: v.SK }
      : undefined;
  } catch {
    return undefined;
  }
}
