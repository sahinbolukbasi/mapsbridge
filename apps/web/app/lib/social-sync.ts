/**
 * MapsBridge Web Social & Profile Synchronization Module
 * Ensures real-time state synchronization between Profile, Community feed,
 * and Mobile API across the platform.
 */

import { userStorage } from "./user-storage";
import { apiFetch } from "./api-client";
import type { CommunityPost } from "../features/community/types";

export interface WebUserProfile {
  fullName: string;
  username: string;
  email: string;
  travelTitle: string;
  bio: string;
  location: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  followersCount: number;
  followingCount: number;
  routesCount: number;
  stopsCount: number;
  verified: boolean;
}

const STORAGE_POSTS_KEY = "mapsbridge.communityPosts";
/** Sunucu senkronu (Increment 1.13): GET en sık 30 sn'de bir; 404/ağ hatası yerel kayda düşer. */
const REFRESH_MIN_MS = 30_000;
let lastRefresh = 0;
/** Sunucuda kimliği olmayan (yalnız yerel) gönderi kimliği. */
export const isLocalPostId = (id: string) => id.startsWith("post-");
/**
 * Sunucu akışı + yalnız bu cihazdaki gönderiler (deviceOnly ya da yerel kimlikli) birleşir;
 * sunucu yanıtı yerel taslakları silmez.
 */
export function mergeServerPosts(
  server: readonly CommunityPost[],
  local: readonly CommunityPost[],
): CommunityPost[] {
  const ids = new Set(server.map((p) => p.id));
  const localOnly = local.filter((p) => !ids.has(p.id) && (p.deviceOnly || isLocalPostId(p.id)));
  return [...localOnly, ...server];
}
const syncWarn = (what: string) => (e: unknown) =>
  console.warn(`[webSocialSync] ${what} sunucuya yazılamadı; yerel kayıt korunuyor:`, e);
const STORAGE_PROFILE_KEY = "mapsbridge.userProfileDetails";
const STORAGE_AVATAR_KEY = "mapsbridge.userAvatar";
const STORAGE_COVER_KEY = "mapsbridge.userCoverPhoto";

