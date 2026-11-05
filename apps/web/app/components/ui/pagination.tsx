"use client";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { Icon } from "./svg-icon";
import "./ui.css";

/** Gösterilecek sayfa numaraları (1 tabanlı); aralar null ("…"). */
export function pageWindow(page: number, pageCount: number, span = 1): Array<number | null> {
  const out: Array<number | null> = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= span) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  label,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  label: string;
}) {
  const { t } = useLocale();
  if (pageCount <= 1) return null;
  const pageLabel = (n: number) => t("ui.pageN", "Sayfa {n}").replace("{n}", String(n));
  return (
    <nav className="ui-pagination" aria-label={label} data-surface="default">
      <ul className="ui-pagination__list">
        <li>
          <button
            type="button"
            className="ui-pagination__button"
            aria-label={t("ui.previous", "Önceki")}
            aria-disabled={page <= 1 || undefined}
            onClick={() => page > 1 && onChange(page - 1)}
          >
            <Icon name="chevron-left" />
          </button>
        </li>
        {pageWindow(page, pageCount).map((p, k) =>
          p === null ? (
            <li key={`gap-${k}`} className="ui-pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={cx(
                  "ui-pagination__button",
                  p === page && "ui-pagination__button--current",
                )}
                aria-label={pageLabel(p)}
                aria-current={p === page ? "page" : undefined}
                onClick={() => p !== page && onChange(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className="ui-pagination__button"
            aria-label={t("ui.next", "Sonraki")}
            aria-disabled={page >= pageCount || undefined}
            onClick={() => page < pageCount && onChange(page + 1)}
          >
            <Icon name="chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
