import { clearPlannerStore } from "./trip/planner-store";
import { clearGuestDraftStore } from "./guest/guest-draft-owner";

const region = process.env.NEXT_PUBLIC_COGNITO_REGION || "eu-central-1";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

/**
 * Decode a JWT payload (base64url) without verifying signature.
 * Shared utility -- use this instead of manually splitting/decoding JWTs.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const jsonStr = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * True only for a real 3-part base64url JWT (header.payload.signature).
 * Mirrors the backend contract at infra/lambda/src/shared/auth.ts:60 so that an
 * opaque Google access token (no dots) is never stored as a session token.
 */
export function isJwt(token: string): boolean {
  if (typeof token !== "string") return false;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

/**
 * One-time migration: copy legacy `adreskopru.*` keys to `mapsbridge.*`
 * if the new keys don't exist yet, then remove the old keys.
 */
export function migrateLegacyStorageKeys() {
  if (typeof window === "undefined") return;
  const keyMap: Record<string, string> = {
    "adreskopru.accessToken": "mapsbridge.accessToken",
    "adreskopru.idToken": "mapsbridge.idToken",
    "adreskopru.refreshToken": "mapsbridge.refreshToken",
    "adreskopru.userEmail": "mapsbridge.userEmail",
    "adreskopru.loginTime": "mapsbridge.loginTime",
  };
  for (const [oldKey, newKey] of Object.entries(keyMap)) {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldVal);
    }
    localStorage.removeItem(oldKey);
    sessionStorage.removeItem(oldKey);
  }
}

async function request(target: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify({ ClientId: clientId, ...body }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const errorType = payload.__type || "";
    const msg = payload.message || "İşlem tamamlanamadı.";
    if (
      errorType.includes("NotAuthorizedException") ||
      msg.includes("Incorrect username or password")
    ) {
      throw new Error("E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.");
    }
    if (errorType.includes("UserNotFoundException")) {
      throw new Error("Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.");
    }
    if (errorType.includes("UserNotConfirmedException")) {
      throw new Error("UserNotConfirmedException: Hesabınız henüz doğrulanmamış.");
    }
    if (errorType.includes("PasswordResetRequiredException")) {
      throw new Error("Şifrenizi sıfırlamanız gerekiyor.");
    }
    if (errorType.includes("LimitExceededException")) {
      throw new Error("Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.");
    }
    if (errorType.includes("CodeMismatchException")) {
      throw new Error("Girdiğiniz doğrulama kodu hatalı.");
    }
    if (errorType.includes("ExpiredCodeException")) {
      throw new Error("Doğrulama kodunun süresi dolmuş. Lütfen yeni kod talep edin.");
    }
    throw new Error(msg);
  }
  return payload;
}

export function signUp(email: string, password: string, name: string) {
  const cleanEmail = email.trim().toLowerCase();
  // Telefon KALDIRILDI (F2): Cognito şemasında phone_number zorunlu değil; yalnız email + name.
  return request("SignUp", {
    Username: cleanEmail,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: cleanEmail },
      { Name: "name", Value: name.trim() },
    ],
  });
}

export function confirmSignUp(email: string, code: string) {
  const cleanEmail = email.trim().toLowerCase();
  return request("ConfirmSignUp", { Username: cleanEmail, ConfirmationCode: code.trim() });
}

export function resendConfirmationCode(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return request("ResendConfirmationCode", { Username: cleanEmail });
}

export function forgotPassword(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return request("ForgotPassword", { Username: cleanEmail });
}

export function confirmForgotPassword(email: string, code: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  return request("ConfirmForgotPassword", {
    Username: cleanEmail,
    ConfirmationCode: code.trim(),
    Password: password,
  });
}

export async function signIn(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const response = await request("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: cleanEmail, PASSWORD: password },
  });
  const result = response.AuthenticationResult;
  if (!result?.AccessToken || !result?.IdToken) throw new Error("Oturum oluşturulamadı.");

  if (typeof window !== "undefined") {
    localStorage.setItem("mapsbridge.accessToken", result.AccessToken);
    localStorage.setItem("mapsbridge.idToken", result.IdToken);
    if (result.RefreshToken) {
      localStorage.setItem("mapsbridge.refreshToken", result.RefreshToken);
    }
    localStorage.setItem("mapsbridge.userEmail", cleanEmail);
    localStorage.setItem("mapsbridge.loginTime", Date.now().toString());
    // Set mb_session cookie for CloudFront edge auth check
    document.cookie = `mb_session=1;path=/;max-age=86400;SameSite=Lax`;
  }

  return result;
}

