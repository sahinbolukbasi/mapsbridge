// expo-local-authentication stub (resilience.test.cjs). Davranış globalThis.__expo.localAuth ile.
//   { hasHardware, enrolled, authSuccess, throwAll }
function cfg() {
  return (globalThis.__expo && globalThis.__expo.localAuth) || {};
}
function guard(fn) {
  return async (...a) => {
    if (cfg().throwAll) throw new Error("native module unavailable");
    return fn(...a);
  };
}
module.exports = {
  hasHardwareAsync: guard(async () => !!cfg().hasHardware),
  isEnrolledAsync: guard(async () => !!cfg().enrolled),
  authenticateAsync: guard(async () => ({ success: !!cfg().authSuccess })),
};
