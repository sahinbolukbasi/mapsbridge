// Breadcrumb öğe normalizasyonu (saf, design §3 Breadcrumb): son öğe mevcut sayfadır, link değildir.

export type BreadcrumbItem = { label: string; href?: string };
export type BreadcrumbView = { label: string; href?: string; current: boolean };

export function normalizeBreadcrumb(items: readonly BreadcrumbItem[]): BreadcrumbView[] {
  const list = items
    .map((i) => ({ label: i.label.trim(), href: i.href }))
    .filter((i) => i.label.length > 0);
  return list.map((item, k) => {
    const current = k === list.length - 1;
    return current ? { label: item.label, current } : { ...item, current };
  });
}
