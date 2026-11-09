// FEAT-001: mobil kimlik yapılandırması resolver'ları (apps/mobile/src/services/auth-config.ts).
// Harness deseni mobile-ai-api.test.cjs'ten: esbuild transformSync (loader:"ts") + vm; her senaryo
// enjekte edilen bir process.env ile modülü taze yükler. Ölü eski client id'nin api.ts'te
// kalmadığı da metin olarak doğrulanır.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { transformSync } = require("esbuild");

const LIVE_COGNITO_CLIENT_ID = "pl6pf56tthpka3sh28unilopr";
const LIVE_COGNITO_USER_POOL_ID = "eu-central-1_LxXYGJV8d";
const LIVE_GOOGLE_WEB_CLIENT_ID =
  "393729296050-7idcos40rl4n1vj33nsmn9ug00b5tf45.apps.googleusercontent.com";
const DEAD_ID = "62t35qsehl3o9cdc6i4mg01tqt";

function load(env) {
  const module = { exports: {} };
  vm.runInNewContext(
    transformSync(
      fs.readFileSync(path.resolve(__dirname, "../../mobile/src/services/auth-config.ts"), "utf8"),
      { loader: "ts", format: "cjs" },
    ).code,
    {
      module,
      exports: module.exports,
      console,
      process: { env },
      require: () => ({}),
    },
  );
  return module.exports;
}

test("resolveCognitoClientId env'i tercih eder, yoksa canlı değere düşer; asla ölü id olmaz", () => {
  assert.equal(
    load({ EXPO_PUBLIC_COGNITO_CLIENT_ID: "custom-client" }).resolveCognitoClientId(),
    "custom-client",
  );
  const fallback = load({}).resolveCognitoClientId();
  assert.equal(fallback, LIVE_COGNITO_CLIENT_ID);
  assert.notEqual(fallback, DEAD_ID);
  assert.notEqual(load({ EXPO_PUBLIC_COGNITO_CLIENT_ID: "" }).resolveCognitoClientId(), DEAD_ID);
});

test("resolveCognitoUserPoolId env'i tercih eder, yoksa canlı havuza düşer", () => {
  assert.equal(
    load({ EXPO_PUBLIC_COGNITO_USER_POOL_ID: "eu-central-1_Custom" }).resolveCognitoUserPoolId(),
    "eu-central-1_Custom",
  );
  assert.equal(load({}).resolveCognitoUserPoolId(), LIVE_COGNITO_USER_POOL_ID);
  assert.equal(load({}).COGNITO_REGION, "eu-central-1");
});

test("resolveGoogleClientId platforma göre seçer, zincirle düşer ve asla boş dönmez", () => {
  const ios = load({
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: "ios-id",
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID: "android-id",
    EXPO_PUBLIC_GOOGLE_CLIENT_ID: "generic-id",
  });
  assert.equal(ios.resolveGoogleClientId("ios"), "ios-id");
  assert.equal(ios.resolveGoogleClientId("android"), "android-id");

  // Platforma özel yoksa generic env'e düşer.
  const generic = load({ EXPO_PUBLIC_GOOGLE_CLIENT_ID: "generic-id" });
  assert.equal(generic.resolveGoogleClientId("ios"), "generic-id");
  assert.equal(generic.resolveGoogleClientId("android"), "generic-id");
  assert.equal(generic.resolveGoogleClientId("web"), "generic-id");

  // Hiçbiri yoksa web client id son çare; her platform için boş değil.
  const empty = load({});
  for (const os of ["ios", "android", "web", "unknown", ""]) {
    assert.equal(empty.resolveGoogleClientId(os), LIVE_GOOGLE_WEB_CLIENT_ID);
    assert.notEqual(empty.resolveGoogleClientId(os), "", `boş değil: ${os}`);
  }
  // Boş string env'ler de son çareye düşer (|| ile).
  const blanks = load({
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: "",
    EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID: "",
    EXPO_PUBLIC_GOOGLE_CLIENT_ID: "",
  });
  assert.equal(blanks.resolveGoogleClientId("ios"), LIVE_GOOGLE_WEB_CLIENT_ID);
  assert.equal(blanks.resolveGoogleClientId("android"), LIVE_GOOGLE_WEB_CLIENT_ID);
});

test("ölü eski mobil client id api.ts'te yok", () => {
  const api = fs.readFileSync(path.resolve(__dirname, "../../mobile/src/services/api.ts"), "utf8");
  assert.ok(!api.includes(DEAD_ID), "api.ts hâlâ ölü client id'yi içeriyor");
});
