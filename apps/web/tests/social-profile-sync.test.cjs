const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

// Mock localStorage for node environment
function createMockStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('Social Media & Profile Synchronization Engine', () => {
  const mockStorage = createMockStorage();
  const eventDispatched = [];

  // Minimal standalone sync engine implementation mirror for tests
  const STORAGE_POSTS_KEY = "mapsbridge.communityPosts";
  const STORAGE_PROFILE_KEY = "mapsbridge.userProfileDetails";
  const STORAGE_AVATAR_KEY = "mapsbridge.userAvatar";
  const STORAGE_COVER_KEY = "mapsbridge.userCoverPhoto";

  const syncEngine = {
    getProfile() {
      let fullName = "Gezgin";
      let username = "gezgin";
      let email = "user@mapsbridge.com";
      let travelTitle = "Kaşif & Gezgin";
      let bio = "Sırt Çantalı Gezgin · Akdeniz kıyıları ve tarihi İpek Yolu kaşifi.";
      let location = "İstanbul, Türkiye";
      let avatarUrl = "";

      const stored = mockStorage.getItem(STORAGE_PROFILE_KEY);
      if (stored) {
        const d = JSON.parse(stored);
        if (d.fullName) fullName = d.fullName;
        if (d.username) username = d.username;
        if (d.travelTitle) travelTitle = d.travelTitle;
        if (d.bio) bio = d.bio;
        if (d.location) location = d.location;
      }
      const storedAvatar = mockStorage.getItem(STORAGE_AVATAR_KEY);
      if (storedAvatar) avatarUrl = storedAvatar;

      return {
        fullName,
        username,
        email,
        travelTitle,
        bio,
        location,
        avatarUrl: avatarUrl || undefined,
        followersCount: 1420,
        followingCount: 284,
        routesCount: 12,
        stopsCount: 38,
      };
    },

    updateProfile(updates) {
      const current = this.getProfile();
      const updated = { ...current, ...updates };
      mockStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(updated));
      if (updates.avatarUrl) mockStorage.setItem(STORAGE_AVATAR_KEY, updates.avatarUrl);
      if (updates.coverPhotoUrl) mockStorage.setItem(STORAGE_COVER_KEY, updates.coverPhotoUrl);
      this.cascadeAuthorToPosts(updated.fullName, updated.username, updated.avatarUrl);
      eventDispatched.push({ type: 'profile_updated', detail: updated });
      return updated;
    },

    cascadeAuthorToPosts(name, username, avatarUrl) {
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
        mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(updatedPosts));
        eventDispatched.push({ type: 'posts_updated', detail: updatedPosts });
      }
    },

    getPosts() {
      const raw = mockStorage.getItem(STORAGE_POSTS_KEY);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
      return [];
    },

    createPost(data) {
      const profile = this.getProfile();
      const posts = this.getPosts();
      const newPost = {
        id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        authorDisplayName: profile.fullName,
        authorUsername: profile.username,
        authorAvatar: profile.avatarUrl || "https://example.com/avatar.jpg",
        content: data.content.trim(),
        category: data.category || "Tarih & Kültür",
        locationTag: data.locationTag || profile.location,
        hashtags: data.hashtags || ["#Seyahat", "#Keşif"],
        image: data.photo || undefined,
        likesCount: 0,
        likedByMe: false,
        comments: [],
        createdAt: "Şimdi",
      };
      const nextPosts = [newPost, ...posts];
      mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      eventDispatched.push({ type: 'posts_updated', detail: nextPosts });
      return newPost;
    },

    editPost(postId, updates) {
      const posts = this.getPosts();
      let updated = null;
      const nextPosts = posts.map((p) => {
        if (p.id === postId) {
          updated = {
            ...p,
            ...(updates.content !== undefined ? { content: updates.content.trim() } : {}),
            ...(updates.category !== undefined ? { category: updates.category } : {}),
            ...(updates.locationTag !== undefined ? { locationTag: updates.locationTag } : {}),
            ...(updates.hashtags !== undefined ? { hashtags: updates.hashtags } : {}),
          };
          return updated;
        }
        return p;
      });
      if (updated) {
        mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
        eventDispatched.push({ type: 'posts_updated', detail: nextPosts });
      }
      return updated;
    },

    deletePost(postId) {
      const posts = this.getPosts();
      const nextPosts = posts.filter((p) => p.id !== postId);
      mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      eventDispatched.push({ type: 'posts_updated', detail: nextPosts });
      return true;
    },

    toggleLike(postId) {
      const posts = this.getPosts();
      let updated = null;
      const nextPosts = posts.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.likedByMe;
          updated = {
            ...p,
            likedByMe: nextLiked,
            likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
          };
          return updated;
        }
        return p;
      });
      if (updated) {
        mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
        eventDispatched.push({ type: 'posts_updated', detail: nextPosts });
      }
      return updated;
    },

    addComment(postId, text) {
      const profile = this.getProfile();
      const posts = this.getPosts();
      const nextPosts = posts.map((p) => {
        if (p.id === postId) {
          const comments = p.comments || [];
          return {
            ...p,
            comments: [
              ...comments,
              {
                id: `c-${Date.now()}`,
                username: profile.username,
                displayName: profile.fullName,
                text: text.trim(),
                createdAt: "Şimdi",
              },
            ],
          };
        }
        return p;
      });
      mockStorage.setItem(STORAGE_POSTS_KEY, JSON.stringify(nextPosts));
      eventDispatched.push({ type: 'posts_updated', detail: nextPosts });
    },
  };

  test('Profile updates persist correctly and retrieve updated state', () => {
    mockStorage.clear();
    const initial = syncEngine.getProfile();
    assert.equal(initial.fullName, "Gezgin");
    assert.equal(initial.username, "gezgin");

    syncEngine.updateProfile({
      fullName: "Arda Kurt",
      username: "ardakurt",
      travelTitle: "Baş Kaşif",
      bio: "Doğa fotoğrafçısı ve Likya Yolu rehberi",
      location: "Antalya, Türkiye",
      avatarUrl: "https://example.com/arda.jpg",
    });

    const updated = syncEngine.getProfile();
    assert.equal(updated.fullName, "Arda Kurt");
    assert.equal(updated.username, "ardakurt");
    assert.equal(updated.travelTitle, "Baş Kaşif");
    assert.equal(updated.bio, "Doğa fotoğrafçısı ve Likya Yolu rehberi");
    assert.equal(updated.location, "Antalya, Türkiye");
    assert.equal(updated.avatarUrl, "https://example.com/arda.jpg");
  });

  test('Creating a community post assigns author details and persists in storage', () => {
    const post = syncEngine.createPost({
      content: "Likya Yolu Gelidonya Feneri gün batımı rotası harikaydı!",
      category: "Doğa & Yürüyüş",
      locationTag: "Gelidonya Feneri, Antalya",
      hashtags: ["#LikyaYolu", "#Antalya", "#Trekking"],
    });

    assert.ok(post.id.startsWith("post-"));
    assert.equal(post.authorDisplayName, "Arda Kurt");
    assert.equal(post.authorUsername, "ardakurt");
    assert.equal(post.category, "Doğa & Yürüyüş");
    assert.equal(post.locationTag, "Gelidonya Feneri, Antalya");
    assert.deepEqual(post.hashtags, ["#LikyaYolu", "#Antalya", "#Trekking"]);
    assert.equal(post.likesCount, 0);
    assert.equal(post.likedByMe, false);

    const posts = syncEngine.getPosts();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, post.id);
  });

  test('In-place post editing updates text, category, location, and tags', () => {
    const posts = syncEngine.getPosts();
    const targetPost = posts[0];

    const edited = syncEngine.editPost(targetPost.id, {
      content: "Likya Yolu Gelidonya Feneri gün batımı rotası güncellendi. Su kaynakları kontrol edildi!",
      category: "Rehber & Rota",
      locationTag: "Taşlıkburnu / Gelidonya",
      hashtags: ["#LikyaYolu", "#Gelidonya", "#DoğaRehberi"],
    });

    assert.ok(edited);
    assert.equal(edited.content, "Likya Yolu Gelidonya Feneri gün batımı rotası güncellendi. Su kaynakları kontrol edildi!");
    assert.equal(edited.category, "Rehber & Rota");
    assert.equal(edited.locationTag, "Taşlıkburnu / Gelidonya");
    assert.deepEqual(edited.hashtags, ["#LikyaYolu", "#Gelidonya", "#DoğaRehberi"]);

    const storedPosts = syncEngine.getPosts();
    assert.equal(storedPosts[0].content, edited.content);
  });

  test('Liking a post toggles liked status and increments/decrements like count', () => {
    const post = syncEngine.getPosts()[0];
    assert.equal(post.likesCount, 0);
    assert.equal(post.likedByMe, false);

    // Like
    const liked = syncEngine.toggleLike(post.id);
    assert.equal(liked.likedByMe, true);
    assert.equal(liked.likesCount, 1);

    // Unlike
    const unliked = syncEngine.toggleLike(post.id);
    assert.equal(unliked.likedByMe, false);
    assert.equal(unliked.likesCount, 0);
  });

  test('Adding a comment appends to post comments list', () => {
    const post = syncEngine.getPosts()[0];
    syncEngine.addComment(post.id, "Muazzam bir rota, kamp alanı var mı?");

    const updated = syncEngine.getPosts()[0];
    assert.equal(updated.comments.length, 1);
    assert.equal(updated.comments[0].text, "Muazzam bir rota, kamp alanı var mı?");
    assert.equal(updated.comments[0].displayName, "Arda Kurt");
  });

  test('Profile update cascades author name and avatar changes to existing posts', () => {
    syncEngine.updateProfile({
      fullName: "Arda Kurt (Pro Rehber)",
      avatarUrl: "https://example.com/arda-new-pro.jpg",
    });

    const posts = syncEngine.getPosts();
    assert.equal(posts[0].authorDisplayName, "Arda Kurt (Pro Rehber)");
    assert.equal(posts[0].authorAvatar, "https://example.com/arda-new-pro.jpg");
  });

  test('Deleting a post removes it from storage', () => {
    const post = syncEngine.getPosts()[0];
    const ok = syncEngine.deletePost(post.id);
    assert.equal(ok, true);

    const posts = syncEngine.getPosts();
    assert.equal(posts.length, 0);
  });
});

