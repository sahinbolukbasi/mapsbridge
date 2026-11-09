// react-native-purchases hafif stub (resilience.test.cjs). Davranış globalThis.__expo.purchases
// ile sürülür: eksik/throw senaryosunu modeller. Default export `Purchases` nesnesi + LOG_LEVEL.
const cfg = () => (globalThis.__expo && globalThis.__expo.purchases) || {};

function mk(name) {
  return async (...args) => {
    const c = cfg();
    if (c.throwAll) throw new TypeError("object is not a function");
    if (typeof c[name] === "function") return c[name](...args);
    // Varsayılan kabul edilebilir dönüşler.
    if (name === "isConfigured") return !!c.configured;
    if (name === "getCustomerInfo" || name === "purchasePackage" || name === "restorePurchases")
      return { entitlements: { active: {} } };
    if (name === "getOfferings") return { current: null };
    return undefined;
  };
}

const Purchases = {
  configure: mk("configure"),
  isConfigured: mk("isConfigured"),
  logIn: mk("logIn"),
  logOut: mk("logOut"),
  getOfferings: mk("getOfferings"),
  getCustomerInfo: mk("getCustomerInfo"),
  purchasePackage: mk("purchasePackage"),
  restorePurchases: mk("restorePurchases"),
  setAttributes: mk("setAttributes"),
  setLogLevel: () => {},
};

module.exports = {
  __esModule: true,
  default: Purchases,
  LOG_LEVEL: { DEBUG: "DEBUG", INFO: "INFO", WARN: "WARN", ERROR: "ERROR" },
};
