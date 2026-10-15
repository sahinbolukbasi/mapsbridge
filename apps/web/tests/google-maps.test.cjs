const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm"),
  { readFileSync } = require("node:fs"),
  { buildSync } = require("esbuild");
function harness(env = {}, maps) {
  const result = buildSync({
    entryPoints: ["app/lib/google/maps-client.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const module = { exports: {} };
  const window = maps ? { google: { maps } } : {};
  const context = {
    module,
    exports: module.exports,
    process: { env },
    window,
    google: window.google,
    URL,
    URLSearchParams,
    Error,
    Event,
    clearTimeout,
    setTimeout,
  };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return module.exports;
}
test("Google OAuth client ID never enables Maps without a Maps key and map ID", async () => {
  const api = harness({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "oauth-id" });
  assert.equal(api.googleMapsEnabled, false);
  await assert.rejects(api.loadGoogleMaps(), /yapılandırılmadı/);
  assert.equal(
    harness({ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "browser-test" }).googleMapsEnabled,
    false,
  );
});
test("provider links allow only HTTP(S)", () => {
  const api = harness();
  assert.equal(api.safeGoogleLink("javascript:alert(1)"), undefined);
  assert.equal(api.safeGoogleLink("data:text/html,test"), undefined);
  assert.equal(
    api.safeGoogleLink("https://maps.google.com/?cid=one"),
    "https://maps.google.com/?cid=one",
  );
});
test("Place fetch requests actual photos, reviews and author-capable provider objects", async () => {
  let fields, id;
  const api = harness(
    { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "browser-test", NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: "map-test" },
    {
      importLibrary: async (library) => {
        assert.equal(library, "places");
        return {
          Place: class {
            constructor(data) {
              id = data.id;
            }
            async fetchFields(request) {
              fields = request.fields;
            }
          },
        };
      },
    },
  );
  await api.googlePlace("confirmed-place-id");
  assert.equal(id, "confirmed-place-id");
  for (const field of ["photos", "reviews", "rating", "attributions", "regularOpeningHours"])
    assert.ok(fields.includes(field));
});