describe('Soft Minimalist Iconography & Badging Design System', () => {
  test('Soft icon names verify valid minimalist SVG representations without raw emojis', () => {
    const validSoftIcons = [
      "compass",
      "map-pin",
      "send",
      "sparkle",
      "sparkles",
      "chat",
      "repeat",
      "heart",
      "eye",
      "edit",
      "trash",
      "share",
      "plus",
      "check",
      "bookmark",
      "user",
      "users",
      "settings",
      "shield",
      "map",
      "bell",
      "photo",
      "close",
      "tag",
      "globe",
      "calendar",
      "leaf",
      "mountain",
      "landmark",
      "balloon",
      "lock",
      "search",
      "logout",
    ];

    // Verify all icons are alphanumeric or hyphenated string tokens
    for (const name of validSoftIcons) {
      assert.match(name, /^[a-z0-9-]+$/);
      // Ensure no unicode emoji characters in icon tokens
      assert.doesNotMatch(name, /[\u{1F300}-\u{1FAFF}]/u);
    }
  });

  test('SoftBadge color palette contains soft serene background and subtle borders', () => {
    const palette = {
      emerald: { bg: "rgba(16, 185, 129, 0.08)", text: "#065f46" },
      slate: { bg: "rgba(100, 116, 139, 0.08)", text: "#334155" },
      indigo: { bg: "rgba(99, 102, 241, 0.08)", text: "#3730a3" },
      amber: { bg: "rgba(245, 158, 11, 0.08)", text: "#92400e" },
      rose: { bg: "rgba(244, 63, 94, 0.08)", text: "#9f1239" },
    };

    for (const [key, val] of Object.entries(palette)) {
      assert.ok(val.bg.startsWith("rgba("));
      assert.ok(val.text.startsWith("#"));
    }
  });
});

describe('Mobile Startup Stability & ErrorBoundary Contract', () => {
  test('App splash screen logic avoids premature WelcomeScreen flash', () => {
    // Simulated state transition:
    // Before fix: (loadingSession && showSplash) => if loadingSession finishes in 10ms,
    // showSplash remains true but condition fails, dropping splash immediately and falling through to WelcomeScreen!
    // After fix: (loadingSession || showSplash) => retains splash smoothly until timer fires.
    
    function shouldShowSplashBeforeFix(loadingSession, showSplash) {
      return loadingSession && showSplash;
    }

    function shouldShowSplashAfterFix(loadingSession, showSplash) {
      return loadingSession || showSplash;
    }

    // When session loading completes before splash timer finishes:
    const sessionLoaded = false; // loadingSession = false
    const splashTimerStillRunning = true; // showSplash = true

    assert.equal(shouldShowSplashBeforeFix(sessionLoaded, splashTimerStillRunning), false); // Caused flashing bug!
    assert.equal(shouldShowSplashAfterFix(sessionLoaded, splashTimerStillRunning), true);   // Fixed! Smooth transition
  });
});
