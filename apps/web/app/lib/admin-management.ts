import { apiFetch } from "./api-client";
export type AdminSession = {
  userId: string;
  role: "admin" | "moderator" | "support";
  permissions: string[];
  paymentsConfigured: boolean;
  userManagement: boolean;
};
export type ManagedRecord = Record<string, unknown>;
export const managementApi = {
  session: () => apiFetch<{ session: AdminSession }>("/admin/session"),
  list: (section: string) => apiFetch<Record<string, ManagedRecord[]>>(`/admin/${section}`),
  user: (id: string) => apiFetch<ManagedRecord>(`/admin/users/${encodeURIComponent(id)}`),
  save: (path: string, data: ManagedRecord) =>
    apiFetch<ManagedRecord>(`/admin/${path}`, { method: "POST", body: JSON.stringify(data) }),
};
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