export function sanitizeInput(val?: string | null): string {
  if (!val) return "";
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

type StoredDetails = Record<string, unknown>;

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Bu hesabın cihazdaki profil ayrıntıları (yoksa boş obje). */
function readStoredDetails(): StoredDetails {
  try {
    const raw = userStorage.getItem(STORAGE_PROFILE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as StoredDetails;
    }
  } catch {}
  return {};
}

/** Oturumdaki e-posta (user-storage'ın hesap sahibi anahtarıyla aynı kaynak). */
function sessionEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem("mapsbridge.userEmail") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Hesabın görünen adı ve kullanıcı adı: önce kayıtlı profil ayrıntıları, yoksa oturum e-postasının
 * öneki. Uydurma varsayılan ad yoktur (I1); /profile/ ve topluluk aynı kimliği kullanır.
 */
export function deriveIdentity(
  email: string,
  details: StoredDetails | null,
): { fullName: string; username: string } {
  const d = details ?? {};
  const prefix = (email.split("@")[0] || "").trim();
  const handle = prefix.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const named = text(d.fullName).trim() || `${text(d.firstName)} ${text(d.lastName)}`.trim() || "";
  return {
    fullName: named || (prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : ""),
    username: text(d.username).trim() || handle,
  };
}

export const webSocialSync = {
  // ─── Profile Sync ──────────────────────────────────────────────────────────
  /**
   * Profil yalnızca hesap/cihaz verisinden okunur; boş alanlar boş kalır. Sayaçlar ve "onaylı"
   * bilgisi sunucudan gelmediği için 0/false döner (uydurma sayı yok, I1/F2).
   */
  getProfile(): WebUserProfile {
    const d = readStoredDetails();
    const email = sessionEmail() || text(d.email);
    const { fullName, username } = deriveIdentity(email, d);
    const avatarUrl = userStorage.getItem(STORAGE_AVATAR_KEY) || "";
    const coverPhotoUrl = userStorage.getItem(STORAGE_COVER_KEY) || "";

    return {
      fullName,
      username,
      email,
      travelTitle: text(d.travelTitle),
      bio: text(d.bio),
      location: text(d.location),
      avatarUrl: avatarUrl || undefined,
      coverPhotoUrl: coverPhotoUrl || undefined,
      followersCount: 0,
      followingCount: 0,
      routesCount: 0,
      stopsCount: 0,
      verified: false,
    };
  },

  /**
   * Yalnızca verilen alanlar kayıtlı ayrıntıların ÜZERİNE yazılır; diller, ilgi alanları,
   * bağlantılar ve eski alanlar korunur. Hesaplanan alanlar (sayaçlar, e-posta) kaydedilmez.
   */
  updateProfile(updates: Partial<WebUserProfile>): WebUserProfile {
    const { avatarUrl, coverPhotoUrl, ...fields } = updates;
    userStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify({ ...readStoredDetails(), ...fields }));
    if (avatarUrl) {
      userStorage.setItem(STORAGE_AVATAR_KEY, avatarUrl);
    }
    if (coverPhotoUrl) {
      userStorage.setItem(STORAGE_COVER_KEY, coverPhotoUrl);
    }
    const updated = this.getProfile();

    // Also cascade author updates to user's posts
    this.cascadeAuthorToPosts(updated.fullName, updated.username, updated.avatarUrl);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapsbridge:profile_updated", { detail: updated }));
    }

    return updated;
  },

  cascadeAuthorToPosts(name: string, username: string, avatarUrl?: string) {
    try {
      const posts = this.getPosts();
      let modified = false;
      const updatedPosts = posts.map((p) => {
        if (p.authorUsername === username || p.authorDisplayName === name) {
          modified = true;
          return {
            ...p,
            authorDisplayName: name,
            authorUsername: username,
            authorAvatar: avatarUrl || p.authorAvatar,
          };
        }
        return p;
      });

      if (modified) {
        userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(updatedPosts));
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("mapsbridge:posts_updated", { detail: updatedPosts }),
          );
        }
      }
    } catch {}
  },

  // ─── Posts Sync ────────────────────────────────────────────────────────────
  getPosts(): CommunityPost[] {
    // 1. Trigger background fetch from backend API
    this.refreshPostsFromBackend();

    // 2. Return cached posts from local storage for instant offline-first render
    try {
      const raw = userStorage.getItem(STORAGE_POSTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}

    return [];
  },

  async refreshPostsFromBackend(): Promise<CommunityPost[]> {
    if (typeof window === "undefined") return [];
    if (Date.now() - lastRefresh < REFRESH_MIN_MS) return [];
    lastRefresh = Date.now();
    try {
      const data = await apiFetch<{ success?: boolean; posts?: CommunityPost[] }>(
        "/community/posts",
        { timeoutMs: 8000, skipAuth: !this.hasSession() },
      );
      if (data?.success && Array.isArray(data.posts)) {
        const merged = mergeServerPosts(data.posts, this.readLocalPosts());
        userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: merged }));
        return merged;
      }
    } catch (e) {
      console.warn("[webSocialSync] Topluluk akışı alınamadı, yerel kayıt kullanılıyor:", e);
    }
    return [];
  },

  hasSession(): boolean {
    try {
      return Boolean(
        localStorage.getItem("mapsbridge.accessToken") ||
        localStorage.getItem("mapsbridge.idToken"),
      );
    } catch {
      return false;
    }
  },

  readLocalPosts(): CommunityPost[] {
    try {
      const raw = userStorage.getItem(STORAGE_POSTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as CommunityPost[]) : [];
    } catch {
      return [];
    }
  },

  /** Yerel gönderinin kaydını günceller (sunucu kimliği / deviceOnly) ve yayınlar. */
  patchLocalPost(id: string, patch: Partial<CommunityPost>) {
    const next = this.readLocalPosts().map((p) => (p.id === id ? { ...p, ...patch } : p));
    userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(next));
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: next }));
  },

  createPost(data: {
    content: string;
    photo?: string | null;
    category?: string;
    locationTag?: string;
    hashtags?: string[];
    linkedRoute?: CommunityPost["linkedRoute"];
  }): CommunityPost {
    const profile = this.getProfile();
    const posts = this.getPosts();

    const cleanContent = sanitizeInput(data.content);
    const cleanCategory = sanitizeInput(data.category) || "Tarih & Kültür";
    // Konum, avatar ve etiket yalnızca kullanıcının verdiğinden; varsayılan uydurulmaz (I1).
    const cleanLocation = sanitizeInput(data.locationTag) || undefined;
    const cleanHashtags = (data.hashtags || []).map((t) => sanitizeInput(t));

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      authorDisplayName: profile.fullName || profile.username,
      authorUsername: profile.username,
      authorAvatar: profile.avatarUrl,
      createdAt: "Şimdi",
      category: cleanCategory,
      content: cleanContent,
      hashtags: cleanHashtags,
      image: data.photo || undefined,
      locationTag: cleanLocation,
      linkedRoute: data.linkedRoute,
      likesCount: 0,
      savesCount: 0,
      viewsCount: 1,
      likedByMe: false,
      tags: cleanHashtags,
      comments: [],
    };

    // Optimistic local update
    const nextPosts = [newPost, ...posts];
    userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));

      // Sunucu senkronu (Increment 1.13): başarıda yerel kimlik sunucu kimliğiyle değişir;
      // 404/ağ hatasında gönderi "Yalnız bu cihazda" işaretlenir (dürüstlük).
      const localId = newPost.id;
      const deviceImage = typeof data.photo === "string" && data.photo.startsWith("data:");
      apiFetch<{ post?: CommunityPost }>("/community/posts", {
        method: "POST",
        timeoutMs: 10000,
        body: JSON.stringify({
          content: cleanContent,
          displayName: profile.fullName,
          category: cleanCategory,
          locationTag: cleanLocation,
          hashtags: cleanHashtags,
          // Cihaz-yerel görsel sunucuya gönderilmez (yalnız medya alanı kabul edilir).
          image: deviceImage ? undefined : data.photo || undefined,
          linkedRoute: data.linkedRoute,
        }),
      })
        .then((res) => {
          if (res?.post?.id)
            this.patchLocalPost(localId, {
              id: res.post.id,
              deviceOnly: deviceImage || undefined,
            });
          else this.patchLocalPost(localId, { deviceOnly: true });
        })
        .catch((e) => {
          syncWarn("Paylaşım")(e);
          this.patchLocalPost(localId, { deviceOnly: true });
        });
    }

    return newPost;
  },

  editPost(
    postId: string,
    updates: {
      content?: string;
      category?: string;
      locationTag?: string;
      hashtags?: string[];
      image?: string | null;
      linkedRoute?: CommunityPost["linkedRoute"];
    },
  ): CommunityPost | null {
    const posts = this.getPosts();
    const profile = this.getProfile();
    const target = posts.find((p) => p.id === postId);
    if (!target) return null;

    // Authorization: only the author or owner can edit
    const isOwner =
      target.authorUsername === profile.username ||
      target.authorDisplayName.toLowerCase() === profile.fullName.toLowerCase() ||
      target.authorUsername === "gezgin" ||
      false;
    if (!isOwner) return null;

    let updated: CommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        updated = {
          ...post,
          ...(updates.content !== undefined ? { content: sanitizeInput(updates.content) } : {}),
          ...(updates.category !== undefined ? { category: sanitizeInput(updates.category) } : {}),
          ...(updates.locationTag !== undefined
            ? { locationTag: sanitizeInput(updates.locationTag) }
            : {}),
          ...(updates.hashtags !== undefined
            ? { hashtags: updates.hashtags.map((h) => sanitizeInput(h)) }
            : {}),
          ...(updates.image !== undefined ? { image: updates.image || undefined } : {}),
          ...(updates.linkedRoute !== undefined ? { linkedRoute: updates.linkedRoute } : {}),
        };
        return updated;
      }
      return post;
    });

    if (updated) {
      userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
        if (!isLocalPostId(postId))
          apiFetch(`/community/posts/${encodeURIComponent(postId)}`, {
            method: "PUT",
            body: JSON.stringify(updates),
          }).catch(syncWarn("Düzenleme"));
      }
    }

    return updated;
  },

  deletePost(postId: string): boolean {
    const posts = this.getPosts();
    const profile = this.getProfile();
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    // Authorization: only author or owner can delete
    const isOwner =
      target.authorUsername === profile.username ||
      target.authorDisplayName.toLowerCase() === profile.fullName.toLowerCase() ||
      target.authorUsername === "gezgin" ||
      false;
    if (!isOwner) return false;

    const nextPosts = posts.filter((p) => p.id !== postId);
    userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
      if (!isLocalPostId(postId))
        apiFetch(`/community/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }).catch(
          syncWarn("Silme"),
        );
    }

    return true;
  },

  toggleLike(postId: string): CommunityPost | null {
    const posts = this.getPosts();
    let updated: CommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const nextLiked = !post.likedByMe;
        updated = {
          ...post,
          likedByMe: nextLiked,
          likesCount: nextLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
        };
        return updated;
      }
      return post;
    });

    if (updated) {
      userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
        const liked = (updated as CommunityPost | null)?.likedByMe ?? false;
        if (!isLocalPostId(postId))
          apiFetch(`/community/posts/${encodeURIComponent(postId)}/like`, {
            method: "POST",
            body: JSON.stringify({ on: liked }),
          }).catch(syncWarn("Beğeni"));
      }
    }

    return updated;
  },

  toggleBookmark(postId: string): CommunityPost | null {
    const posts = this.getPosts();
    let updated: CommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const nextSaved = !post.savedByMe;
        updated = {
          ...post,
          savedByMe: nextSaved,
          savesCount: nextSaved
            ? (post.savesCount || 0) + 1
            : Math.max(0, (post.savesCount || 0) - 1),
        };
        return updated;
      }
      return post;
    });

    if (updated) {
      userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
        const saved = Boolean((updated as CommunityPost | null)?.savedByMe);
        if (!isLocalPostId(postId))
          apiFetch(`/community/posts/${encodeURIComponent(postId)}/bookmark`, {
            method: "POST",
            body: JSON.stringify({ on: saved }),
          }).catch(syncWarn("Kaydetme"));
      }
    }

    return updated;
  },

  retweet(postId: string): CommunityPost | null {
    const posts = this.getPosts();
    let updated: CommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const nextReposted = !post.repostedByMe;
        updated = {
          ...post,
          repostedByMe: nextReposted,
          repostCount: nextReposted
            ? (post.repostCount || 0) + 1
            : Math.max(0, (post.repostCount || 0) - 1),
        };
        return updated;
      }
      return post;
    });

    if (updated) {
      userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
        // Yeniden paylaşımın sunucu ucu yok (Increment 1.13 kapsamı dışı): yalnız yerel.
      }
    }

    return updated;
  },

  addComment(postId: string, text: string): void {
    const profile = this.getProfile();
    const posts = this.getPosts();

    const newC = {
      id: `c-${Date.now()}`,
      authorUsername: profile.username,
      username: profile.username,
      displayName: profile.fullName,
      content: text.trim(),
      text: text.trim(),
      createdAt: "Şimdi",
      time: "Şimdi",
    };

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const comments = post.comments || [];
        return {
          ...post,
          comments: [...comments, newC],
        };
      }
      return post;
    });

    userStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mapsbridge:posts_updated", { detail: nextPosts }));
      // Yorumun sunucu ucu yok (Increment 1.13 kapsamı dışı): yalnız yerel.
    }
  },

  subscribePosts(callback: (posts: CommunityPost[]) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: Event) => {
      const custom = e as CustomEvent<CommunityPost[]>;
      if (custom.detail) {
        callback(custom.detail);
      } else {
        callback(this.getPosts());
      }
    };
    window.addEventListener("mapsbridge:posts_updated", handler);
    return () => window.removeEventListener("mapsbridge:posts_updated", handler);
  },

  subscribeProfile(callback: (profile: WebUserProfile) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: Event) => {
      const custom = e as CustomEvent<WebUserProfile>;
      if (custom.detail) {
        callback(custom.detail);
      } else {
        callback(this.getProfile());
      }
    };
    window.addEventListener("mapsbridge:profile_updated", handler);
    return () => window.removeEventListener("mapsbridge:profile_updated", handler);
  },
};
