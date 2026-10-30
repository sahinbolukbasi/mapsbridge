// Kimlik formları (design §6.2, AC-19, AC-11): boş gönderim hata bağları ve eski şifre sıfırlama
// adresinin query'yi koruyarak /reset-password/'e gitmesi.
const { test, expect } = require("@playwright/test");
const { prepare } = require("./fixtures.cjs");

test("login boş gönderim: alanlar aria-invalid ve aria-describedby ile hataya bağlanır", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/login/");
  // Hidrasyondan önce tıklama yerel form gönderimi olur; istemci doğrulaması hidrasyon ister.
  await page.waitForLoadState("networkidle");
  await page.locator("form .login-submit-btn").click();
  for (const [name, text] of [
    ["E-posta", "E-posta adresinizi girin."],
    ["Şifre", "Şifrenizi girin."],
  ]) {
    const input = page.getByLabel(name, { exact: false }).first();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = await input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const ids = describedBy.split(/\s+/);
    const texts = await Promise.all(ids.map((id) => page.locator(`[id="${id}"]`).textContent()));
    expect(texts.join(" ")).toContain(text);
  }
  // Hata özeti role=alert; odak ilk hatalı alanda.
  await expect(
    page.getByRole("alert").filter({ hasText: "Lütfen şu alanları düzeltin" }),
  ).toBeVisible();
  await expect(page.locator("#emailInput")).toBeFocused();
});

test("/sifre-sifirla/ eski adresi query ile /reset-password/ doğrulama adımını açar", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/sifre-sifirla/?email=ornek%40example.com&code=123456&step=confirm");
  await page.waitForURL(/\/reset-password\/\?/);
  const url = new URL(page.url());
  expect(url.pathname).toBe("/reset-password/");
  expect(url.searchParams.get("email")).toBe("ornek@example.com");
  expect(url.searchParams.get("code")).toBe("123456");
  expect(url.searchParams.get("step")).toBe("confirm");
  await expect(page.locator("#verification_code")).toHaveValue("123456");
  await expect(page.locator(".reset-notice-strong")).toHaveText("ornek@example.com");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni Şifreni Belirle");
});
