/** Fields whose values are redacted before logging. */
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "api_key",
  "apiKey",
  "apiSecret",
  "api_secret",
  "secret",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
]);

const REDACTED = "[REDACTED]";

/**
 * Returns a shallow copy of `obj` with sensitive field values replaced by
 * `"[REDACTED]"`. Operates one level deep; pass nested objects explicitly if
 * deeper masking is needed.
 */
export function maskSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = SENSITIVE_KEYS.has(key) ? REDACTED : value;
  }
  return result;
}
