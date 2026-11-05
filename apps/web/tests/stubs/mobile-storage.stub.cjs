// mobile-parity.test.cjs: apps/mobile/src/services/storage.ts yerine (AsyncStorage yok).
// Durum vm bağlamındaki globalThis.__mbStorage nesnesidir (anahtar → string).
const mem = () => globalThis.__mbStorage;
const storage = {
  async getItem(key) {
    return Object.prototype.hasOwnProperty.call(mem(), key) ? mem()[key] : null;
  },
  async setItem(key, value) {
    mem()[key] = String(value);
  },
  async removeItem(key) {
    delete mem()[key];
  },
};
module.exports = { storage };
