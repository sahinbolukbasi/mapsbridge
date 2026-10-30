const { test, expect } = require("@playwright/test");
const { prepare } = require("../mobile/fixtures.cjs");
async function setup(page, { failed = false, saved = false } = {}) {
  await prepare(page, { signedIn: true });
  await page.addInitScript(
    ({ failed, saved }) => {
      const image =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
      const placeData = {
        displayName: "Google Test Müzesi",
        formattedAddress: "Test Caddesi, İstanbul",
        location: { toJSON: () => ({ lat: 41, lng: 29 }) },
        rating: 4.6,
        userRatingCount: 210,
        googleMapsURI: "https://maps.google.com/?cid=test",
        photos: [
          {
            getURI: () => image,
            googleMapsURI: "https://maps.google.com/?photo=test",
            authorAttributions: [
              { displayName: "Fotoğraf Sahibi", uri: "https://maps.google.com/contrib/photo" },
            ],
          },
        ],
        reviews: [
          {
            text: "Test müzesinde güzel bir gün.",
            rating: 5,
            authorAttribution: {
              displayName: "Yorum Sahibi",
              uri: "https://maps.google.com/contrib/review",
            },
            googleMapsURI: "https://maps.google.com/?review=test",
            relativePublishTimeDescription: "bir hafta önce",
          },
        ],
        regularOpeningHours: { weekdayDescriptions: ["Pazartesi: 09:00–18:00"] },
        attributions: [],
      };
      class Map {
        constructor(el, opts) {
          this.el = el;
          this.center = opts.center;
          const poi = document.createElement("button");
          poi.textContent = "Google test mekanına dokun";
          poi.style.marginTop = "150px";
          el.append(poi);
          poi.onclick = () =>
            this.click?.({
              latLng: { lat: () => 41, lng: () => 29 },
              placeId: "test-place-id",
              stop() {},
            });
        }
        addListener(name, fn) {
          if (name === "click") this.click = fn;
          return { remove: () => {} };
        }
        setZoom() {}
        panTo(value) {
          this.center = value;
        }
        getCenter() {
          return { toJSON: () => this.center };
        }
      }
      class Marker {
        constructor(opts) {
          this.button = document.createElement("button");
          this.button.textContent = opts.title;
          this.map = opts.map;
        }
        set map(value) {
          this.button?.remove();
          if (value) value.el.append(this.button);
        }
        addListener(name, fn) {
          this.button.onclick = fn;
          return { remove() {} };
        }
      }
      class Place {
        constructor({ id }) {
          this.id = id;
          Object.assign(this, placeData);
        }
        async fetchFields({ fields }) {
          window.googleRequestedFields = fields;
          if (failed) throw Error("REQUEST_DENIED");
        }
        static async searchByText() {
          return { places: [new Place({ id: "test-place-id" })] };
        }
      }
      window.google = {
        maps: {
          importLibrary: async (name) =>
            name === "maps"
              ? { Map }
              : name === "marker"
                ? {
                    AdvancedMarkerElement: Marker,
                    PinElement: class {
                      constructor() {
                        this.element = document.createElement("span");
                      }
                    },
                  }
                : { Place },
          marker: {
            AdvancedMarkerElement: Marker,
            PinElement: class {
              constructor() {
                this.element = document.createElement("span");
              }
            },
          },
          Polyline: class {
            setMap() {}
          },
          ControlPosition: { TOP_RIGHT: 1, RIGHT_TOP: 2 },
          event: { trigger() {}, clearInstanceListeners() {} },
        },
      };
      if (saved)
        localStorage.setItem(
          "mapsbridge.travelPlanner.v5",
          JSON.stringify([
            {
              id: "test-trip",
              title: "Test rotası",
              transportMode: "walking",
              isPublic: false,
              groups: [],
              days: [{ dayIndex: 1, label: "1. Gün", color: "#176548", pins: [] }],
              pins: [
                {
                  id: "saved-1",
                  label: "Kendi müzem",
                  lat: 41,
                  lng: 29,
                  address: "Kendi adresim",
                  category: "muze",
                  dayIndex: 1,
                  order: 1,
                  tripId: "test-trip",
                  visited: false,
                  group: "Genel",
                },
              ],
            },
          ]),
        );
    },
    { failed, saved },
  );
  await page.goto("/maps/");
  await expect(page.getByLabel("Google seyahat haritası")).toBeVisible();
}
test("Google POI shows attributed photos/reviews and saves only user data plus place ID", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Google test mekanına dokun" }).tap();
  const sheet = page.locator(".mobile-pin-sheet");
  await expect(sheet.getByRole("heading", { name: "Google Test Müzesi" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Fotoğraf Sahibi" })).toBeVisible();
  await sheet.getByText("Google yorumları (1)").tap();
  await expect(sheet.getByRole("link", { name: "Yorum Sahibi" })).toBeVisible();
  await expect(sheet).toContainText("Test müzesinde güzel bir gün.");
  await expect(sheet.getByRole("button", { name: "Rotaya ekle", exact: true })).toBeDisabled();
  await sheet.getByLabel("Bu durağa vereceğin ad").fill("İlk gün müzem");
  await sheet.getByRole("button", { name: "Rotaya ekle", exact: true }).tap();
  const stored = await page.evaluate(() => localStorage.getItem("mapsbridge.travelPlanner.v5"));
  expect(stored).toContain("test-place-id");
  expect(stored).toContain("İlk gün müzem");
  expect(stored).not.toContain("Test müzesinde güzel");
  expect(stored).not.toContain("Fotoğraf Sahibi");
  expect(stored).not.toContain("Google Test Müzesi");
  expect(stored).not.toContain("Test Caddesi");
});
test("existing pin matches only after explicit confirmation", async ({ page }) => {
  await setup(page, { saved: true });
  await page.getByRole("button", { name: "Kendi müzem", exact: true }).tap();
  const info = page.getByLabel("Google mekan bilgileri");
  await info.getByRole("button", { name: "Google’da mekanı bul" }).tap();
  expect(
    await page.evaluate(() => localStorage.getItem("mapsbridge.travelPlanner.v5")),
  ).not.toContain("test-place-id");
  await info.getByRole("button", { name: /Bu mekanla eşleştir/ }).tap();
  await expect(info.getByRole("heading", { name: "Google Test Müzesi" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mapsbridge.travelPlanner.v5"))).toContain(
    "test-place-id",
  );
});
test("provider error preserves pin editing without invented information", async ({ page }) => {
  await setup(page, { failed: true });
  await page.getByRole("button", { name: "Google test mekanına dokun" }).tap();
  await expect(page.getByLabel("Google mekan bilgileri")).toContainText(
    "Google mekan bilgileri alınamadı.",
  );
  await expect(page.getByRole("link", { name: "Fotoğraf Sahibi" })).toHaveCount(0);
});
test("desktop and mobile display a single provider card and fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.getByRole("button", { name: "Google test mekanına dokun" }).click();
  await expect(page.locator(".mobile-pin-sheet")).toBeVisible();
  await expect(page.getByLabel("Google mekan bilgileri")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sheet = await page.locator(".mobile-pin-sheet").boundingBox(),
    nav = await page.locator(".mobile-primary-nav").boundingBox();
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(nav.y + 1);
});
test("Google text search links the selected result without automatically saving it", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Google Maps’te mekan ara").fill("müze");
  await page.locator(".google-map-search").getByRole("button", { name: "Ara", exact: true }).tap();
  await page
    .locator(".google-search-results")
    .getByRole("button", { name: /Google Test Müzesi/ })
    .tap();
  await expect(page.getByLabel("Google mekan bilgileri")).toContainText("Google Test Müzesi");
  const stored = await page.evaluate(() => localStorage.getItem("mapsbridge.travelPlanner.v5"));
  expect(stored).not.toContain("test-place-id");
});
