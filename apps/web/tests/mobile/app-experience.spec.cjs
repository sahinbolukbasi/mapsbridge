const { test, expect } = require("@playwright/test");
const { prepare } = require("./fixtures.cjs");

for (const width of [320, 390]) {
  test(`${width}px: mobile start exposes real actions before marketing`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 700 });
    await prepare(page, { signedIn: true });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Bugün nereye?" })).toBeVisible();
    await expect(page.locator(".home-desktop-content")).toBeHidden();
    const action = await page.getByRole("button", { name: "Seyahat planla" }).boundingBox();
    const nav = await page.locator(".mobile-primary-nav").boundingBox();
    expect(action.y + action.height).toBeLessThan(nav.y);
    expect(
      await page.locator(".mobile-start").evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    const path = testInfo.outputPath("mobile-start.png");
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach("Mobile start", { path, contentType: "image/png" });
    await page.getByLabel("Nereye gitmek istiyorsun?").fill("İstanbul’da iki gün");
    await page.getByRole("button", { name: "Seyahat planla" }).tap();
    await expect(page).toHaveURL(/\/ai\/\?q=/);
    expect(new URL(page.url()).searchParams.get("q")).toBe("İstanbul’da iki gün");
    await expect(page.locator(".ai-studio-workspace")).toBeVisible();
  });
}

test("route code opens the lookup and desktop retains its landing page", async ({ page }) => {
  await prepare(page);
  await page.goto("/");
  await page.getByLabel("Rota kodu", { exact: true }).fill("ABC123");
  await page.locator(".mobile-code-card").getByRole("button", { name: "Aç" }).tap();
  await expect(page).toHaveURL(/\/k\/\?kod=ABC123/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".mobile-start")).toBeHidden();
  await expect(page.locator(".home-desktop-content")).toBeVisible();
});

test("slow icon font never paints ligature names or expands the header", async ({
  page,
}, testInfo) => {
  await prepare(page);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/fonts/material-symbols-outlined.woff2", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const icon = page.locator(".header-brand-icon .material-symbols-outlined");
  await expect(icon).toBeHidden();
  await expect(page.getByRole("heading", { name: "Bugün nereye?" })).toBeVisible();
  const before = await page.locator(".global-site-header").boundingBox();
  release();
  await expect(page.locator("html")).toHaveAttribute("data-icons-ready", "true");
  await expect(icon).toBeVisible();
  const after = await page.locator(".global-site-header").boundingBox();
  expect(after).toEqual(before);
});

test("failed icon font leaves readable controls without raw icon names", async ({ page }) => {
  await prepare(page);
  await page.route("**/fonts/material-symbols-outlined.woff2", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".header-brand-icon .material-symbols-outlined")).toBeHidden();
  await expect(page.getByRole("button", { name: "Seyahat planla" })).toBeVisible();
  await expect(page.locator(".mobile-primary-nav svg")).toHaveCount(5);
  await page.locator(".mobile-primary-nav").getByRole("link", { name: "Giriş", exact: true }).tap();
  await expect(page).toHaveURL(/\/giris\//);
});

test("map bottom sheet expands on demand and leaves the map visible", async ({
  page,
}, testInfo) => {
  await prepare(page, { signedIn: true });
  await page.goto("/maps/");
  const panel = page.getByRole("complementary", { name: "Seyahat Masası" });
  await expect(panel).toBeVisible();
  const collapsed = await panel.boundingBox();
  expect(collapsed.height).toBeLessThanOrEqual(60);
  const handle = panel.locator(".mobile-sheet-drag-handle");
  await handle.tap();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect.poll(async () => (await panel.boundingBox()).height).toBeGreaterThan(200);
  const expanded = await panel.boundingBox();
  const nav = await page.locator(".mobile-primary-nav").boundingBox();
  expect(expanded.y).toBeGreaterThan(100);
  expect(expanded.y + expanded.height).toBeLessThanOrEqual(nav.y + 1);
  const path = testInfo.outputPath("map-sheet.png");
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach("Map sheet", { path, contentType: "image/png" });
  await handle.tap();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
});

for (const route of ["/community/", "/profile/"]) {
  test(`${route}: mobile content fits the viewport`, async ({ page }, testInfo) => {
    await prepare(page, { signedIn: true });
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-icons-ready", "true");
    await expect(page.locator(".mobile-primary-nav")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (route === "/profile/") {
      expect(
        await page.locator(".stitch-profile-actions-bar").evaluate((node) => {
          const parent = node.getBoundingClientRect();
          return [...node.querySelectorAll("a, button, span")].every((child) => {
            const r = child.getBoundingClientRect();
            return !r.width || (r.left >= parent.left - 1 && r.right <= parent.right + 1);
          });
        }),
      ).toBe(true);
      await expect(page.locator(".profile-copy-address")).toBeHidden();
    } else {
      await page
        .locator(".hero-tabs-bar")
        .getByRole("button", { name: /Arkadaş bul/ })
        .tap();
      await expect(page.locator(".hero-tabs-bar button.active")).toContainText("Arkadaş bul");
      await page.locator(".hero-tabs-bar").getByRole("button", { name: /Akış/ }).tap();
    }
    const path = testInfo.outputPath("page.png");
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach(route, { path, contentType: "image/png" });
  });
}
