// PageHeader başlık çözümü (saf, design §3 PageHeader, R5-7 / R6-4).
//   text = titleText ?? (string title) ?? entry?.title[locale];  heading = title ?? text
// Tek hata koşulu text === undefined. Registry araması C7'de eklenir; C5–C6'da title verilir.

export type PageTitleLocale = "tr" | "en";
export type PageTitleEntry = { title: Record<PageTitleLocale, string> };

export type PageTitleInput<T = unknown> = {
  title?: T;
  titleText?: string;
  entry?: PageTitleEntry | null;
  locale: PageTitleLocale;
};

export type PageTitleResult<T = unknown> =
  { heading: T | string; text: string } | { error: string };

export function resolvePageTitle<T = unknown>(
  { title, titleText, entry, locale }: PageTitleInput<T>,
  pathname = "",
): PageTitleResult<T> {
  const text = titleText ?? (typeof title === "string" ? title : undefined) ?? entry?.title[locale];
  if (text === undefined)
    return {
      error: `PageHeader: title/titleText verin ya da route-registry.ts'e kayıt ekleyin (${pathname})`,
    };
  return { heading: title ?? text, text };
}
