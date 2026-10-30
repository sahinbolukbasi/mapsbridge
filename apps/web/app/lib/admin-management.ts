// Yönetim paneli CSV yardımcıları. Uç nokta çağrıları tipli istemcidedir (lib/admin/client.ts,
// design §8.2); tipsiz managementApi C16'da kaldırıldı.

// Admin paneli backend'den gelen heterojen (şema-esnek) kayıtları işler.
// Index signature + any: dinamik alan erişimine izin verir, runtime davranışı değişmez.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ManagedRecord = Record<string, any>;
export function csvText(records: ManagedRecord[], columns: string[]): string {
  const cell = (value: unknown) => {
    let text =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      columns.map(cell).join(","),
      ...records.map((record) => columns.map((key) => cell(record[key])).join(",")),
    ].join("\r\n")
  );
}
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
