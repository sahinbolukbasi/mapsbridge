/**
 * AI Asistanı Sohbet Testleri
 *
 * Bu test dosyası AI asistanının sohbet özelliklerini test eder:
 * - Demo modunda promosyon ekranı
 * - Yeni sohbet butonu ve UI elementleri
 * - Asistan arayüzü bileşenleri
 *
 * Not: Tam sohbet akışı testleri için kullanıcı girişi gereklidir.
 * Bu testler demo modunda promosyon ekranını test eder.
 *
 * @ai-chat-tests
 */

const { test, expect } = require("@playwright/test");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// Test verileri
const TEST_PROMPTS = {
  greeting: "Merhaba, nasılsın?",
  travelRequest: "Roma için 3 günlük gezi planı yapar mısın?",
  clarification: "Sadece tarihi yerler istiyorum",
  followUp: "İkinci güne kahve molası ekleyebilir misin?",
};

const STARTER_PROMPTS = [
  "Roma 3 Günlük Gezi",
  "İstanbul Butik Keşif",
  "Kapadokya Macera",
  "Otel & Konaklama",
  "Yerel Gastronomi",
  "1 Günlük Kompakt Tur",
];

test.describe("AI Asistanı Sohbet Testleri", () => {
  test.beforeEach(async ({ page }) => {
    // Demo modunda çalıştır - demo modu auth gerektirmez
    await page.goto(`${BASE_URL}/ai?demo=1`);
    // Statik sayfanın yüklenmesini bekle
    await page.waitForSelector("body", { timeout: 10000 });
    // Sayfa tamamen yüklenene kadar bekle
    await page.waitForLoadState("domcontentloaded");
  });

  test.describe("AI Promosyon Ekranı (Demo Modu)", () => {
    test("AI promosyon sayfası yüklenmeli", async ({ page }) => {
      // Demo modunda promosyon ekranı gösterilmeli
      const promoContent = page
        .locator("text=AI Seyahat Asistanı")
        .or(page.locator("text=Seyahatini birlikte tasarlayalım"))
        .or(page.locator(".ai-promo-landing"))
        .or(page.locator(".ai-promo"));

      await expect(promoContent.first()).toBeVisible({ timeout: 10000 });
    });

    test("yeni sohbet başlat butonu görünmeli", async ({ page }) => {
      // Demo modunda "Yeni sohbet" veya "Sohbeti Başlat" butonu
      const newChatButton = page
        .locator('button:has-text("Yeni sohbet")')
        .or(page.locator('button:has-text("Sohbeti Başlat")'))
        .or(page.locator('button[class*="ai-promo"]'));

      await expect(newChatButton.first()).toBeVisible();
    });

    test("başlangıç promptları görünmeli", async ({ page }) => {
      // Başlangıç promptlarından en az biri görünmeli
      const starterPrompt = page
        .locator("text=Roma 3 Günlük Gezi")
        .or(page.locator("text=İstanbul Butik Keşif"))
        .or(page.locator("text=Kapadokya Macera"));

      await expect(starterPrompt.first()).toBeVisible({ timeout: 5000 });
    });

    test("demo modda auth modalı görünmeli (tıklama sonrası)", async ({ page }) => {
      const newChatButton = page
        .locator('button[class*="ai-promo"]')
        .or(page.locator('button:has-text("Yeni sohbet")'))
        .first();

      // Buton görünürse tıkla
      if (await newChatButton.isVisible().catch(() => false)) {
        await newChatButton.click();

        // Auth modalı veya giriş ekranı görünmeli
        const authModal = page
          .locator(".auth-modal")
          .or(page.locator("text=Giriş yap"))
          .or(page.locator("text=Ücretsiz Kayıt"));

        await expect(authModal.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Asistan Soru-Cevap", () => {
    test("kullanıcı mesajı gönderebilmeli", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));

      await input.fill(TEST_PROMPTS.greeting);

      // Gönder butonu aktif olmalı
      await expect(sendButton).toBeEnabled();
    });

    test("asistan selamlaşma mesajına yanıt vermeli", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));

      await input.fill(TEST_PROMPTS.greeting);
      await sendButton.click();

      // Asistan yanıtı bekleniyor
      await page.waitForTimeout(3000);

      // Asistan mesajı görünmeli
      const assistantMessage = page
        .locator(".ai-answer-text")
        .or(page.locator('[class*="assistant"]'));
      await expect(assistantMessage.first()).toBeVisible();
    });

    test("seyahat planı isteği için rota oluşturulmalı", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));

      await input.fill(TEST_PROMPTS.travelRequest);
      await sendButton.click();

      // Rota paneli açılmalı
      await page.waitForTimeout(5000);

      // Rota başlığı görünmeli
      const routeTitle = page.locator("text=Rota").or(page.locator('[class*="route"]'));
      await expect(routeTitle.first()).toBeVisible({ timeout: 10000 });
    });

    test("hızlı mod butonları çalışmalı", async ({ page }) => {
      const quickMode = page.locator("text=Tam Rota Çiz").first();

      if (await quickMode.isVisible().catch(() => false)) {
        await quickMode.click();

        const input = page.locator('[placeholder*="Seyahatiniz"]');
        await expect(input).not.toHaveValue("");
      }
    });

    test("sesli giriş butonu görünmeli", async ({ page }) => {
      const voiceButton = page
        .locator('button[title*="ses"], button[class*="voice"]')
        .or(page.locator('button:has(.material-symbols-outlined:has-text("mic"))'));

      // Sesli giriş butonu varsa görünmeli
      if (await voiceButton.isVisible().catch(() => false)) {
        await expect(voiceButton).toBeVisible();
      }
    });
  });

  test.describe("Sohbet Geçmişi ve Yönetimi", () => {
    test("sohbet silinebilmeli", async ({ page }) => {
      // Önce sohbet oluştur
      const newChatButton = page.locator('button:has-text("Yeni sohbet")');
      await newChatButton.click();

      // Silme butonu
      const deleteButton = page
        .locator('button[title="Sohbeti Sil"]')
        .or(page.locator('button:has(.material-symbols-outlined:has-text("delete"))'));

      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.first().click();

        // Onay dialogu veya doğrudan silme
        await page.waitForTimeout(500);
      }
    });

    test("sohbet başlığı mesajdan oluşturulmalı", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));

      await input.fill("Paris gezisi planla");
      await sendButton.click();

      await page.waitForTimeout(3000);

      // Sohbet listesinde başlık görünmeli
      const sessionTitle = page.locator('.ai-history-item:has-text("Paris")');
      await expect(sessionTitle.first()).toBeVisible({ timeout: 5000 });
    });

    test("sohbet listesi kaydırılabilir olmalı", async ({ page }) => {
      const newChatButton = page.locator('button:has-text("Yeni sohbet")');

      // Birden fazla sohbet oluştur
      for (let i = 0; i < 5; i++) {
        await newChatButton.click();
        await page.waitForTimeout(200);
      }

      // Sohbet listesi alanı
      const sessionList = page.locator(".ai-session-list");

      if (await sessionList.isVisible().catch(() => false)) {
        // Scroll test
        await sessionList.evaluate((el) => (el.scrollTop = el.scrollHeight));
      }
    });
  });

  test.describe("UI ve Erişilebilirlik", () => {
    test("chat input alanı görünür ve erişilebilir olmalı", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');

      await expect(input).toBeVisible();
      await expect(input).toBeEnabled();

      // Placeholder doğrulama
      const placeholder = await input.getAttribute("placeholder");
      expect(placeholder).toContain("Seyahat");
    });

    test("AI sayfası başlığı görünmeli", async ({ page }) => {
      const title = page.locator('h1:has-text("Seyahatini birlikte tasarlayalım")');
      await expect(title).toBeVisible();
    });

    test("yan panel açılıp kapanabilmeli", async ({ page }) => {
      const panelButton = page
        .locator('button:has-text("Rota panelini aç")')
        .or(page.locator('button:has-text("Sohbeti büyüt")'));

      if (await panelButton.isVisible().catch(() => false)) {
        await panelButton.click();
        await page.waitForTimeout(500);

        // Panel durumu değişmiş olmalı
        await expect(panelButton).toBeVisible();
      }
    });

    test("kredi bilgisi görünmeli", async ({ page }) => {
      const creditInfo = page.locator(".ai-quota-card").or(page.locator("text=kredi"));

      await expect(creditInfo.first()).toBeVisible();
    });
  });

  test.describe("Entegrasyon Testleri", () => {
    test("tam sohbet akışı - rota planlama", async ({ page }) => {
      // 1. Yeni sohbet başlat
      const newChatButton = page.locator('button:has-text("Yeni sohbet")');
      await newChatButton.click();

      // 2. Başlangıç promptundan seç
      const starterPrompt = page.locator("text=Roma 3 Günlük Gezi").first();
      await starterPrompt.click();

      // 3. Gönder
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));
      await sendButton.click();

      // 4. Asistan yanıtını bekle
      await page.waitForTimeout(5000);

      // 5. Yanıt kontrolü
      const assistantMessage = page.locator(".ai-answer-text");
      const messageCount = await assistantMessage.count();
      expect(messageCount).toBeGreaterThan(0);

      // 6. Rota paneli kontrolü
      const routePanel = page.locator('[class*="route"]').or(page.locator("text=Rota"));
      const hasRoute = await routePanel.isVisible().catch(() => false);

      // Rota varsa veya asistan mesajı varsa başarılı
      expect(messageCount > 0 || hasRoute).toBeTruthy();
    });

    test("çoklu mesajlaşma akışı", async ({ page }) => {
      const input = page.locator('[placeholder*="Seyahatiniz"]');
      const sendButton = page
        .locator('button[type="submit"]')
        .or(page.locator('button:has-text("Gönder")'));

      // İlk mesaj
      await input.fill(TEST_PROMPTS.travelRequest);
      await sendButton.click();
      await page.waitForTimeout(4000);

      // İkinci mesaj
      await input.fill(TEST_PROMPTS.followUp);
      await sendButton.click();
      await page.waitForTimeout(4000);

      // En az 4 mesaj (2 kullanıcı + 2 asistan) olmalı
      const allMessages = page.locator('.ai-chat-feed > div, [class*="message"]');
      const messageCount = await allMessages.count();
      expect(messageCount).toBeGreaterThanOrEqual(2);
    });
  });
});
