// routes.json'da olup panelde bilinçli olarak kullanılmayan /admin anahtarları (design §8.3).
// ADMIN_ENDPOINTS ∪ NOT_EXPOSED = routes.json'daki tüm /admin anahtarları; kesişim boş (AC-25b).
export const NOT_EXPOSED: ReadonlyArray<{ key: string; reason: string }> = [
  {
    key: "GET /admin/ai-costs",
    reason:
      "GET /admin/token-usage ile aynı handler (handleTokenUsageAdmin); panel token-usage'ı kullanır.",
  },
  {
    key: "POST /admin/analytics/track",
    reason: "Telemetri yazma ucu; yönetim aksiyonu değil (system izni ister, F-4).",
  },
  {
    key: "OPTIONS /admin/{proxy+}",
    reason: "CORS preflight; tarayıcı otomatik gönderir, UI doğrudan çağırmaz.",
  },
];
