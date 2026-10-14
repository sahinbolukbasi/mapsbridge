// ============================================================
// MapsBridge Test Data Reset & Backup Utility
// Manages local testing state, zero-state resets, and backups.
// IMPORTANT: Works purely in browser storage (client sandbox).
// Never touches production DynamoDB or AWS infrastructure.
// ============================================================

export interface SystemDataSnapshot {
  timestamp: string;
  data: Record<string, string | null>;
}

const TRACKED_STORAGE_KEYS = [
  "mapsbridge.travelPlanner",
  "mapsbridge.travelPlanner.generalPins",
  "mapsbridge.customGroups",
  "mapsbridge.communityPosts",
  "mapsbridge.groupTrips",
  "mapsbridge.groupMessages",
  "mapsbridge.routeMarket",
  "mapsbridge.directMessages",
  "mapsbridge.followedUsers",
  "mapsbridge.userProfileDetails",
  "mapsbridge.userAvatar",
  "mapsbridge.userCoverPhoto",
];

const BACKUP_STORAGE_KEY = "mapsbridge.system_backup_latest";

/**
 * Creates a complete JSON backup snapshot of test and local data
 */
export function backupSystemData(): SystemDataSnapshot {
  const snapshot: SystemDataSnapshot = {
    timestamp: new Date().toISOString(),
    data: {},
  };

  if (typeof window === "undefined") return snapshot;

  for (const key of TRACKED_STORAGE_KEYS) {
    snapshot.data[key] = localStorage.getItem(key);
  }

  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("Failed to persist backup snapshot to localStorage", err);
  }

  return snapshot;
}

/**
 * Resets the system into a pristine, clean Zero-State:
 * - Empty general pin pool
 * - Default empty trip with 0 pins
 * - Empty direct messages
 * - Empty followed users
 * - Clean community state
 * Backs up existing data before clearing.
 */
export function resetTestSystemData(): { success: boolean; backupTimestamp: string } {
  const backup = backupSystemData();

  if (typeof window === "undefined") {
    return { success: false, backupTimestamp: backup.timestamp };
  }

  try {
    // 1. Reset Travel Planner to an empty clean workspace (0 pins)
    const cleanZeroTrip = [
      {
        id: "trip-zero",
        title: "Yeni Seyahat Planım",
        destination: "",
        transportMode: "walking",
        isPublic: false,
        groups: [],
        days: [
          { dayIndex: 1, label: "1. Gün", color: "#2563eb", subtitle: "Keşif Başlangıcı", pins: [] },
        ],
        pins: [],
      },
    ];
    localStorage.setItem("mapsbridge.travelPlanner", JSON.stringify(cleanZeroTrip));
    localStorage.setItem("mapsbridge.travelPlanner.generalPins", JSON.stringify([]));
    localStorage.setItem("mapsbridge.customGroups", JSON.stringify([]));

    // 2. Reset Messages to empty
    localStorage.setItem("mapsbridge.directMessages", JSON.stringify([]));
    localStorage.setItem("mapsbridge.groupMessages", JSON.stringify([]));

    // 3. Reset Follows
    localStorage.setItem("mapsbridge.followedUsers", JSON.stringify([]));

    // 4. Reset Route Market custom additions
    localStorage.removeItem("mapsbridge.routeMarket");
    localStorage.removeItem("mapsbridge.communityPosts");

    return { success: true, backupTimestamp: backup.timestamp };
  } catch (err) {
    console.error("Error during resetTestSystemData", err);
    return { success: false, backupTimestamp: backup.timestamp };
  }
}

/**
 * Restores the previous backup snapshot
 */
export function restoreBackupData(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return false;
    const snapshot: SystemDataSnapshot = JSON.parse(raw);

    for (const [key, val] of Object.entries(snapshot.data)) {
      if (val === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, val);
      }
    }
    return true;
  } catch (err) {
    console.error("Error during restoreBackupData", err);
    return false;
  }
}
