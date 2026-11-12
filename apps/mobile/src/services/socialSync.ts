import { storage } from "./storage";
import { API_BASE, authService, RouteStop } from "./api";
import { stripLegacyProfileDefaults } from "../profile/legacy-defaults";

export interface MobileUserProfile {
  fullName: string;
  username: string;
  email: string;
  travelTitle: string;
  bio: string;
  location: string;
  avatarUrl?: string;
  followersCount: number;
  followingCount: number;
  routesCount: number;
  stopsCount: number;
  verified: boolean;
}

export interface MobileCommunityComment {
  id: string;
  user: string;
  displayName?: string;
  text: string;
  time: string;
  /** G8: cihaz konumundan türetilen yer etiketi (varsa). KVKK: tek seferlik, saklanmaz. */
  location?: string;
  /** G8: gerçek zaman damgası (ISO); `time` bundan biçimlenir. */
  createdAt?: string;
}

export interface MobileCommunityPost {
  /** Sunucuya yazılamadı (ya da görsel cihaz-yerel): kartta "Yalnız bu cihazda" rozeti. */
  deviceOnly?: boolean;
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorEmail?: string;
  verified?: boolean;
  timeAgo: string;
  content: string;
  hashtags: string[];
  locationTag?: string;
  mediaImage?: string;
  routeAttachment?: {
    id: string;
    title: string;
    stats: string;
    icon: string;
    stops: RouteStop[];
  };
  commentsCount: number;
  retweetsCount: number;
  likesCount: number;
  bookmarksCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  comments?: MobileCommunityComment[];
  createdAtMs: number;
}

const STORAGE_KEY_PROFILE = "mb_user_profile";
const STORAGE_KEY_POSTS = "mb_community_posts";

interface RawServerStop {
  id?: string;
  label?: string;
  name?: string;
  lat?: number;
  lng?: number;
  category?: string;
  address?: string;
}

interface RawServerComment {
  id?: string;
  username?: string;
  displayName?: string;
  text?: string;
  content?: string;
  createdAt?: string;
  time?: string;
}

interface RawServerPost {
  id?: string;
  authorDisplayName?: string;
  authorUsername: string;
  authorAvatar?: string;
  authorEmail?: string;
  verified?: boolean;
  createdAt?: string;
  content?: string;
  hashtags?: string[];
  tags?: string[];
  locationTag?: string;
  image?: string;
  mediaImage?: string;
  linkedRoute?: {
    id?: string;
    title?: string;
    stopCount?: number;
    stops?: RawServerStop[];
  };
  comments?: RawServerComment[];
  commentsCount?: number;
  repostCount?: number;
  retweetsCount?: number;
  likesCount?: number;
  savesCount?: number;
  bookmarksCount?: number;
  likedByMe?: boolean;
  savedByMe?: boolean;
  createdAtMs?: number;
}

// FEAT-012 (FEAT-009 kuralı): stok avatar, varsayılan "onaylı" rozeti, uydurma unvan/tanıtım/konum
// ve takipçi sayıları kullanılmaz. Görsel yoksa arayüz ad baş harflerini çizer; konum yoksa yazılmaz.
const DEFAULT_AVATAR = "";

