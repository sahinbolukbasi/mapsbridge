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
