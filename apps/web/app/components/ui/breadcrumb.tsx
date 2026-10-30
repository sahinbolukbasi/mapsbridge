"use client";
import Link from "next/link";
import { useLocale } from "../../lib/locale-context";
import { normalizeBreadcrumb, type BreadcrumbItem } from "./logic/breadcrumb";
import "./ui.css";

export type { BreadcrumbItem };

/** <nav aria-label="Sayfa konumu"><ol>; son öğe aria-current="page" ve link değildir. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useLocale();
  const view = normalizeBreadcrumb(items);
  if (view.length === 0) return null;
  return (
    <nav className="ui-breadcrumb" aria-label={t("ui.breadcrumb", "Sayfa konumu")}>
      <ol className="ui-breadcrumb__list">
        {view.map((item, k) => (
          <li key={`${k}-${item.label}`} className="ui-breadcrumb__item">
            {item.current || !item.href ? (
              <span aria-current={item.current ? "page" : undefined}>{item.label}</span>
            ) : (
              <Link href={item.href} className="ui-breadcrumb__link">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
