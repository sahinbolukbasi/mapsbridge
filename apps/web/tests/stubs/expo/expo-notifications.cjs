// expo-notifications stub (resilience.test.cjs). Davranış globalThis.__expo.notifications ile.
//   { throwSetHandler, permissions }
function cfg() {
  return (globalThis.__expo && globalThis.__expo.notifications) || {};
}
module.exports = {
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationHandler: (h) => {
    if (cfg().throwSetHandler) throw new Error("native module unavailable");
    return h;
  },
  scheduleNotificationAsync: async () => "id-1",
  cancelScheduledNotificationAsync: async () => undefined,
  getPermissionsAsync: async () => cfg().permissions ?? { granted: false, status: "undetermined" },
  requestPermissionsAsync: async () => cfg().permissions ?? { granted: false },
};
