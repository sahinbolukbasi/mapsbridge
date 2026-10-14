#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function normalizeKB(inputFilePath, outputDir, cacheFilePath) {
  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Girdi dosyası bulunamadı: ${inputFilePath}`);
  }

  const raw = fs.readFileSync(inputFilePath, 'utf8');
  const documents = JSON.parse(raw);
  if (!Array.isArray(documents)) {
    throw new Error('Girdi dosyası bir JSON dizisi olmalıdır.');
  }

  fs.mkdirSync(outputDir, { recursive: true });

  let cache = {};
  if (cacheFilePath && fs.existsSync(cacheFilePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    } catch {
      cache = {};
    }
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const doc of documents) {
    if (!doc.id || !doc.text) continue;

    const metadata = doc.metadata || {
      sehir: doc.city,
      kategori: 'general',
      kaynak: doc.source_url,
      son_dogrulama_tarihi: doc.checked_at || new Date().toISOString().slice(0, 10),
    };

    const fingerprint = computeHash(JSON.stringify({ text: doc.text, metadata }));
    if (cache[doc.id] === fingerprint) {
      skippedCount++;
      continue;
    }

    const textPath = path.join(outputDir, `${doc.id}.txt`);
    const metaPath = path.join(outputDir, `${doc.id}.txt.metadata.json`);

    fs.writeFileSync(textPath, doc.text, 'utf8');
    fs.writeFileSync(metaPath, JSON.stringify({ metadataAttributes: metadata }, null, 2), 'utf8');

    cache[doc.id] = fingerprint;
    processedCount++;
  }

  if (cacheFilePath) {
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
  }

  return { processedCount, skippedCount, totalCount: documents.length };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args[0] || path.join(__dirname, '../../data/travel/new-york.json');
  const outDir = path.join(__dirname, '../../.build/kb-normalized');
  const cacheFile = path.join(__dirname, '../../.build/kb-cache.json');
  const result = normalizeKB(file, outDir, cacheFile);
  console.log(`Knowledge Base normalizasyonu tamamlandı: ${result.processedCount} işlendi, ${result.skippedCount} değişmediği için atlandı (Toplam: ${result.totalCount}).`);
}

module.exports = { normalizeKB, computeHash };
