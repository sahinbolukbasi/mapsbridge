// Yatay taşma guard'ı: statik export'u (out/) üç viewport'ta yükleyip
// document.documentElement.scrollWidth > window.innerWidth olmadığını doğrular.
// Taşma varsa sorumlu elementi raporlar. Canlı servise istek gitmez (fixtures.prepare).
const { test, expect } = require("@playwright/test");
const { prepare } = require("./fixtures.cjs");

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = [
  "/",
  "/travel-assistant/",
  "/community/",
  "/login/",
  "/register/",
  "/how-it-works/",
];

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`yatay taşma yok — ${route} @ ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await prepare(page);
      await page.goto(route, { waitUntil: "networkidle" });

      const result = await page.evaluate(() => {
        const docEl = document.documentElement;
        const inner = window.innerWidth;
        const overflow = docEl.scrollWidth - inner;
        if (overflow <= 1) return { overflow, culprits: [] };
        // Taşan elementleri tespit et (sağ kenarı innerWidth'i geçenler).
        const culprits = [];
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
          const r = el.getBoundingClientRect();
          if (r.right > inner + 1 && r.width > 0) {
            culprits.push(
              `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`,
            );
          }
          if (culprits.length >= 5) break;
        }
        return { overflow, culprits };
      });

      expect(
        result.overflow,
        `${route} @ ${vp.width}px yatay taşma ${result.overflow}px. Olası sebep: ${result.culprits.join(", ")}`,
      ).toBeLessThanOrEqual(1);
    });
  }
}
