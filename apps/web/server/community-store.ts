import fs from "fs";
import path from "path";

export interface ServerCommunityComment {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  text: string;
  createdAt: string;
}

export interface ServerCommunityPost {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar?: string;
  authorEmail?: string;
  authorBio?: string;
  authorFollowersCount?: number;
  verified?: boolean;
  content: string;
  image?: string;
  tags: string[];
  hashtags?: string[];
  locationTag?: string;
  category?: string;
  linkedRoute?: {
    id?: string;
    title: string;
    stopCount: number;
    destination: string;
    stats?: string;
    stops?: Record<string, unknown>[];
  };
  likesCount: number;
  likedBy: string[]; // usernames of users who liked
  savesCount: number;
  savedBy: string[]; // usernames of users who bookmarked
  repostCount: number;
  repostedBy: string[]; // usernames of users who reposted
  viewsCount: number;
  comments: ServerCommunityComment[];
  createdAt: string;
  createdAtMs: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_FILE_PATH = path.join(DATA_DIR, "community-posts.json");

// Ensure data directory exists
function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[CommunityStore] Failed to create data dir:", err);
  }
}

// In-memory cache + file sync
let memoryPosts: ServerCommunityPost[] | null = null;

function loadPostsFromDisk(): ServerCommunityPost[] {
  ensureDataDir();
  try {
    if (fs.existsSync(POSTS_FILE_PATH)) {
      const raw = fs.readFileSync(POSTS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[CommunityStore] Could not read posts file, initializing empty:", err);
  }
  // Zero dummy data: start with empty array
  savePostsToDisk([]);
  return [];
}

function savePostsToDisk(posts: ServerCommunityPost[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(POSTS_FILE_PATH, JSON.stringify(posts, null, 2), "utf-8");
  } catch (err) {
    console.error("[CommunityStore] Failed to write posts file:", err);
  }
}

type CommunityPostWithStatus = ServerCommunityPost & {
  likedByMe: boolean;
  savedByMe: boolean;
  repostedByMe: boolean;
};

export const communityStore = {
  getAll(currentUsername?: string): CommunityPostWithStatus[] {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }
    const cleanUser = (currentUsername || "").toLowerCase().replace("@", "");

    return memoryPosts.map((post) => ({
      ...post,
      likedByMe: cleanUser ? (post.likedBy || []).includes(cleanUser) : false,
      savedByMe: cleanUser ? (post.savedBy || []).includes(cleanUser) : false,
      repostedByMe: cleanUser ? (post.repostedBy || []).includes(cleanUser) : false,
    }));
  },

  getById(id: string, currentUsername?: string): CommunityPostWithStatus | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }
    const post = memoryPosts.find((p) => p.id === id);
    if (!post) return null;

    const cleanUser = (currentUsername || "").toLowerCase().replace("@", "");
    return {
      ...post,
      likedByMe: cleanUser ? (post.likedBy || []).includes(cleanUser) : false,
      savedByMe: cleanUser ? (post.savedBy || []).includes(cleanUser) : false,
      repostedByMe: cleanUser ? (post.repostedBy || []).includes(cleanUser) : false,
    };
  },

  create(
    postData: Partial<ServerCommunityPost> & { content: string; authorUsername: string },
  ): ServerCommunityPost {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const cleanUser = (postData.authorUsername || "gezgin").toLowerCase().replace("@", "");
    const now = Date.now();

    const newPost: ServerCommunityPost = {
      id: `post-${now}-${Math.random().toString(36).substring(2, 7)}`,
      authorUsername: cleanUser,
      authorDisplayName:
        postData.authorDisplayName || cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
      authorAvatar: postData.authorAvatar || "",
      authorEmail: postData.authorEmail || "",
      authorBio: postData.authorBio || "",
      authorFollowersCount: postData.authorFollowersCount || 1,
      verified: postData.verified ?? false,
      content: postData.content.trim(),
      image: postData.image || undefined,
      tags: postData.tags || postData.hashtags || [],
      hashtags: postData.hashtags || [],
      locationTag: postData.locationTag || undefined,
      category: postData.category || "Tarih & Kültür",
      linkedRoute: postData.linkedRoute || undefined,
      likesCount: 0,
      likedBy: [],
      savesCount: 0,
      savedBy: [],
      repostCount: 0,
      repostedBy: [],
      viewsCount: 1,
      comments: [],
      createdAt: "Şimdi",
      createdAtMs: now,
    };

    memoryPosts.unshift(newPost);
    savePostsToDisk(memoryPosts);
    return newPost;
  },

  update(id: string, updates: Partial<ServerCommunityPost>): ServerCommunityPost | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const index = memoryPosts.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = memoryPosts[index];
    const updated: ServerCommunityPost = {
      ...existing,
      ...(updates.content !== undefined ? { content: updates.content } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.locationTag !== undefined ? { locationTag: updates.locationTag } : {}),
      ...(updates.hashtags !== undefined ? { hashtags: updates.hashtags } : {}),
      ...(updates.image !== undefined ? { image: updates.image } : {}),
      ...(updates.linkedRoute !== undefined ? { linkedRoute: updates.linkedRoute } : {}),
    };

    memoryPosts[index] = updated;
    savePostsToDisk(memoryPosts);
    return updated;
  },

  delete(id: string): boolean {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const initialLength = memoryPosts.length;
    memoryPosts = memoryPosts.filter((p) => p.id !== id);

    if (memoryPosts.length !== initialLength) {
      savePostsToDisk(memoryPosts);
      return true;
    }
    return false;
  },

  toggleLike(id: string, username: string): ServerCommunityPost | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const post = memoryPosts.find((p) => p.id === id);
    if (!post) return null;

    const cleanUser = username.toLowerCase().replace("@", "");
    const likedBy = post.likedBy || [];
    const isLiked = likedBy.includes(cleanUser);

    if (isLiked) {
      post.likedBy = likedBy.filter((u) => u !== cleanUser);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likedBy = [...likedBy, cleanUser];
      post.likesCount = post.likesCount + 1;
    }

    savePostsToDisk(memoryPosts);
    return post;
  },

  toggleBookmark(id: string, username: string): ServerCommunityPost | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const post = memoryPosts.find((p) => p.id === id);
    if (!post) return null;

    const cleanUser = username.toLowerCase().replace("@", "");
    const savedBy = post.savedBy || [];
    const isSaved = savedBy.includes(cleanUser);

    if (isSaved) {
      post.savedBy = savedBy.filter((u) => u !== cleanUser);
      post.savesCount = Math.max(0, post.savesCount - 1);
    } else {
      post.savedBy = [...savedBy, cleanUser];
      post.savesCount = post.savesCount + 1;
    }

    savePostsToDisk(memoryPosts);
    return post;
  },

  retweet(id: string, username: string): ServerCommunityPost | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const post = memoryPosts.find((p) => p.id === id);
    if (!post) return null;

    const cleanUser = username.toLowerCase().replace("@", "");
    const repostedBy = post.repostedBy || [];
    const isReposted = repostedBy.includes(cleanUser);

    if (isReposted) {
      post.repostedBy = repostedBy.filter((u) => u !== cleanUser);
      post.repostCount = Math.max(0, post.repostCount - 1);
    } else {
      post.repostedBy = [...repostedBy, cleanUser];
      post.repostCount = post.repostCount + 1;
    }

    savePostsToDisk(memoryPosts);
    return post;
  },

  addComment(
    id: string,
    commentData: { username: string; displayName?: string; text: string },
  ): ServerCommunityComment | null {
    if (!memoryPosts) {
      memoryPosts = loadPostsFromDisk();
    }

    const post = memoryPosts.find((p) => p.id === id);
    if (!post) return null;

    const cleanUser = commentData.username.toLowerCase().replace("@", "");
    const newComment: ServerCommunityComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUser,
      displayName:
        commentData.displayName || cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1),
      text: commentData.text.trim(),
      createdAt: "Şimdi",
    };

    post.comments = [...(post.comments || []), newComment];
    savePostsToDisk(memoryPosts);
    return newComment;
  },
};
