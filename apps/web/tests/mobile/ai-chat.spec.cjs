/**
 * Misafir asistan (design §6.1–6.2, FEAT-006; FEAT-010 ile yeniden yazıldı). Eski dosya kaldırılmış
 * promo ekranını (.ai-promo-landing, /ai?demo=1, localhost:3000) hedefliyordu. Statik export
 * 127.0.0.1:4173'ten sunulur; dış istekler fixtures ile engellenir, LLM çağrısı ve kredi yok.
 */
const { test, expect } = require("@playwright/test");
const { prepare } = require("./fixtures.cjs");

const DRAFT_KEY = "mapsbridge.guestDraft.v1";

test.describe("Misafir asistan", () => {
  test.beforeEach(async ({ page }) => {
    await prepare(page);
    await page.goto("/travel-assistant/");
  });

  test("tek h1, sohbet günlüğü ve maliyet rozeti olmayan giriş", async ({ page }) => {
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("log")).toBeVisible();
    const input = page.getByLabel("Nereye gitmek istiyorsun?");
    await expect(input).toBeVisible();
    await expect(page.getByRole("button", { name: "Gönder", exact: true })).toBeDisabled();
  });

  test("hedef yazınca ilk tur en fazla iki soruyla gelir ve taslak cihazda saklanır", async ({
    page,
  }) => {
    await page.getByLabel("Nereye gitmek istiyorsun?").fill("Roma'da 3 gün");
    await page.getByRole("button", { name: "Gönder", exact: true }).click();
    const log = page.getByRole("log");
    await expect(log).toContainText("Roma'da 3 gün");
    // I3: turda en fazla iki soru, her biri 2–4 seçenek.
    const groups = log.getByRole("group");
    await expect(groups).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const options = await groups.nth(i).getByRole("button").count();
      expect(options).toBeGreaterThanOrEqual(2);
      expect(options).toBeLessThanOrEqual(4);
    }
    const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
    expect(draft).toMatchObject({ v: 1, q: "Roma'da 3 gün" });
  });

  test("ikinci turdan sonra taslak özeti ve kayıt kapısı; yenilemede taslak korunur", async ({
    page,
  }) => {
    await page.getByLabel("Nereye gitmek istiyorsun?").fill("Lizbon");
    await page.getByRole("button", { name: "Gönder", exact: true }).click();
    const log = page.getByRole("log");
    await log.getByRole("button", { name: "3 gün", exact: true }).click();
    await log.getByRole("button", { name: "Yeme-içme", exact: true }).click();
    await log.getByRole("button", { name: "Devam", exact: true }).click();
    await log.getByRole("button", { name: "Dengeli", exact: true }).click();
    await log.getByRole("button", { name: "Müzeler", exact: true }).click();
    await log.getByRole("button", { name: "Devam", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("log")).toContainText("Lizbon");
    const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT_KEY);
    expect(draft).toMatchObject({
      q: "Lizbon",
      turn: 3,
      answers: { duration: "3d", character: "food-drink", pace: "balanced" },
    });
  });
});
