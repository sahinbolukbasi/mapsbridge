/**
 * MapsBridge Follow System
 * Manages followed travelers, persists to localStorage, and notifies components.
 */

const STORAGE_KEY = "mapsbridge.followingUsers";

export function getFollowedUsers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map((u) => String(u).toLowerCase().trim()) : [];
  } catch {
    return [];
  }
}

export function isFollowingUser(username: string): boolean {
  if (!username) return false;
  const list = getFollowedUsers();
  return list.includes(username.toLowerCase().trim());
}

export function toggleFollowUser(username: string): boolean {
  if (typeof window === "undefined" || !username) return false;
  const clean = username.toLowerCase().trim();
  const current = getFollowedUsers();
  const index = current.indexOf(clean);
  let nextList: string[];
  let isNowFollowing: boolean;

  if (index >= 0) {
    nextList = current.filter((u) => u !== clean);
    isNowFollowing = false;
  } else {
    nextList = [...current, clean];
    isNowFollowing = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
  } catch {}

  // Dispatch global event for reactive UI synchronization
  window.dispatchEvent(
    new CustomEvent("mapsbridge:follow-change", {
      detail: { username: clean, isFollowing: isNowFollowing, followingList: nextList },
    }),
  );

  return isNowFollowing;
}

export function getFollowedUsersCount(): number {
  return getFollowedUsers().length;
}
