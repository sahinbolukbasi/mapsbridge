"use client";
import { useId, type ReactNode } from "react";
import { useLocale } from "../../lib/locale-context";
import { cx } from "./cx";
import { Icon } from "./svg-icon";
import { LoadingState } from "./loading-state";
import "./ui.css";

export type SortDirection = "ascending" | "descending";
export type TableColumn<R> = {
  key: string;
  header: ReactNode;
  align?: "start" | "end" | "center";
  sortable?: boolean;
  /** true: hücre <th scope="row"> olarak çizilir (satır başlığı). */
  rowHeader?: boolean;
  render?: (row: R) => ReactNode;
};

export function Table<R>({
  caption,
  captionHidden = false,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  empty,
  loading = false,
  selectable = false,
  selected = [],
  onSelectedChange,
}: {
  caption: string;
  captionHidden?: boolean;
  columns: TableColumn<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  sort?: { key: string; direction: SortDirection };
  onSortChange?: (sort: { key: string; direction: SortDirection }) => void;
  empty?: ReactNode;
  loading?: boolean;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (keys: string[]) => void;
}) {
  const { t } = useLocale();
  const captionId = useId();
  const keys = rows.map(rowKey);
  const allSelected = keys.length > 0 && keys.every((k) => selected.includes(k));
  const someSelected = !allSelected && keys.some((k) => selected.includes(k));
  const cell = (row: R, col: TableColumn<R>) =>
    col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "");

  return (
    <div
      className="ui-table"
      role="region"
      tabIndex={0}
      aria-labelledby={captionId}
      data-surface="default"
    >
      <table className="ui-table__table">
        <caption id={captionId} className={cx(captionHidden && "ui-visually-hidden")}>
          {caption}
        </caption>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="ui-table__select">
                <input
                  type="checkbox"
                  aria-label={t("ui.selectAll", "Tümünü seç")}
                  checked={allSelected}
                  aria-checked={someSelected ? "mixed" : allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => onSelectedChange?.(allSelected ? [] : keys)}
                />
              </th>
            )}
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={cx(col.align && `ui-table__cell--${col.align}`)}
                  aria-sort={col.sortable ? (active ? sort?.direction : "none") : undefined}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className="ui-table__sort"
                      onClick={() =>
                        onSortChange?.({
                          key: col.key,
                          direction:
                            active && sort?.direction === "ascending" ? "descending" : "ascending",
                        })
                      }
                    >
                      {col.header}
                      <Icon
                        name={
                          active
                            ? sort?.direction === "ascending"
                              ? "chevron-up"
                              : "chevron"
                            : "sort"
                        }
                        size={16}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <LoadingState />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                {empty ?? t("ui.empty", "Kayıt yok")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr key={key}>
                  {selectable && (
                    <td className="ui-table__select">
                      <input
                        type="checkbox"
                        aria-label={t("ui.selectRow", "Satırı seç")}
                        checked={selected.includes(key)}
                        onChange={(e) =>
                          onSelectedChange?.(
                            e.target.checked
                              ? [...selected, key]
                              : selected.filter((k) => k !== key),
                          )
                        }
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const cls = cx(col.align && `ui-table__cell--${col.align}`);
                    return col.rowHeader ? (
                      <th key={col.key} scope="row" className={cls}>
                        {cell(row, col)}
                      </th>
                    ) : (
                      <td key={col.key} className={cls}>
                        {cell(row, col)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
