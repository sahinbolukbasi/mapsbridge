// expo-secure-store hafif bellek stub'ı (resilience.test.cjs).
const mem = new Map();
module.exports = {
  getItemAsync: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItemAsync: async (k, v) => void mem.set(k, v),
  deleteItemAsync: async (k) => void mem.delete(k),
};
