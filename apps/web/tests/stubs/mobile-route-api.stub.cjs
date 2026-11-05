// mobile-parity.test.cjs: apps/mobile/src/services/api.ts yerine (ağ yok).
// Durum vm bağlamındaki globalThis.__mbRouteApi'dedir: { calls: [], listRoutes, createRoute, ... }.
const api = () => globalThis.__mbRouteApi;
const call = (name) =>
  async function (...args) {
    api().calls.push({ name, args });
    return api()[name](...args);
  };
const routeService = {
  listRoutes: call("listRoutes"),
  createRoute: call("createRoute"),
  updateRoute: call("updateRoute"),
  deleteRoute: call("deleteRoute"),
};
module.exports = { routeService };
