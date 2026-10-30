// AC-27 (design §8.6): kullanıcı askıya alma akışı yerel mock API'ye karşı. ConfirmDialog açılır,
// gerekçe boşken onay devre dışıdır; gerekçe girilince işlem yapılır ve liste güncellenir.
// Canlı servise istek gitmez: API origin'i scripts/admin-mock/server.ts'e yönlendirilir.
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test, expect } = require("@playwright/test");

const REPO = path.resolve(__dirname, "../../../..");
const API = /^https:\/\/[^/]+\.execute-api\.[^/]+\.amazonaws\.com/;
let mock = null;
let mockUrl = null;

test.beforeAll(async () => {
  mock = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      path.join(REPO, "scripts/admin-mock/server.ts"),
      "--port",
      "0",
    ],
    { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] },
  );
  mockUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("admin mock 10 sn içinde başlamadı")), 10_000);
    let out = "";
    mock.stdout.on("data", (c) => {
      out += c;
      const m = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    mock.on("exit", (code) => reject(new Error(`admin mock çıktı (${code})`)));
  });
});

test.afterAll(() => {
  if (mock && mock.exitCode === null) mock.kill("SIGTERM");
});

async function prepareAdmin(page) {
  await page.context().route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (API.test(req.url())) {
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const response = await route.fetch({ url: mockUrl + url.pathname + url.search });
      return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
    }
    if (url.hostname === "127.0.0.1") return route.continue();
    return route.abort();
  });
  await page.addInitScript(() => {
    localStorage.setItem("mapsbridge.accessToken", "local-ui-test-only");
    localStorage.setItem("mapsbridge.userEmail", "admin@example.com");
  });
}

test("askıya alma: ConfirmDialog açılır, gerekçe boşken onay devre dışı", async ({ page }) => {
  await prepareAdmin(page);
  await page.goto("/u/admin/?alan=kullanicilar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kullanıcılar");
  const row = page.getByRole("row").filter({ hasText: "ornek.kullanici@example.com" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Askıya al" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toContainText("askıya alınsın mı?");
  const confirm = dialog.getByRole("button", { name: "Askıya al" });
  await expect(confirm).toBeDisabled();
  // Varsayılan odak İptal'dedir.
  await expect(dialog.getByRole("button", { name: "İptal" })).toBeFocused();

  await dialog.getByLabel("Gerekçe").fill("Te");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Gerekçe").fill("Tekrarlanan spam içerik");
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Kullanıcı askıya alındı.")).toBeVisible();
  await expect(row.getByText("Askıda")).toBeVisible();
  await expect(row.getByRole("button", { name: "Askıyı kaldır" })).toBeVisible();
});
