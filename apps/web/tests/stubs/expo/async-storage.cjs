// @react-native-async-storage/async-storage hafif bellek stub'ı (resilience.test.cjs).
const mem = new Map();
module.exports = {
  default: {
    getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: async (k, v) => void mem.set(k, v),
    removeItem: async (k) => void mem.delete(k),
    clear: async () => void mem.clear(),
    multiGet: async (keys) => keys.map((k) => [k, mem.has(k) ? mem.get(k) : null]),
  },
};
