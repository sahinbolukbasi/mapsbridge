"use client";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import "./ui.css";

/** Konfeti parçası sayısı (direction §2: 18, token renkli). */
export const CELEBRATE_BITS = 18;

/**
 * Başarı anı (direction §2/§3): onay halkası "pop", onay işareti çizilir, 18 token renkli konfeti
 * (≤ calc(var(--duration-route) * 1.2), R14). Azaltılmış harekette yalnız statik onay işareti.
 * role="status": başlık ve mesaj ekran okuyucuya bir kez duyurulur. Kayıt, ilk rota, ödeme
 * dönüşü, paylaşım ve istek kabulünde kullanılır; metin gerçek olayı anlatır.
 */
export function Celebrate({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ui-celebrate", className)} role="status">
      <div className="ui-celebrate__mark" aria-hidden="true">
        <span className="ui-celebrate__confetti">
          {Array.from({ length: CELEBRATE_BITS }, (_, i) => (
            <span
              key={i}
              className={`ui-celebrate__bit ui-celebrate__bit--${(i % 6) + 1}`}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
        </span>
        <span className="ui-celebrate__ring">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" focusable="false">
            <path
              className="ui-celebrate__check"
              d="M5 12.5l4.5 4.5L19 7.5"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <p className="ui-celebrate__title">{title}</p>
      {message && <p className="ui-celebrate__message">{message}</p>}
      {action && <div className="ui-celebrate__action">{action}</div>}
    </div>
  );
}
