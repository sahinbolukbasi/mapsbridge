// mobile-parity.test.cjs: apps/mobile/src/services/api.ts yerine (socialSync saf parçaları; ağ yok).
module.exports = {
  API_BASE: "https://api.test",
  authService: { getSession: async () => null },
};
