// expo-location stub (resilience.test.cjs). Davranış globalThis.__expo.location ile.
//   { last, current, fgPermissions, throwAll }
function cfg() {
  return (globalThis.__expo && globalThis.__expo.location) || {};
}
function guard(fn) {
  return async (...a) => {
    if (cfg().throwAll) throw new Error("native module unavailable");
    return fn(...a);
  };
}
module.exports = {
  Accuracy: { Balanced: 3 },
  getLastKnownPositionAsync: guard(async () => cfg().last ?? null),
  getCurrentPositionAsync: guard(async () => {
    if (cfg().current) return cfg().current;
    throw new Error("no fix");
  }),
  getForegroundPermissionsAsync: guard(async () => cfg().fgPermissions ?? { granted: false }),
  requestForegroundPermissionsAsync: guard(async () => cfg().fgPermissions ?? { granted: false }),
};
