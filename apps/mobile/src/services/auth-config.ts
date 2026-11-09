// Mobil kimlik servisi yapılandırması (Cognito + Google OAuth). Değerler derleme anında
// EXPO_PUBLIC_* env'leriyle gelir; her okuma `typeof process !== "undefined"` ile korunur
// (src/services/api.ts API_BASE deseni). Hiçbir resolver asla boş dönmez — eksik env bir
// derlemeyi kıramaz; canlı web değerleri son çare yedektir. Kaldırılan ölü eski mobil client
// id'si burada veya başka yerde KULLANILMAZ.

export const COGNITO_REGION = "eu-central-1";

const LIVE_COGNITO_CLIENT_ID = "pl6pf56tthpka3sh28unilopr";
const LIVE_COGNITO_USER_POOL_ID = "eu-central-1_LxXYGJV8d";
// Google web client id (apps/web ile aynı). Native iOS/Android client id'leri kullanıcı
// sırrıdır (EAS'te ayarlanır); yoksa buraya düşer ki URL asla boş client_id ile kurulmasın.
const LIVE_GOOGLE_WEB_CLIENT_ID =
  "393729296050-7idcos40rl4n1vj33nsmn9ug00b5tf45.apps.googleusercontent.com";

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

export function resolveCognitoClientId(): string {
  return env("EXPO_PUBLIC_COGNITO_CLIENT_ID") || LIVE_COGNITO_CLIENT_ID;
}

export function resolveCognitoUserPoolId(): string {
  return env("EXPO_PUBLIC_COGNITO_USER_POOL_ID") || LIVE_COGNITO_USER_POOL_ID;
}

export function resolveGoogleClientId(platformOS: string): string {
  const platformId =
    platformOS === "ios"
      ? env("EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS")
      : platformOS === "android"
        ? env("EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID")
        : undefined;
  return platformId || env("EXPO_PUBLIC_GOOGLE_CLIENT_ID") || LIVE_GOOGLE_WEB_CLIENT_ID;
}
