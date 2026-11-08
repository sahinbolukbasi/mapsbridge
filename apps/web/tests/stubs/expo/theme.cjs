// src/theme hafif stub (resilience.test.cjs) — ScreenErrorBoundary yalnız StyleSheet değerlerinde
// tokens okur; gerçek değerler test edilmez (tasarım-sistemi guard'ı ayrı dosyada).
const handler = {
  get: (t, p) => {
    if (p in t) return t[p];
    return new Proxy({}, handler);
  },
};
const tokens = new Proxy(
  {
    color: new Proxy({ bg: "bg" }, handler),
    space: new Proxy({ 5: "5" }, handler),
  },
  handler,
);
module.exports = { tokens };
