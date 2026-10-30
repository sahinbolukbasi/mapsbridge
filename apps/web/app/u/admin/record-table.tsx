"use client";
// Liste tablosu (design §8.2): istemcide arama, sıralama, 20'li sayfalama ve CSV dışa aktarma.
import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Input,
  Pagination,
  Table,
  type SortDirection,
  type TableColumn,
} from "../../components/ui";
import { csvText, download, type ManagedRecord } from "../../lib/admin-management";

export const PAGE_SIZE = 20;

export type RecordColumn<R> = TableColumn<R> & {
  /** Sıralama/CSV değeri (verilmezse row[key]). */
  value?: (row: R) => string | number | boolean | null | undefined;
};

function cellValue<R>(row: R, col: RecordColumn<R>) {
  return col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "tr");
}

export function RecordTable<R>({
  caption,
  rows,
  columns,
  rowKey,
  searchLabel,
  searchText,
  csvName,
  toolbar,
  selectable = false,
  selected,
  onSelectedChange,
}: {
  caption: string;
  rows: R[];
  columns: RecordColumn<R>[];
  rowKey: (row: R) => string;
  /** Verilirse arama kutusu gösterilir; searchText satırın aranan metnidir. */
  searchLabel?: string;
  searchText?: (row: R) => string;
  /** Verilirse "CSV dışa aktar" (filtrelenmiş satırlar, aksiyon sütunu hariç). */
  csvName?: string;
  toolbar?: ReactNode;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | undefined>();
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const base =
      q && searchText
        ? rows.filter((r) => searchText(r).toLocaleLowerCase("tr").includes(q))
        : rows;
    if (!sort) return base;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return base;
    const sorted = [...base].sort((a, b) => compare(cellValue(a, col), cellValue(b, col)));
    return sort.direction === "descending" ? sorted.reverse() : sorted;
  }, [rows, query, searchText, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function exportCsv() {
    const cols = columns.filter((c) => c.key !== "actions");
    const records: ManagedRecord[] = filtered.map((row) =>
      Object.fromEntries(cols.map((c) => [c.key, cellValue(row, c)])),
    );
    const date = new Date().toISOString().slice(0, 10);
    download(
      `${csvName}-${date}.csv`,
      csvText(
        records,
        cols.map((c) => c.key),
      ),
      "text/csv;charset=utf-8",
    );
  }

  return (
    <div className="admin-records">
      {(searchLabel || csvName || toolbar) && (
        <div className="admin-records__toolbar">
          {searchLabel && (
            <Input
              type="search"
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="admin-records__search"
            />
          )}
          <div className="admin-records__actions">
            {toolbar}
            {csvName && (
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!filtered.length}>
                CSV dışa aktar
              </Button>
            )}
          </div>
        </div>
      )}
      <Table
        caption={caption}
        captionHidden
        columns={columns}
        rows={visible}
        rowKey={rowKey}
        sort={sort}
        onSortChange={setSort}
        empty={query ? "Aramayla eşleşen kayıt yok." : "Kayıt yok."}
        selectable={selectable}
        selected={selected}
        onSelectedChange={onSelectedChange}
      />
      <p className="admin-records__count" aria-live="polite">
        {filtered.length} kayıt{query ? ` (toplam ${rows.length})` : ""}
      </p>
      <Pagination
        page={current}
        pageCount={pageCount}
        onChange={setPage}
        label={`${caption} sayfaları`}
      />
    </div>
  );
}
