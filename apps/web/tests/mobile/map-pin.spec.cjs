const { test, expect } = require("@playwright/test");
const { prepare } = require("./fixtures.cjs");
const pin = {
  id: "saved-1",
  label: "Kayıtlı müze",
  address: "Müze Sokak, İstanbul",
  lat: 41.0082,
  lng: 28.9784,
  category: "muze",
  note: "Biletini önceden al",
  tripId: "test-trip",
  dayIndex: 1,
  order: 1,
  group: "Genel",
  visited: false,
  durationMinutes: 90,
};
async function setup(page, { saved = false, slow = false } = {}) {
  await prepare(page, { signedIn: true });
  await page.addInitScript(
    ({ pin, saved }) => {
      if (!localStorage.getItem("mapsbridge.travelPlanner.v5"))
        localStorage.setItem(
          "mapsbridge.travelPlanner.v5",
          JSON.stringify([
            {
              id: "test-trip",
              title: "İstanbul gezim",
              transportMode: "walking",
              isPublic: false,
              groups: [],
              destination: "İstanbul",
              days: [
                { dayIndex: 1, label: "1. Gün", color: "#176548", pins: [] },
                { dayIndex: 2, label: "2. Gün", color: "#176548", pins: [] },
              ],
              pins: saved ? [pin] : [],
            },
          ]),
        );
    },
    { pin, saved },
  );
  await page.route("**/leaflet@1.9.4/dist/leaflet.js", (r) =>
    r.fulfill({
      path: require.resolve("leaflet/dist/leaflet.js"),
      contentType: "application/javascript",
    }),
  );
  await page.route("**/leaflet@1.9.4/dist/leaflet.css", (r) =>
    r.fulfill({ path: require.resolve("leaflet/dist/leaflet.css"), contentType: "text/css" }),
  );
  await page.route(/https:\/\/[^/]*(?:tile|carto)[^/]*\/.*\.png(?:\?.*)?$/, (r) =>
    r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route("**/nominatim.openstreetmap.org/reverse?*", async (r) => {
    if (slow) await new Promise((resolve) => setTimeout(resolve, 800));
    await r.fulfill({
      json: { name: "Yeni mekan", address: { road: "Yeni Sokak", city: "İstanbul" } },
    });
  });
  await page.goto("/desk/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".map-load-status")).toHaveCount(0);
}
for (const width of [320, 390])
  test(`${width}px new pin opens bottom sheet, adds to chosen day and edits saved details`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    await expect(page.getByRole("dialog", { name: "Yeni Sokak" })).toHaveCount(0);
    await page.locator(".custom-map-pin").tap();
    const sheet = page.locator(".mobile-pin-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Rotaya ekle", exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("new-pin-sheet.png") });
    await sheet.getByLabel("Gün", { exact: true }).selectOption("2");
    await sheet.getByRole("button", { name: "Rotaya ekle", exact: true }).tap();
    await expect(sheet).toContainText("İstanbul gezim · 2. gün");
    await expect(sheet.getByRole("button", { name: "Rotaya ekle", exact: true })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Düzenle", exact: true }).tap();
    await expect(sheet.getByRole("heading", { name: "Pini düzenle" })).toBeVisible();
    await sheet.getByLabel("Yer adı").fill("Yeni müzem");
    await sheet.getByLabel("Notlar").fill("Akşam ziyaret et");
    await sheet.getByRole("button", { name: "Değişiklikleri kaydet" }).tap();
    await page.screenshot({ path: testInfo.outputPath("saved-pin-sheet.png") });
    await expect(sheet).toContainText("Yeni müzem");
    await expect(sheet).toContainText("Akşam ziyaret et");
    const rect = await sheet.boundingBox(),
      nav = await page.locator(".mobile-primary-nav").boundingBox();
    expect(rect.y).toBeGreaterThan(90);
    expect(rect.y + rect.height).toBeLessThanOrEqual(nav.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await sheet.getByRole("button", { name: "Pin panelini kapat" }).tap();
    await expect(sheet).toHaveCount(0);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mapsbridge.travelPlanner.v5")),
    );
    expect(stored[0].pins).toHaveLength(1);
    expect(stored[0].pins[0]).toMatchObject({
      label: "Yeni müzem",
      note: "Akşam ziyaret et",
      dayIndex: 2,
    });
  });
test("saved marker opens real info directly and persists edits after reload", async ({ page }) => {
  await setup(page, { saved: true });
  await page.locator(".stitch-pin-head").first().tap();
  const sheet = page.locator(".mobile-pin-sheet");
  await expect(sheet).toContainText("Kayıtlı müze");
  await expect(sheet).toContainText("Biletini önceden al");
  await expect(page.locator(".map-inspect-drawer")).toBeHidden();
  await sheet.getByRole("button", { name: "Düzenle", exact: true }).tap();
  await sheet.getByLabel("Yer adı").fill("Düzenlenen müze");
  await sheet.getByRole("button", { name: "Değişiklikleri kaydet" }).tap();
  await page.reload();
  await page.locator(".stitch-pin-head").first().tap();
  await expect(sheet).toContainText("Düzenlenen müze");
});
test("late address lookup cannot reopen a closed selection", async ({ page }) => {
  await setup(page, { slow: true });
  await page.locator(".custom-map-pin").tap();
  const sheet = page.locator(".mobile-pin-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Pin panelini kapat" }).tap();
  await page.waitForTimeout(1100);
  await expect(sheet).toHaveCount(0);
});

test("tapping the map opens a new selection and saved pool pin moves without duplicating", async ({
  page,
}) => {
  await page.addInitScript((pin) => {
    localStorage.setItem(
      "mapsbridge.generalPins.v5",
      JSON.stringify([
        { ...pin, id: "pool-1", tripId: undefined, dayIndex: 0, lat: 40.9856, lng: 29.0289 },
      ]),
    );
  }, pin);
  await setup(page);
  await page.locator(".leaflet-container").tap({ position: { x: 70, y: 120 } });
  const sheet = page.locator(".mobile-pin-sheet");
  await expect(sheet.getByRole("button", { name: "Rotaya ekle", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Pin panelini kapat" }).tap();
  await page.locator(".stitch-pool-pin-head").tap();
  await expect(sheet).toContainText("Kayıtlı müze");
  await sheet.getByRole("button", { name: "Rotaya ekle", exact: true }).tap();
  await expect(sheet).toContainText("İstanbul gezim · 1. gün");
  const count = await page.evaluate(() => ({
    general: JSON.parse(localStorage.getItem("mapsbridge.generalPins.v5")).length,
    pins: JSON.parse(localStorage.getItem("mapsbridge.travelPlanner.v5"))[0].pins,
  }));
  expect(count.general).toBe(0);
  expect(count.pins).toHaveLength(1);
  expect(count.pins[0].id).toBe("pool-1");
});
