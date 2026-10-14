/**
 * @mapsbridge/shared
 * Ortak yardımcı fonksiyonlar, hata sınıfları ve doğrulayıcılar.
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Koordinat geçerlilik kontrolü.
 * - Enlem (Latitude): -90 ile +90 arasında olmalıdır.
 * - Boylam (Longitude): -180 ile +180 arasında olmalıdır.
 * - 0 geçerli bir koordinattır!
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 6 Haneli paylaşım kodu doğrulayıcı.
 */
export function isValidShareCode(code: unknown): boolean {
  if (typeof code !== "string") return false;
  return /^[a-zA-Z0-9]{6}$/.test(code);
}

/**
 * Standardize API yanıt yardımcısı
 */
export function createApiResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
