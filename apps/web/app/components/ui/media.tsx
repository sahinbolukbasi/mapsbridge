"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { Icon } from "./svg-icon";
import "./ui.css";
export type MediaRatio = "1/1" | "4/3" | "16/9";
const RATIO_CLASS: Record<MediaRatio, string> = {
  "1/1": "ui-media--square",
  "4/3": "ui-media--4-3",
  "16/9": "ui-media--16-9",
};
/**
 * Oranlı görsel (design §4.2, F20): kutu oranı yüklemeden önce ayrılır. Görsel yoksa ya da
 * yüklenemezse sunken zemin + ikon; alt metin varsa role="img" ile korunur, taşmaz.
 */
export function Media({
  src,
  alt,
  ratio = "4/3",
  className,
}: {
  src?: string | null;
  alt: string;
  ratio?: MediaRatio;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const failed = !src || failedSrc === src;
  // Statik HTML'deki <img> hidrasyondan önce hata verirse React onError'u hiç çalışmaz:
  // bağlanınca tamamlanmış ama boyutsuz görseli decode() ile doğrula (bozuksa reddeder;
  // ertelenmiş tembel görselde yükleme bitene kadar bekler).
  useEffect(() => {
    const img = imgRef.current;
    if (!src || !img || !img.complete || img.naturalWidth > 0) return;
    img.decode().catch(() => setFailedSrc(src));
  }, [src]);
  return (
    <div className={cx("ui-media", RATIO_CLASS[ratio], className)} data-surface="default">
      {failed ? (
        <span
          className="ui-media__fallback"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
        >
          <Icon name="image" size={24} />
        </span>
      ) : (
        // Statik export: next/image optimizasyonu yok; düz <img> + tembel yükleme.
        <img
          ref={imgRef}
          className="ui-media__img"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  );
}
