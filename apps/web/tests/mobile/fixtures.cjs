// Isolated UI fixtures: never authenticate against or mutate the live service.
async function prepare(page, { signedIn = false, theme = "light" } = {}) {
  await page.context().route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/")) return route.continue();
    if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname))
      return route.continue();
    return route.abort();
  });
  await page.addInitScript(
    ({ signedIn, theme }) => {
      localStorage.setItem("mapsbridge.theme", theme);
      if (signedIn) {
        localStorage.setItem("mapsbridge.accessToken", "local-ui-test-only");
        localStorage.setItem("mapsbridge.userEmail", "mobile-test@example.test");
        localStorage.setItem(
          "mapsbridge.directMessages",
          JSON.stringify([
            {
              id: "mobile-test-message",
              fromUsername: "gezgin",
              toUsername: "mobilgezgin",
              message: "Hafta sonu rotasını birlikte planlayalım.",
              read: false,
              createdAt: "2026-09-22T09:00:00Z",
            },
          ]),
        );
      }
    },
    { signedIn, theme },
  );
}

module.exports = { prepare };
