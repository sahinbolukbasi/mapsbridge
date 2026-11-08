// Topluluk akışı süzme/sıralama (design F17). Saf modül; yalnızca koddaki gerçek modlar:
// "latest" (eski "güncel"/"Yeni" sıralaması), "popular" (beğeniye göre), "following" (takip
// edilenler). "Yakınımda" kodda hiçbir zaman süzme yapmadığı için mod olarak sunulmaz (I10).

export const FEED_MODES = ["latest", "popular", "following"] as const;
export type FeedMode = (typeof FEED_MODES)[number];

/** Gönderilerin `category` alanındaki değerler (mevcut veri; kimlik = Türkçe değer). */
export const FEED_CATEGORIES = [
  "all",
  "Tarih & Kültür",
  "Gastronomi",
  "Doğa & Vadi",
  "Fotoğrafçılık",
  "Sırt Çantalı",
] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

/** Kategori etiketi için i18n anahtarı (değer Türkçe kimliktir, EN çevirisi locales'te). */
export const CATEGORY_LABEL_KEY: Record<FeedCategory, string> = {
  all: "community.category.all",
  "Tarih & Kültür": "community.category.history",
  Gastronomi: "community.category.food",
  "Doğa & Vadi": "community.category.nature",
  Fotoğrafçılık: "community.category.photo",
  "Sırt Çantalı": "community.category.backpack",
};

type FeedPost = {
  id: string;
  authorUsername: string;
  category?: string;
  tags?: string[];
  hashtags?: string[];
  likesCount: number;
};

/** Sunucuda kimliği olmayan (yalnız yerel) gönderi kimliği. */
export const isLocalPostId = (id: string) => id.startsWith("post-");
/** Profil sayfası "Daha fazla" adımı. */
export const PROFILE_POSTS_PAGE = 12;
/**
 * Uç henüz yok (API Gateway 404) mu? review-final #2: route eksikliği hata değil, boş sunucu
 * listesidir; gerçek 5xx/ağ hataları ErrorState'e gider.
 */
export function isMissingRoute(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { status?: unknown }).status === 404;
}
type ProfilePost = { id: string; authorUsername: string; deviceOnly?: boolean };
/**
 * Profil gönderileri: sunucu listesinin yalnız bu yazara ait olanları. Sahibin kendi profilinde
 * cihazdaki, sunucuda olmayan gönderileri (deviceOnly ya da yerel kimlikli; akışla aynı kural)
 * "Yalnız bu cihazda" işaretli olarak başa eklenir. Ziyaretçide yerel gönderi eklenmez.
 */
export function profilePosts<T extends ProfilePost>(
  server: readonly T[],
  local: readonly T[],
  username: string,
  own: boolean,
): T[] {
  const mine = server.filter((p) => sameUser(p.authorUsername, username));
  if (!own) return mine;
  const ids = new Set(mine.map((p) => p.id));
  const deviceOnly = local
    .filter(
      (p) =>
        sameUser(p.authorUsername, username) &&
        !ids.has(p.id) &&
        (p.deviceOnly || isLocalPostId(p.id)),
    )
    .map((p) => ({ ...p, deviceOnly: true }));
  return [...deviceOnly, ...mine];
}
/** Sonraki sunucu sayfası mevcut listeye eklenir; aynı kimlik iki kez görünmez. */
export function appendPostPage<T extends { id: string }>(
  list: readonly T[],
  page: readonly T[],
): T[] {
  const ids = new Set(list.map((p) => p.id));
  return [...list, ...page.filter((p) => !ids.has(p.id))];
}
/** "Daha fazla" gösterilir mi: yüklenmiş ama gizli gönderi ya da sunucuda sonraki sayfa var. */
export function canShowMorePosts(total: number, visible: number, cursor?: string): boolean {
  return total > visible || Boolean(cursor);
}
/** "@elif" ile "Elif" aynı kullanıcıdır. */
export function sameUser(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

function matchesCategory(post: FeedPost, category: FeedCategory): boolean {
  if (category === "all") return true;
  const c = category.toLowerCase();
  return (
    post.category?.toLowerCase() === c ||
    (post.tags ?? []).some((t) => t.toLowerCase().includes(c)) ||
    (post.hashtags ?? []).some((h) => h.toLowerCase().includes(c))
  );
}

/** Süzer ve sıralar; girdi dizisini değiştirmez. */
export function filterFeed<T extends FeedPost>(
  posts: readonly T[],
  opts: { mode: FeedMode; category: FeedCategory; followed: readonly string[] },
): T[] {
  let list = posts.filter((p) => matchesCategory(p, opts.category));
  if (opts.mode === "following") {
    list = list.filter((p) => opts.followed.some((u) => sameUser(u, p.authorUsername)));
  }
  const sorted = [...list];
  if (opts.mode === "popular") sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
  else sorted.sort((a, b) => b.id.localeCompare(a.id));
  return sorted;
}

/** Paylaşım metnindeki #etiketler (yoksa boş; varsayılan etiket uydurulmaz). */
export function extractHashtags(content: string): string[] {
  return Array.from(new Set(content.match(/#[\p{L}\p{N}_]+/gu) ?? []));
}