export async function refreshSession() {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem("mapsbridge.refreshToken");
  if (!refreshToken) return null;

  try {
    const response = await request("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    const result = response.AuthenticationResult;
    if (result?.AccessToken && result?.IdToken) {
      localStorage.setItem("mapsbridge.accessToken", result.AccessToken);
      localStorage.setItem("mapsbridge.idToken", result.IdToken);
      document.cookie = `mb_session=1;path=/;max-age=86400;SameSite=Lax`;
      return {
        token: result.AccessToken,
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        ...result,
      };
    }
  } catch (err) {
    console.warn("Session refresh failed", err);
  }
  return null;
}

export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return true;
  if (!token.includes(".")) return false;
  const claims = decodeJwtPayload(token);
  if (claims && typeof claims.exp === "number") {
    // 5-minute buffer: treat as expired 5 min early so refresh happens proactively
    return (claims.exp as number) * 1000 <= Date.now() + 300_000;
  }
  return false;
}

/** True if the token is valid but will expire within `windowMs` (default 10 min). */
export function willExpireSoon(token: string | null | undefined, windowMs = 600_000): boolean {
  if (!token || typeof token !== "string") return false;
  if (!token.includes(".")) return false;
  const claims = decodeJwtPayload(token);
  if (claims && typeof claims.exp === "number") {
    const expiresAt = (claims.exp as number) * 1000;
    return expiresAt > Date.now() && expiresAt <= Date.now() + windowMs;
  }
  return false;
}

export function getStoredSession() {
  if (typeof window === "undefined") return null;
  const token =
    localStorage.getItem("mapsbridge.accessToken") || localStorage.getItem("mapsbridge.idToken");
  const email = localStorage.getItem("mapsbridge.userEmail");

  const cleanEmail = email ? email.trim().toLowerCase() : "";

  if (token) {
    // Ensure CloudFront edge cookie is in sync with localStorage session
    if (!document.cookie.includes("mb_session=")) {
      document.cookie = `mb_session=1;path=/;max-age=86400;SameSite=Lax`;
    }
    return { token, email: cleanEmail || "" };
  }
  return null;
}

export function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mapsbridge.accessToken");
    localStorage.removeItem("mapsbridge.idToken");
    localStorage.removeItem("mapsbridge.refreshToken");
    localStorage.removeItem("mapsbridge.userEmail");
    localStorage.removeItem("mapsbridge.loginTime");
    localStorage.removeItem("mapsbridge.userProfileDetails");
    // Planlayıcının cihaz kaydı hesaba aittir: çıkışta silinir, sonraki misafire/hesaba geçmez.
    clearPlannerStore();
    clearGuestDraftStore();
    // Clear CloudFront edge auth cookie
    document.cookie = `mb_session=;path=/;max-age=0;SameSite=Lax`;
  }
}

export interface UserProfile {
  email: string;
  name?: string;
  phone?: string;
  emailVerified?: boolean;
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const idToken = localStorage.getItem("mapsbridge.idToken");
  if (!idToken) {
    const email = localStorage.getItem("mapsbridge.userEmail");
    return email ? { email } : null;
  }

  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    const email = localStorage.getItem("mapsbridge.userEmail") || "";
    return email ? { email } : null;
  }
  return {
    email: (payload.email as string) || localStorage.getItem("mapsbridge.userEmail") || "",
    name: (payload.name as string) || "",
    phone: (payload.phone_number as string) || "",
    emailVerified: payload.email_verified === true,
  };
}

export async function changePasswordDirect(newPassword: string) {
  const session = getStoredSession();
  if (!session?.token) {
    throw new Error("Oturumunuz bulunamadı. Lütfen tekrar giriş yapın.");
  }

  const endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com"}/auth/change-password`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      accessToken: session.token,
      newPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Şifre değiştirilemedi.");
  }

  if (session.email) {
    try {
      await signIn(session.email, newPassword);
    } catch {
      // session maintained
    }
  }

  return data;
}

export async function deleteAccountDirect() {
  const session = getStoredSession();
  if (!session?.token) {
    throw new Error("Oturumunuz bulunamadı. Lütfen tekrar giriş yapın.");
  }

  const endpoint = `${process.env.NEXT_PUBLIC_API_BASE_URL || "https://pwi1j8mq0j.execute-api.eu-central-1.amazonaws.com"}/auth/delete-account`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ accessToken: session.token }),
    });
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Hesap silme işlemi tamamlanamadı.");
    }
  } finally {
    signOut();
  }
}

