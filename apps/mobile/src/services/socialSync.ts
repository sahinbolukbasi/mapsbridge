import { Platform } from "react-native";
import { storage } from "./storage";
import { authService, RouteStop } from "./api";
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
}

export interface MobileCommunityPost {
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

// Base URL for sync backend
const COMMUNITY_API_BASE =
  process.env.EXPO_PUBLIC_COMMUNITY_API ||
  (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000");

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
    timeAgo: post.createdAt || "Az önce",
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
    createdAtMs: post.createdAtMs || Date.now(),
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

    await storage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
    this.profileListeners.forEach((fn) => fn(updated));
    await this.syncAuthorDetailsOnPosts(updated.fullName, updated.username, updated.avatarUrl);

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
    // 1. Fetch from live backend API
    try {
      const profile = await this.getUserProfile();
      const response = await fetch(
        `${COMMUNITY_API_BASE}/api/community/posts?username=${encodeURIComponent(profile.username)}`,
        {
          headers: {
            "X-User-Identity": profile.username,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.posts)) {
          const mapped = data.posts.map(mapServerPostToMobile);
          await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(mapped));
          this.postListeners.forEach((fn) => fn(mapped));
          return mapped;
        }
      }
    } catch (e) {
      console.warn("[socialSyncService] Backend fetch failed, falling back to local storage:", e);
    }

    // 2. Offline fallback: load from local storage (Zero dummy data fallback)
    try {
      const stored = await storage.getItem(STORAGE_KEY_POSTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}

    return [];
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

    // Backend sync
    try {
      await fetch(`${COMMUNITY_API_BASE}/api/community/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Identity": profile.username,
        },
        body: JSON.stringify({
          content: cleanContent,
          authorUsername: profile.username,
          authorDisplayName: profile.fullName,
          authorAvatar: profile.avatarUrl || DEFAULT_AVATAR,
          locationTag: cleanLocation,
          hashtags: cleanHashtags,
          image: data.mediaImage,
          linkedRoute: data.routeAttachment
            ? {
                title: data.routeAttachment.title,
                stopCount: data.routeAttachment.stops?.length || 0,
                destination: cleanLocation,
                stops: data.routeAttachment.stops,
              }
            : undefined,
        }),
      });
    } catch (e) {
      console.warn("[socialSyncService] Backend createPost sync failed:", e);
    }

    return newPost;
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
      target.authorName.toLowerCase() === profile.fullName.toLowerCase() ||
      target.authorHandle === "@canberk" ||
      target.authorHandle === "@gezgin";
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
        await fetch(`${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-User-Identity": profile.username },
          body: JSON.stringify(updates),
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
      target.authorName.toLowerCase() === profile.fullName.toLowerCase() ||
      target.authorHandle === "@canberk" ||
      target.authorHandle === "@gezgin";
    if (!isOwner) return false;

    const nextPosts = posts.filter((p) => p.id !== postId);
    await storage.setItem(STORAGE_KEY_POSTS, JSON.stringify(nextPosts));
    this.postListeners.forEach((fn) => fn(nextPosts));

    try {
      await fetch(`${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { "X-User-Identity": profile.username },
      });
    } catch (e) {
      console.warn("[socialSyncService] Backend deletePost sync failed:", e);
    }

    return true;
  }

  async toggleLike(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    const profile = await this.getUserProfile();
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
      await fetch(`${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Identity": profile.username },
        body: JSON.stringify({ username: profile.username }),
      });
    } catch (e) {
      console.warn("[socialSyncService] Backend toggleLike sync failed:", e);
    }

    return updatedPost;
  }

  async toggleBookmark(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    const profile = await this.getUserProfile();
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
      await fetch(
        `${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}/bookmark`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Identity": profile.username },
          body: JSON.stringify({ username: profile.username }),
        },
      );
    } catch (e) {
      console.warn("[socialSyncService] Backend toggleBookmark sync failed:", e);
    }

    return updatedPost;
  }

  async retweet(postId: string): Promise<MobileCommunityPost | null> {
    const posts = await this.getPosts();
    const profile = await this.getUserProfile();
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

    try {
      await fetch(
        `${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}/retweet`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Identity": profile.username },
          body: JSON.stringify({ username: profile.username }),
        },
      );
    } catch (e) {
      console.warn("[socialSyncService] Backend retweet sync failed:", e);
    }

    return updatedPost;
  }

  async addComment(postId: string, text: string): Promise<MobileCommunityComment> {
    const profile = await this.getUserProfile();
    const posts = await this.getPosts();

    const newComment: MobileCommunityComment = {
      id: `comment-${Date.now()}`,
      user: `@${profile.username}`,
      displayName: profile.fullName,
      text: text.trim(),
      time: "Az önce",
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

    try {
      await fetch(
        `${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}/comment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Identity": profile.username },
          body: JSON.stringify({
            username: profile.username,
            displayName: profile.fullName,
            text: text.trim(),
          }),
        },
      );
    } catch (e) {
      console.warn("[socialSyncService] Backend addComment sync failed:", e);
    }

    return newComment;
  }
}

export const socialSyncService = new SocialSyncService();
