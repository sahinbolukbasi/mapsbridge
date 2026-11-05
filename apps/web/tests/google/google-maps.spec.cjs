const { test, expect } = require("@playwright/test");
const { prepare } = require("../mobile/fixtures.cjs");
// FEAT-010: .mobile-pin-sheet (FEAT-007'de kaldırıldı) kullanan iki test silindi. Bu dosya yalnız
// Google anahtarlı bir build ile koşar (NEXT_PUBLIC_GOOGLE_MAPS_*); FEAT-010'da koşulmadı.
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
