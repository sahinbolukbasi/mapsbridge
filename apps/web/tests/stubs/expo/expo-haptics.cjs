// expo-haptics stub (resilience.test.cjs). Davranış globalThis.__expo.haptics ile. { throwAll }
function cfg() {
  return (globalThis.__expo && globalThis.__expo.haptics) || {};
}
function guard() {
  return async () => {
    if (cfg().throwAll) throw new Error("native module unavailable");
  };
}
module.exports = {
  NotificationFeedbackType: { Success: 1, Warning: 2, Error: 3 },
  ImpactFeedbackStyle: { Light: 1 },
  selectionAsync: guard(),
  notificationAsync: guard(),
  impactAsync: guard(),
};
