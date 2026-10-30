// admin-api.test.cjs: lib/api-client.ts yerine (window/localStorage/fetch yok).
// Durum vm bağlamındaki globalThis.__apiStub'dadır: { calls: [], respond(path, init) }.
// respond bir değer döndürürse çözülür; Error ya da {status} fırlatırsa apiFetch de fırlatır.
async function apiFetch(path, init = {}) {
  const stub = globalThis.__apiStub;
  stub.calls.push({ path, init });
  return stub.respond(path, init);
}
const API_ENDPOINT = "https://api.example.test";
module.exports = { apiFetch, API_ENDPOINT };