// Topluluk uçları (Increment 4.4, web social-sync ile aynı): canlı API `/community/posts`
// (infra-changes.md §1.13). Eski geliştirme sunucusu adresi canlı cihazda hiç
// çalışmıyordu. Oturum belirteci Authorization başlığında; kimlik sunucuda doğrulanır (istemci
// beyanı X-User-Identity kaldırıldı). Hata/404'te gönderi cihazda kalır ve "Yalnız bu cihazda".
const COMMUNITY_TIMEOUT_MS = 10000;
async function communityFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = await authService.getSession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COMMUNITY_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...((init.headers as Record<string, string>) || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
const isLocalPostId = (id: string) => id.startsWith("post-");
/** Sunucu akışı + yalnız bu cihazdaki gönderiler (web mergePosts ile aynı kural). */
export function mergePosts(
  server: MobileCommunityPost[],
  local: MobileCommunityPost[],
): MobileCommunityPost[] {
  const ids = new Set(server.map((p) => p.id));
  const localOnly = local.filter((p) => !ids.has(p.id) && (p.deviceOnly || isLocalPostId(p.id)));
  return [...localOnly, ...server];
}
/** Cihaz-yerel görsel (file:// ya da data:) sunucuya gönderilmez. */
export const isDeviceImage = (uri: string | undefined) =>
  !!uri && (uri.startsWith("file:") || uri.startsWith("data:") || uri.startsWith("ph:"));

type PostListener = (posts: MobileCommunityPost[]) => void;
type ProfileListener = (profile: MobileUserProfile) => void;

function sanitizeText(val?: string | null): string {
  if (!val) return "";
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function mapServerPostToMobile(post: RawServerPost): MobileCommunityPost {
  return {
    id: post.id || "",
    authorName: post.authorDisplayName || post.authorUsername || "Gezgin",
    authorHandle: post.authorUsername.startsWith("@")
      ? post.authorUsername
      : `@${post.authorUsername}`,
    authorAvatar: post.authorAvatar || DEFAULT_AVATAR,
    authorEmail: post.authorEmail,
    verified: post.verified ?? false,
    timeAgo: post.createdAt
      ? new Date(post.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
      : "Az önce",
    content: post.content || "",
    hashtags: post.hashtags || post.tags || [],
    locationTag: post.locationTag,
    mediaImage: post.image || post.mediaImage,
    routeAttachment: post.linkedRoute
      ? {
          id: post.linkedRoute.id || `rt-${post.id}`,
          title: post.linkedRoute.title || "Ekli Rota",
          stats: `${post.linkedRoute.stopCount || post.linkedRoute.stops?.length || 0} Durak`,
          icon: "🗺️",
          stops: (post.linkedRoute.stops || []).map((s, idx) => ({
            id: s.id || `stop-${idx}`,
            name: s.label || s.name || `Durak ${idx + 1}`,
            lat: s.lat || 0,
            lng: s.lng || 0,
            category: s.category || "Gezi",
            address: s.address || "",
          })),
        }
      : undefined,
    commentsCount: post.comments?.length || post.commentsCount || 0,
    retweetsCount: post.repostCount || post.retweetsCount || 0,
    likesCount: post.likesCount || 0,
    bookmarksCount: post.savesCount || post.bookmarksCount || 0,
    isLiked: !!post.likedByMe,
    isBookmarked: !!post.savedByMe,
    comments: (post.comments || []).map((c) => ({
      id: c.id || "",
      user: c.username?.startsWith("@") ? c.username : `@${c.username || "gezgin"}`,
      displayName: c.displayName || "",
      text: c.text || c.content || "",
      time: c.createdAt || c.time || "Az önce",
    })),
    createdAtMs:
      post.createdAtMs || (post.createdAt ? Date.parse(post.createdAt) : 0) || Date.now(),
  };
}

class SocialSyncService {
  private postListeners: Set<PostListener> = new Set();
  private profileListeners: Set<ProfileListener> = new Set();

  public subscribePosts(listener: PostListener): () => void {
    this.postListeners.add(listener);
    return () => this.postListeners.delete(listener);
  }

  public subscribeProfile(listener: ProfileListener): () => void {
    this.profileListeners.add(listener);
    return () => this.profileListeners.delete(listener);
  }

  // ─── Profile Operations ───────────────────────────────────────────────────────
  async getUserProfile(): Promise<MobileUserProfile> {
    // 1. Önce DynamoDB sunucu profilini kontrol et (cihaz yenilenmesi veya güncelleme durumunda veriler kaybolmaz)
    try {
      const res = await communityFetch("/community/profile");
      if (res.ok) {
        const data = await res.json();
        if (data?.profile && typeof data.profile === "object") {
          const p = data.profile;
          const serverProfile: MobileUserProfile = {
            fullName: p.fullName || "",
            username: p.username || "",
            email: p.email || "",
            travelTitle: p.travelTitle || "",
            bio: p.bio || "",
            location: p.location || "",
            avatarUrl: p.avatarUrl || undefined,
            followersCount: 0,
            followingCount: 0,
            routesCount: 0,
            stopsCount: 0,
            verified: false,
          };
          await storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(serverProfile));
          return serverProfile;
        }
      }
    } catch (netErr) {
      // Ağ hatasında yerel saklamadan devam et
    }

    try {
      const stored = await storage.getItem(STORAGE_KEY_PROFILE);
      if (stored) {
        const parsed: MobileUserProfile = JSON.parse(stored);
        // Eski sürümün uydurma varsayılanları (birebir eşleşen alanlar) bir kez temizlenir (B1).
        const cleaned = stripLegacyProfileDefaults(parsed);
        if (cleaned !== parsed) await storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(cleaned));
        return cleaned;
      }
    } catch {}

    const session = await authService.getSession();
    const email = session?.email || "kullanici@mapsbridge.com";
    const emailPrefix = email.split("@")[0];
    const name = session?.name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

    const defaultProfile: MobileUserProfile = {
      fullName: name,
      username: emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      email,
      travelTitle: "",
      bio: "",
      location: "",
      avatarUrl: undefined,
      followersCount: 0,
      followingCount: 0,
      routesCount: 0,
      stopsCount: 0,
      verified: false,
    };

    await storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(defaultProfile));
    return defaultProfile;
  }

  async updateUserProfile(updates: Partial<MobileUserProfile>): Promise<MobileUserProfile> {
    const current = await this.getUserProfile();
    const updated: MobileUserProfile = {
      ...current,
      ...updates,
      fullName: sanitizeText(updates.fullName) || current.fullName,
      bio: sanitizeText(updates.bio) || current.bio,
      location: sanitizeText(updates.location) || current.location,
      travelTitle: sanitizeText(updates.travelTitle) || current.travelTitle,
    };

    // 1. Cihaz yerel depolamasına yaz
    await storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
    this.profileListeners.forEach((fn) => fn(updated));
    await this.syncAuthorDetailsOnPosts(updated.fullName, updated.username, updated.avatarUrl);

    // 2. DynamoDB sunucu veritabanına kalıcı olarak kaydet
    try {
      await communityFetch("/community/profile", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.warn("[SocialSync] Profil DynamoDB'ye yazılamadı, yerel kayıt korundu:", err);
    }

    return updated;
  }

  private async syncAuthorDetailsOnPosts(name: string, username: string, avatarUrl?: string) {
    try {
      const posts = await this.getPosts();
      let changed = false;
      const updatedPosts = posts.map((p) => {
        if (p.authorHandle === `@${username}` || p.authorName === name) {
          changed = true;
          return {
            ...p,
            authorName: name,
            authorHandle: `@${username}`,
            authorAvatar: avatarUrl || p.authorAvatar,
          };
        }
        return p;
      });

      if (changed) {
        await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(updatedPosts));
        this.postListeners.forEach((fn) => fn(updatedPosts));
      }
    } catch {}
  }

  // ─── Community Posts Operations (Backend Synchronized) ─────────────────────────
  async getPosts(): Promise<MobileCommunityPost[]> {
    const local = await this.localPosts();
    // 1. Canlı API; yalnız bu cihazdaki gönderiler korunur.
    try {
      const response = await communityFetch("/community/posts");
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.posts)) {
          const merged = mergePosts(data.posts.map(mapServerPostToMobile), local);
          await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(merged));
          this.postListeners.forEach((fn) => fn(merged));
          return merged;
        }
      }
    } catch (e) {
      console.warn("[socialSyncService] Backend fetch failed, falling back to local storage:", e);
    }
    // 2. Çevrimdışı: yalnız cihazdaki kayıt (uydurma içerik yok).
    return local;
  }

  private async localPosts(): Promise<MobileCommunityPost[]> {
    try {
      const stored = await storage.getItem(STORAGE_KEY_POSTS);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? (parsed as MobileCommunityPost[]) : [];
    } catch {
      return [];
    }
  }

  private async patchLocalPost(id: string, patch: Partial<MobileCommunityPost>) {
    const posts = await this.localPosts();
    const next = posts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(next));
    this.postListeners.forEach((fn) => fn(next));
  }

  /**
   * Görseli medya alanına yükler (web mediaApi: GET /media/presign-upload → PUT). Başarısızsa
   * null döner; çağıran görseli cihaz-yerel tutar ve "Yalnız bu cihazda" gösterir (M3).
   */
  async uploadImage(
    uri: string,
    mimeType: string,
    onProgress?: (fraction: number) => void,
  ): Promise<string | null> {
    try {
      const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const params = new URLSearchParams({
        fileName: `community-${Date.now()}.${ext}`,
        contentType: mimeType,
        category: "traveler-photos",
      });
      const presign = await communityFetch(`/media/presign-upload?${params.toString()}`);
      if (!presign.ok) return null;
      const { uploadUrl, publicUrl } = (await presign.json()) as {
        uploadUrl?: string;
        publicUrl?: string;
      };
      if (!uploadUrl || !publicUrl) return null;
      onProgress?.(0.2);
      const blob = await (await fetch(uri)).blob();
      onProgress?.(0.5);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": mimeType },
      });
      if (!put.ok) return null;
      onProgress?.(1);
      return publicUrl;
    } catch (e) {
      console.warn("[socialSyncService] Media upload failed:", e);
      return null;
    }
  }

  async createPost(data: {
    content: string;
    hashtags?: string[];
    locationTag?: string;
    mediaImage?: string;
    routeAttachment?: MobileCommunityPost["routeAttachment"];
  }): Promise<MobileCommunityPost> {
    const profile = await this.getUserProfile();
    const posts = await this.getPosts();

    const cleanContent = sanitizeText(data.content);
    const cleanLocation = sanitizeText(data.locationTag) || undefined;
    const cleanHashtags = (data.hashtags && data.hashtags.length > 0 ? data.hashtags : []).map(
      (h) => sanitizeText(h),
    );

    const newPost: MobileCommunityPost = {
      id: `post-${Date.now()}`,
      authorName: profile.fullName,
      authorHandle: `@${profile.username}`,
      authorAvatar: profile.avatarUrl || DEFAULT_AVATAR,
      authorEmail: profile.email,
      verified: profile.verified,
      timeAgo: "Az önce",
      content: cleanContent,
      hashtags: cleanHashtags,
      locationTag: cleanLocation,
      mediaImage: data.mediaImage,
      routeAttachment: data.routeAttachment,
      commentsCount: 0,
      retweetsCount: 0,
      likesCount: 0,
      bookmarksCount: 0,
      isLiked: false,
      isBookmarked: false,
      comments: [],
      createdAtMs: Date.now(),
    };

    // Optimistic local update
    const nextPosts = [newPost, ...posts];
    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    // Sunucu senkronu (web ile aynı): başarıda yerel kimlik sunucu kimliğiyle değişir; 404/ağ
    // hatasında gönderi "Yalnız bu cihazda" işaretlenir. Cihaz-yerel görsel sunucuya gitmez.
    const deviceImage = isDeviceImage(data.mediaImage);
    try {
      const res = await communityFetch("/community/posts", {
        method: "POST",
        body: JSON.stringify({
          content: cleanContent,
          displayName: profile.fullName,
          category: "genel",
          locationTag: cleanLocation,
          hashtags: cleanHashtags,
          image: deviceImage ? undefined : data.mediaImage,
          linkedRoute: data.routeAttachment
            ? {
                title: data.routeAttachment.title,
                stopCount: data.routeAttachment.stops?.length || 0,
                destination: cleanLocation || data.routeAttachment.title,
                stops: data.routeAttachment.stops.map((st) => ({
                  label: st.name,
                  lat: st.lat,
                  lng: st.lng,
                  address: st.address,
                  category: st.category,
                })),
              }
            : undefined,
        }),
      });
      const body = res.ok
        ? ((await res.json().catch(() => null)) as { post?: { id?: string } } | null)
        : null;
      if (body?.post?.id) {
        await this.patchLocalPost(newPost.id, {
          id: body.post.id,
          deviceOnly: deviceImage || undefined,
        });
        return { ...newPost, id: body.post.id, deviceOnly: deviceImage || undefined };
      }
      await this.patchLocalPost(newPost.id, { deviceOnly: true });
    } catch (e) {
      console.warn("[socialSyncService] Backend createPost sync failed:", e);
      await this.patchLocalPost(newPost.id, { deviceOnly: true });
    }
    return { ...newPost, deviceOnly: true };
  }

  async editPost(
    postId: string,
    updates: {
      content?: string;
      hashtags?: string[];
      locationTag?: string;
      mediaImage?: string;
      routeAttachment?: MobileCommunityPost["routeAttachment"];
    },
  ): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    const profile = await this.getUserProfile();
    const target = posts.find((p) => p.id === postId);
    if (!target) return null;

    const isOwner =
      target.authorHandle === `@${profile.username}` ||
      target.authorName.toLowerCase() === profile.fullName.toLowerCase();
    if (!isOwner) return null;

    let updatedPost: MobileCommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        updatedPost = {
          ...post,
          ...(updates.content !== undefined ? { content: sanitizeText(updates.content) } : {}),
          ...(updates.hashtags !== undefined
            ? { hashtags: updates.hashtags.map((h) => sanitizeText(h)) }
            : {}),
          ...(updates.locationTag !== undefined
            ? { locationTag: sanitizeText(updates.locationTag) }
            : {}),
          ...(updates.mediaImage !== undefined ? { mediaImage: updates.mediaImage } : {}),
          ...(updates.routeAttachment !== undefined
            ? { routeAttachment: updates.routeAttachment }
            : {}),
        };
        return updatedPost;
      }
      return post;
    });

    if (updatedPost) {
      await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
      this.postListeners.forEach((fn) => fn(nextPosts));

      try {
        await communityFetch(`/community/posts/${encodeURIComponent(postId)}`, {
          method: "PUT",
          body: JSON.stringify({
            content: updates.content,
            hashtags: updates.hashtags,
            locationTag: updates.locationTag,
            image: isDeviceImage(updates.mediaImage) ? undefined : updates.mediaImage,
          }),
        });
      } catch (e) {
        console.warn("[socialSyncService] Backend editPost sync failed:", e);
      }
    }
    return updatedPost;
  }

  async deletePost(postId: string): Promise<boolean> {
    const posts = await this.getPosts();
    const profile = await this.getUserProfile();
    const target = posts.find((p) => p.id === postId);
    if (!target) return false;

    const isOwner =
      target.authorHandle === `@${profile.username}` ||
      target.authorName.toLowerCase() === profile.fullName.toLowerCase();
    if (!isOwner) return false;

    const nextPosts = posts.filter((p) => p.id !== postId);
    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    try {
      await communityFetch(`/community/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("[socialSyncService] Backend deletePost sync failed:", e);
    }

    return true;
  }

  async toggleLike(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    let updatedPost: MobileCommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const nextLiked = !post.isLiked;
        updatedPost = {
          ...post,
          isLiked: nextLiked,
          likesCount: nextLiked ? post.likesCount + 1 : Math.max(0, post.likesCount - 1),
        };
        return updatedPost;
      }
      return post;
    });

    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    try {
      await communityFetch(`/community/posts/${encodeURIComponent(postId)}/like`, {
        method: "POST",
        body: JSON.stringify({ on: (updatedPost as MobileCommunityPost | null)?.isLiked ?? true }),
      });
    } catch (e) {
      console.warn("[socialSyncService] Backend toggleLike sync failed:", e);
    }

    return updatedPost;
  }

  async toggleBookmark(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    let updatedPost: MobileCommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const nextBookmarked = !post.isBookmarked;
        updatedPost = {
          ...post,
          isBookmarked: nextBookmarked,
          bookmarksCount: nextBookmarked
            ? post.bookmarksCount + 1
            : Math.max(0, post.bookmarksCount - 1),
        };
        return updatedPost;
      }
      return post;
    });

    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    try {
      await communityFetch(`/community/posts/${encodeURIComponent(postId)}/bookmark`, {
        method: "POST",
        body: JSON.stringify({
          on: (updatedPost as MobileCommunityPost | null)?.isBookmarked ?? true,
        }),
      });
    } catch (e) {
      console.warn("[socialSyncService] Backend toggleBookmark sync failed:", e);
    }

    return updatedPost;
  }

  async retweet(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    let updatedPost: MobileCommunityPost | null = null;

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        updatedPost = {
          ...post,
          retweetsCount: post.retweetsCount + 1,
        };
        return updatedPost;
      }
      return post;
    });

    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    // Sunucuda yeniden paylaşım ucu yok: yalnız bu cihazda sayılır.
    return updatedPost;
  }
  // G8: konum cagiran ekranda turetilir (cihaz API); socialSync saf ve testlenebilir kalir.
  async addComment(
    postId: string,
    text: string,
    location?: string,
  ): Promise<MobileCommunityComment> {
    const profile = await this.getUserProfile();
    const posts = await this.getPosts();
    const now = new Date();
    const newComment: MobileCommunityComment = {
      id: `comment-${Date.now()}`,
      user: `@${profile.username}`,
      displayName: profile.fullName,
      text: text.trim(),
      time: now.toLocaleString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }),
      createdAt: now.toISOString(),
      ...(location ? { location } : {}),
    };

    const nextPosts = posts.map((post) => {
      if (post.id === postId) {
        const currentComments = post.comments || [];
        return {
          ...post,
          commentsCount: post.commentsCount + 1,
          comments: [...currentComments, newComment],
        };
      }
      return post;
    });

    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    // Sunucuda yorum ucu yok (infra-changes.md §1.13): yorum yalnız bu cihazda saklanır.
    return newComment;
  }
}

export const socialSyncService = new SocialSyncService();