export function handleGoogleCredentialResponse(
  credential: string,
  manualProfile?: { email: string; name?: string; picture?: string },
) {
  if (typeof window === "undefined") return null;

  let email = manualProfile?.email || "";
  let name = manualProfile?.name || "";
  let picture = manualProfile?.picture || "";
  let givenName = "";
  let familyName = "";

  if (credential && credential.includes(".")) {
    const parsed = decodeJwtPayload(credential);
    if (parsed) {
      if (parsed.email) email = parsed.email as string;
      if (parsed.name) name = parsed.name as string;
      if (parsed.picture) picture = parsed.picture as string;
      if (parsed.given_name) givenName = parsed.given_name as string;
      if (parsed.family_name) familyName = parsed.family_name as string;
    }
  }

  if (!email) {
    throw new Error("Google hesabından geçerli bir e-posta adresi alınamadı.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "");

  // Yalnızca gerçek bir JWT (Google One Tap id_token) oturum anahtarı olarak saklanır.
  // Opak Google erişim token'ı (nokta içermeyen) backend'in 3-parçalı JWT regex'ini
  // (infra/lambda/src/shared/auth.ts:60) geçemez ve her çağrıda 401 döner.
  const token = credential;
  if (!isJwt(token)) {
    throw new Error(
      "Google ile giriş tamamlanamadı: kimlik doğrulama anahtarı alınamadı. Lütfen tekrar deneyin.",
    );
  }

  localStorage.setItem("mapsbridge.accessToken", token);
  localStorage.setItem("mapsbridge.idToken", token);
  localStorage.setItem("mapsbridge.userEmail", cleanEmail);
  localStorage.setItem("mapsbridge.loginTime", Date.now().toString());
  document.cookie = `mb_session=1;path=/;max-age=86400;SameSite=Lax`;

  // Profil detaylarını kaydet
  const nameParts = (name || cleanUsername).split(" ");
  const firstName = givenName || nameParts[0] || "";
  const lastName = familyName || nameParts.slice(1).join(" ") || "";

  localStorage.setItem(
    "mapsbridge.userProfileDetails",
    JSON.stringify({
      firstName,
      lastName,
      username: cleanUsername,
      email: cleanEmail,
      avatarUrl: picture,
      provider: "google",
    }),
  );

  return {
    email: cleanEmail,
    name: name || cleanUsername,
    picture,
    username: cleanUsername,
    token,
  };
}

export function handleAppleCredentialResponse(
  credential?: string,
  manualProfile?: { email: string; name?: string },
) {
  if (typeof window === "undefined") return null;

  let email = manualProfile?.email || "";
  let name = manualProfile?.name || "";

  if (credential && credential.includes(".")) {
    const parsed = decodeJwtPayload(credential);
    if (parsed) {
      if (parsed.email) email = parsed.email as string;
      if (parsed.name) name = parsed.name as string;
    }
  }

  if (!email) {
    throw new Error("Apple hesabından geçerli bir e-posta adresi alınamadı.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = cleanEmail.split("@")[0].replace(/[^a-z0-9_]/g, "");

  // Validate that the credential is a real JWT
  const token = credential || "";
  const validatedPayload = token ? decodeJwtPayload(token) : null;
  if (!validatedPayload || !(validatedPayload.sub || validatedPayload.email)) {
    throw new Error("Apple kimlik doğrulaması başarısız oldu. Geçerli bir token alınamadı.");
  }

  localStorage.setItem("mapsbridge.accessToken", token);
  localStorage.setItem("mapsbridge.idToken", token);
  localStorage.setItem("mapsbridge.userEmail", cleanEmail);
  localStorage.setItem("mapsbridge.loginTime", Date.now().toString());
  document.cookie = `mb_session=1;path=/;max-age=86400;SameSite=Lax`;

  const nameParts = (name || cleanUsername).split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  localStorage.setItem(
    "mapsbridge.userProfileDetails",
    JSON.stringify({
      firstName,
      lastName,
      username: cleanUsername,
      email: cleanEmail,
      provider: "apple",
    }),
  );

  return {
    email: cleanEmail,
    name: name || cleanUsername,
    username: cleanUsername,
    token,
  };
}
