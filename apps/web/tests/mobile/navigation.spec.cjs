const { test, expect } = require("@playwright/test");

const { prepare } = require("./fixtures.cjs");

async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function checkBar(page) {
  const nav = page.locator(".mobile-primary-nav");
  await expect(nav).toBeVisible();
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  const boxes = await links.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height, bottom, right } = node.getBoundingClientRect();
      return { x, y, width, height, bottom, right };
    }),
  );
  const viewport = page.viewportSize();
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(viewport.width);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(1);
  }
  // Ensure no invisible overlay steals a tap in the center of a tab.
  expect(
    await links.evaluateAll((nodes) =>
      nodes.every((node) => {
        const r = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ),
  ).toBe(true);
}

for (const width of [320, 375, 390, 430, 768, 1024]) {
  for (const signedIn of [false, true]) {
    test(`${width}px ${signedIn ? "account" : "guest"}: five reachable tabs`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, { signedIn });
      await page.goto(signedIn ? "/messages/" : "/");
      await expect(page.locator(".mobile-nav-label").last()).toHaveText(
        signedIn ? "Profil" : "Giriş",
      );
      await checkBar(page);
      await expect(page.locator('.mobile-primary-nav [aria-current="page"]')).toHaveCount(1);
      if (width === 390 || width === 320) {
        await capture(page, testInfo, "mobile-screen.png");
      }
    });
  }
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: chat switches, text field and AI controls remain above the dock`, async ({
    page,
  }, testInfo) => {
    await prepare(page, { signedIn: true, theme });
    await page.goto("/messages/");
    await expect(page.locator(".chat-item-card")).toHaveCount(1);
    await page.locator(".chat-item-card").tap();
    await expect(page.locator(".chat-middle-col")).toBeVisible();
    await expect(page.locator(".chat-left-col")).toBeHidden();
    await expect(page.locator(".chat-text-input")).toBeVisible();
    const input = await page.locator(".chat-text-input").boundingBox();
    const dock = await page.locator(".mobile-primary-nav").boundingBox();
    expect(input.y + input.height).toBeLessThanOrEqual(dock.y);
    await page.locator(".chat-text-input").fill("Mobil ekran testi");
    await page.getByRole("button", { name: "Detaylar", exact: true }).tap();
    await expect(page.locator(".chat-right-col")).toBeVisible();
    await page.getByRole("button", { name: "Mesajlar", exact: true }).tap();
    await expect(page.locator(".chat-left-col")).toBeVisible();
    await page.locator(".chat-item-card").tap();
    await checkBar(page);
    await capture(page, testInfo, `chat-${theme}.png`);
    await page.locator(".mobile-nav-assistant").tap();
    await expect(page).toHaveURL(/\/travel-assistant\//);
    await expect(page.locator(".mobile-nav-assistant")).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".ai-studio-workspace")).toBeVisible();
    const switcher = await page.locator(".ai-mobile-switcher").boundingBox();
    const aiDock = await page.locator(".mobile-primary-nav").boundingBox();
    expect(switcher.y + switcher.height).toBeLessThanOrEqual(136);
    const composer = await page.locator(".ai-chat-composer-area").boundingBox();
    expect(composer.y + composer.height).toBeLessThanOrEqual(aiDock.y + 1);
    await page.getByRole("button", { name: "Rota", exact: true }).tap();
    await expect(page.locator(".ai-studio-aside-right.mobile-visible")).toBeVisible();
    const routePanel = await page.locator(".ai-studio-aside-right.mobile-visible").boundingBox();
    expect(routePanel.y + routePanel.height).toBeLessThanOrEqual(aiDock.y);
    await page.getByRole("button", { name: "Sohbet", exact: true }).tap();
    await checkBar(page);
    await capture(page, testInfo, `ai-${theme}.png`);
  });
}

test("profile subpages retain active tab; desktop uses the top navigation", async ({ page }) => {
  await prepare(page, { signedIn: true });
  await page.goto("/profile/edit/");
  await expect(page.locator('.mobile-primary-nav [aria-current="page"]')).toHaveAttribute(
    "href",
    "/profile/",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".mobile-primary-nav")).toBeHidden();
  await expect(page.locator(".header-nav-center")).toBeVisible();
});

test("landscape and reduced motion keep the tab bar usable", async ({ page }) => {
  await prepare(page, { signedIn: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/messages/");
  await checkBar(page);
  const duration = await page
    .locator(".mobile-nav-icon-wrap")
    .first()
    .evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
});

test("compact profile menu stays above the dock and can be dismissed", async ({ page }) => {
  await prepare(page, { signedIn: true });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/messages/");
  // C6: kullanıcı menüsü disclosure deseni (role="menu" yok); ad ui.userMenu.
  const trigger = page.getByRole("button", { name: "Profil menüsü" });
  await trigger.tap();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator(".header-stitch-dropdown");
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  const dock = await page.locator(".mobile-primary-nav").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await checkBar(page);
});

test("English landing keeps Explore selected and guest sign in is reachable", async ({ page }) => {
  await prepare(page);
  await page.goto("/en/");
  await expect(page.locator('.mobile-primary-nav [aria-current="page"]')).toHaveText("Explore");
  await checkBar(page);
  await page.locator(".mobile-primary-nav").getByRole("link", { name: "Sign in" }).tap();
  await expect(page).toHaveURL(/\/giris\//);
  await expect(page.locator('.mobile-primary-nav [aria-current="page"]')).toHaveText("Giriş");
});
