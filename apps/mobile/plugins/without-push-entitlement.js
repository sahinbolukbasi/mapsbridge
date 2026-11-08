// Uygulama yalnız YEREL bildirim kullanır (expo-notifications zamanlanmış hatırlatmalar); uzak
// push yok. Yerel bildirim `aps-environment` yetkisi gerektirmez. expo-notifications eklentisi bu
// yetkiyi her zaman yazar; mevcut App Store provisioning profilinde Push Notifications yeteneği
// olmadığı için etkileşimsiz EAS derlemesi imzada düşer. Bu eklenti yetkiyi siler.
// Uzak push eklenirse: Apple Developer'da yeteneği aç, profili yenile ve bu eklentiyi kaldır.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
};
