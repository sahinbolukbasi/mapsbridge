#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SECRET_FILE = path.join(ROOT, "infra/secrets/polar.json");

if (!fs.existsSync(SECRET_FILE)) {
  console.error("❌ HATA: infra/secrets/polar.json dosyası bulunamadı.");
  process.exit(1);
}

const profile = process.env.AWS_PROFILE || "mapsbridge-new";
const region = process.env.AWS_REGION || "eu-central-1";

console.log(`🔐 AWS Secrets Manager'a yükleniyor (Profil: ${profile}, Bölge: ${region})...`);

try {
  // Önce mevcut secret var mı kontrol et
  try {
    execSync(
      `aws secretsmanager describe-secret --secret-id "mapsbridge/polar" --profile "${profile}" --region "${region}"`,
      { stdio: "ignore" }
    );
    // Varsa güncelle
    execSync(
      `aws secretsmanager put-secret-value --secret-id "mapsbridge/polar" --secret-string "file://${SECRET_FILE}" --profile "${profile}" --region "${region}"`,
      { stdio: "inherit" }
    );
    console.log("✓ 'mapsbridge/polar' secret değeri başarıyla güncellendi!");
  } catch {
    // Yoksa oluştur
    execSync(
      `aws secretsmanager create-secret --name "mapsbridge/polar" --description "Polar payment credentials and product mapping" --secret-string "file://${SECRET_FILE}" --profile "${profile}" --region "${region}"`,
      { stdio: "inherit" }
    );
    console.log("✓ 'mapsbridge/polar' secret başarıyla oluşturuldu!");
  }
} catch (err) {
  console.error("❌ Yükleme sırasında hata oluştu:", err.message);
  process.exit(1);
}

