// src/ui barrel hafif stub (resilience.test.cjs) — ScreenErrorBoundary'nin kullandığı primitive'ler.
// Her biri işaretli (type.__name) bir marker bileşeni; test element ağacında props'u inceler.
function marker(name) {
  const C = () => null;
  C.__name = name;
  C.displayName = name;
  return C;
}
module.exports = {
  Button: marker("Button"),
  EmptyState: marker("EmptyState"),
  SafeArea: marker("SafeArea"),
};
