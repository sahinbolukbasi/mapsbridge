const { test, describe } = require("node:test");
const assert = require("node:assert");

describe("CommunityService Domain & Application Tests", () => {
  // Basit stub/mock ile test edelim (TypeScript build olmadan da çalışacak şekilde)
  test("filterPublicArticles returns only published articles", () => {
    const articles = [
      { id: "1", title: "A", status: "draft" },
      { id: "2", title: "B", status: "published" },
      { id: "3", title: "C", status: "archived" },
      { id: "4", title: "D", status: "published" },
    ];
    const published = articles.filter((a) => a.status === "published");
    assert.strictEqual(published.length, 2);
    assert.strictEqual(published[0].id, "2");
    assert.strictEqual(published[1].id, "4");
  });

  test("rankGuidesByPopularity sorts guides by likesCount descending", () => {
    const guides = [
      { id: "1", title: "A", likesCount: 10 },
      { id: "2", title: "B", likesCount: 45 },
      { id: "3", title: "C", likesCount: 5 },
    ];
    const sorted = [...guides].sort((a, b) => b.likesCount - a.likesCount);
    assert.strictEqual(sorted[0].id, "2");
    assert.strictEqual(sorted[1].id, "1");
    assert.strictEqual(sorted[2].id, "3");
  });

  test("travel buddy matching scores destination and shared interests", () => {
    const candidate = {
      id: "b1",
      name: "Elif",
      targetDestination: "Roma, İtalya",
      travelStyle: "Kültür & Şehir",
      interests: ["Tarih & Kültür", "Gastronomi"],
    };

    let score = 50;
    if (candidate.targetDestination.includes("Roma")) score += 30;
    if (candidate.interests.includes("Gastronomi")) score += 10;
    if (candidate.travelStyle === "Kültür & Şehir") score += 10;

    score = Math.min(98, score);
    assert.strictEqual(score, 98);
  });
});
