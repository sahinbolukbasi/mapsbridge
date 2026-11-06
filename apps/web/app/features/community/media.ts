// Topluluk gönderi görseli (Increment 1.12, bug 7). Saf doğrulama + boyut hesabı; tarayıcı
// küçültmesi (canvas) ve yükleme `prepareImage` / `uploadPostImage` içinde.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1600;

export type ImageCheck = { ok: true } | { ok: false; reason: "type" | "size" | "empty" };

/** JPG/PNG/WEBP ve ≤10 MB. */
export function validateImage(file: { type: string; size: number }): ImageCheck {
  if (!file || file.size <= 0) return { ok: false, reason: "empty" };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/** En uzun kenar ≤ max; oran korunur; büyütme yok. */
export function fitWithin(w: number, h: number, max = IMAGE_MAX_EDGE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** Görsel yalnız bu cihazda mı (sunucu yüklemesi yapılamadı: data URL)? */
export const isDeviceOnlyImage = (src: string | undefined) => !!src && src.startsWith("data:");

export type PreparedImage = { blob: Blob; dataUrl: string; width: number; height: number };

/** Tarayıcıda ≤1600 px'e küçültür (canvas); JPEG/WEBP kalite 0.85, PNG kayıpsız. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = file.type === "image/png" ? "image/png" : file.type;
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), type, 0.85),
  );
  return { blob, dataUrl: canvas.toDataURL(type, 0.85), width: w, height: h };
}

/**
 * Presign + PUT ile yükler; ilerleme `onProgress(0..1)`. Presign/yükleme başarısızsa null döner
 * (çağıran görseli cihaz-yerel data URL olarak tutar ve "Yalnız bu cihazda" rozeti gösterir).
 */
export async function uploadPostImage(
  prepared: PreparedImage,
  fileName: string,
  presign: (name: string, type: string) => Promise<{ uploadUrl: string; publicUrl: string }>,
  onProgress: (ratio: number) => void,
): Promise<string | null> {
  try {
    const { uploadUrl, publicUrl } = await presign(fileName, prepared.blob.type);
    if (!uploadUrl || !publicUrl) return null;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", prepared.blob.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject());
      xhr.onerror = () => reject();
      xhr.timeout = 30000;
      xhr.ontimeout = () => reject();
      xhr.send(prepared.blob);
    });
    onProgress(1);
    return publicUrl;
  } catch {
    return null;
  }
}
