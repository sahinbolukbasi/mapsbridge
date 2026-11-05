// Primitive yüzey ve bileşen token tablosu (design §3.1). ui.css renkleri buradaki bileşen
// token'larından (--button-primary-bg vb.) okur; varsayılanları semantik token'lardır.
// Bu modül tokens.ts'ten yalnızca TİP alır (çalışma zamanı döngüsü yok).
import type { ColorValue } from "./tokens.ts";

const tok = (token: string): ColorValue => ({ token });

const TONES = ["info", "success", "warning", "danger"] as const;
const BADGE_BG = {
  neutral: "color-surface-sunken",
  brand: "color-surface-brand-strong",
  success: "color-success-bg",
  warning: "color-warning-bg-strong",
  danger: "color-danger-bg",
  info: "color-info-bg",
  example: "color-example-bg",
  highlight: "color-highlight-bg",
} as const;
const BADGE_FG = {
  neutral: "color-text-muted",
  brand: "color-on-surface-brand",
  success: "color-success",
  warning: "color-warning",
  danger: "color-danger",
  info: "color-info",
  example: "color-example-fg",
  highlight: "color-highlight-text",
} as const;

// CSS adı → değer. Sıra üretilen dosyada korunur.
export const componentTokens: Record<string, ColorValue> = {
  "button-primary-bg": tok("color-primary"),
  "button-primary-bg-hover": tok("color-primary-hover"),
  "button-primary-fg": tok("color-on-primary"),
  "button-brand-bg": tok("color-brand"),
  "button-brand-bg-hover": tok("color-brand-hover"),
  "button-brand-fg": tok("color-on-primary"),
  "button-secondary-bg": tok("color-surface"),
  "button-secondary-bg-hover": tok("color-surface-sunken"),
  "button-secondary-fg": tok("color-text"),
  "button-secondary-border": tok("color-border-control"),
  "button-ghost-bg-hover": tok("color-surface-sunken"),
  "button-ghost-fg": tok("color-text"),
  "button-ghost-border": tok("color-border-control"),
  "button-danger-bg": tok("color-danger-solid"),
  "button-danger-fg": tok("color-on-primary"),
  "button-link-fg": tok("color-link"),
  "button-link-fg-hover": tok("color-link-hover"),
  "card-bg": tok("color-surface"),
  "card-fg": tok("color-text"),
  "card-border": tok("color-border"),
  "card-inverse-bg": tok("color-surface-inverse"),
  "card-inverse-border": tok("color-white-a12"),
  "field-bg": tok("color-surface"),
  "field-fg": tok("color-text"),
  "field-placeholder": tok("color-text-muted"),
  "field-border": tok("color-border-control"),
  "field-border-invalid": tok("color-danger"),
  "check-box-bg": tok("color-surface"),
  "check-box-border": tok("color-border-control"),
  "check-mark": tok("color-primary"),
  ...Object.fromEntries(
    TONES.flatMap((t) => [
      [`alert-${t}-bg`, tok(`color-${t}-bg`)],
      [`alert-${t}-border`, tok(`color-${t}-border`)],
      [`alert-${t}-accent`, tok(`color-${t}`)],
    ]),
  ),
  "alert-fg": tok("color-text"),
  "toast-bg": tok("color-surface"),
  "toast-fg": tok("color-text"),
  "toast-border": tok("color-border"),
  ...Object.fromEntries(
    (Object.keys(BADGE_BG) as Array<keyof typeof BADGE_BG>).flatMap((k) => [
      [`badge-${k}-bg`, tok(BADGE_BG[k])],
      [`badge-${k}-fg`, tok(BADGE_FG[k])],
    ]),
  ),
  "tabs-bg": tok("color-surface"),
  "tabs-fg": tok("color-text-muted"),
  "tabs-fg-selected": tok("color-text-brand"),
  "tabs-indicator": tok("color-primary"),
  "pagination-bg": tok("color-surface"),
  "pagination-fg": tok("color-text"),
  "pagination-border": tok("color-border-control"),
  "pagination-current-bg": tok("color-primary"),
  "pagination-current-fg": tok("color-on-primary"),
  "table-bg": tok("color-surface"),
  "table-fg": tok("color-text"),
  "table-head-bg": tok("color-surface-sunken"),
  "table-head-fg": tok("color-text-muted"),
  "table-border": tok("color-border"),
  "modal-bg": tok("color-surface"),
  "modal-fg": tok("color-text"),
  "modal-scrim": tok("color-scrim"),
  "avatar-bg": tok("color-surface-brand-strong"),
  "avatar-fg": tok("color-on-surface-brand"),
  "skeleton-bg": tok("color-surface-sunken"),
  // Yön B bileşen token'ları (design §3.5)
  "chip-bg": tok("color-surface"),
  "chip-fg": tok("color-text"),
  "chip-border": tok("color-border-control"),
  "chip-selected-bg": tok("color-primary"),
  "chip-selected-fg": tok("color-on-primary"),
  "segment-bg": tok("color-surface-sunken"),
  "segment-fg": tok("color-text-muted"),
  "segment-selected-bg": tok("color-surface"),
  "segment-selected-fg": tok("color-text"),
  "sheet-bg": tok("color-surface"),
  // Tutamak bir kontrol (WCAG 1.4.11 ≥3:1): border-strong (paper-300) sheet zemininde 1.70:1
  // kaldığı için kontrol kenarlığı (ink-500, 5.73:1) kullanılır (FEAT-002 sapması, design §3.5).
  "sheet-handle": tok("color-border-control"),
  "stop-bg": tok("color-surface"),
  "stop-border": tok("color-border"),
  "stop-selected-border": tok("color-primary"),
  connector: tok("color-border-strong"),
  "cost-bg": tok("color-highlight-bg"),
  "cost-fg": tok("color-highlight-text"),
  "composer-bg": tok("color-surface"),
  "composer-border": tok("color-border-control"),
};

// [data-surface="inverse"] kapta yeniden eşlenen bileşen token'ları ("Inverse kapta" sütunu).
export const componentInverseOverrides: Record<string, string> = {
  "button-primary-bg": "color-accent-strong",
  "button-primary-bg-hover": "color-link-inverse-hover",
  "button-primary-fg": "color-on-accent",
  "button-ghost-bg-hover": "color-white-a08",
  "button-ghost-fg": "color-text-inverse",
  "button-ghost-border": "color-text-inverse-subtle",
  "button-link-fg": "color-link-inverse",
  "button-link-fg-hover": "color-link-inverse-hover",
  "skeleton-bg": "color-white-a08",
  // Ters kapta chip ve kredi rozeti (ink-900 üstünde metin ≥4.5:1)
  "chip-bg": "color-white-a08",
  "chip-fg": "color-text-inverse",
  "chip-border": "color-text-inverse-subtle",
  "chip-selected-bg": "color-accent-strong",
  "chip-selected-fg": "color-on-accent",
  "cost-bg": "color-white-a08",
  "cost-fg": "color-text-inverse-highlight",
};

/**
 * Primitive varyantı × yüzey satırı (AC-4f). `bg` "container" ise primitive zemin çizmez ve
 * kabın zeminini görür. `ownSurface` true olan primitive kökünde data-surface="default" taşır;
 * "box" yalnızca işaret kutusunun kendi yüzeyi olduğunu belirtir (etiket kabı izler).
 * `inverse`: "remap" bileşen token'ları inverse kapta yeniden eşlenir, "same" değişmez,
 * "light" açık kalır (ownSurface), "n/a" kap dışı katmanda çizilir (portal/üst katman).
 */
export type PrimitiveSurface = {
  primitive: string;
  variant: string;
  file: string; // apps/web/app/components/ui/ altındaki dosya (ownSurface statik kontrolü)
  bg: string | "container";
  bgHover?: string;
  text: string[]; // ≥4.5
  ui?: string[]; // kenarlık/gösterge ≥3.0 (bileşen zeminine karşı)
  ownSurface: boolean | "box";
  inverse: "remap" | "same" | "light" | "n/a";
};

const row = (r: PrimitiveSurface): PrimitiveSurface => r;
const BUTTON_FILES = ["button.tsx", "icon-button.tsx"];

export const PRIMITIVE_SURFACES: PrimitiveSurface[] = [
  ...BUTTON_FILES.flatMap((file) => {
    const name = file === "button.tsx" ? "Button" : "IconButton";
    return [
      row({
        primitive: name,
        variant: "primary",
        file,
        bg: "button-primary-bg",
        bgHover: "button-primary-bg-hover",
        text: ["button-primary-fg"],
        ownSurface: false,
        inverse: "remap",
      }),
      row({
        primitive: name,
        variant: "brand",
        file,
        bg: "button-brand-bg",
        bgHover: "button-brand-bg-hover",
        text: ["button-brand-fg"],
        ownSurface: false,
        inverse: "same",
      }),
      row({
        primitive: name,
        variant: "secondary",
        file,
        bg: "button-secondary-bg",
        bgHover: "button-secondary-bg-hover",
        text: ["button-secondary-fg"],
        ui: ["button-secondary-border"],
        ownSurface: true,
        inverse: "light",
      }),
      row({
        primitive: name,
        variant: "ghost",
        file,
        bg: "container",
        bgHover: "button-ghost-bg-hover",
        text: ["button-ghost-fg"],
        ui: ["button-ghost-border"],
        ownSurface: false,
        inverse: "remap",
      }),
      row({
        primitive: name,
        variant: "danger",
        file,
        bg: "button-danger-bg",
        text: ["button-danger-fg"],
        ownSurface: false,
        inverse: "same",
      }),
    ];
  }),
  row({
    primitive: "Button",
    variant: "link",
    file: "button.tsx",
    bg: "container",
    text: ["button-link-fg", "button-link-fg-hover"],
    ownSurface: false,
    inverse: "remap",
  }),
  row({
    primitive: "Card",
    variant: "default",
    file: "card.tsx",
    bg: "card-bg",
    text: ["card-fg", "color-text-muted"],
    ownSurface: true,
    inverse: "light",
  }),
  ...["input.tsx", "textarea.tsx", "select.tsx"].map((file) =>
    row({
      primitive: file.replace(".tsx", ""),
      variant: "default",
      file,
      bg: "field-bg",
      text: ["field-fg", "field-placeholder"],
      ui: ["field-border", "field-border-invalid"],
      ownSurface: true,
      inverse: "light",
    }),
  ),
  row({
    primitive: "Checkbox",
    variant: "label",
    file: "checkbox.tsx",
    bg: "container",
    text: ["color-text"],
    ownSurface: false,
    inverse: "remap",
  }),
  row({
    primitive: "Checkbox",
    variant: "box",
    file: "checkbox.tsx",
    bg: "check-box-bg",
    text: [],
    ui: ["check-box-border", "check-mark"],
    ownSurface: "box",
    inverse: "light",
  }),
  ...(["info", "success", "warning", "danger"] as const).map((t) =>
    row({
      primitive: "Alert",
      variant: t,
      file: "alert.tsx",
      bg: `alert-${t}-bg`,
      text: ["alert-fg", `alert-${t}-accent`],
      ownSurface: true,
      inverse: "light",
    }),
  ),
  row({
    primitive: "Toast",
    variant: "default",
    file: "toast.tsx",
    bg: "toast-bg",
    text: ["toast-fg"],
    ownSurface: true,
    inverse: "n/a",
  }),
  ...Object.keys(BADGE_BG).map((k) =>
    row({
      primitive: "Badge",
      variant: k,
      file: "badge.tsx",
      bg: `badge-${k}-bg`,
      text: [`badge-${k}-fg`],
      ownSurface: true,
      inverse: "light",
    }),
  ),
  row({
    primitive: "Tabs",
    variant: "default",
    file: "tabs.tsx",
    bg: "tabs-bg",
    text: ["tabs-fg", "tabs-fg-selected"],
    ui: ["tabs-indicator"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "Pagination",
    variant: "page",
    file: "pagination.tsx",
    bg: "pagination-bg",
    text: ["pagination-fg"],
    ui: ["pagination-border"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "Pagination",
    variant: "current",
    file: "pagination.tsx",
    bg: "pagination-current-bg",
    text: ["pagination-current-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "Table",
    variant: "body",
    file: "table.tsx",
    bg: "table-bg",
    text: ["table-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "Table",
    variant: "head",
    file: "table.tsx",
    bg: "table-head-bg",
    text: ["table-head-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  // ConfirmDialog kökü Modal'dır; yüzeyi modal.tsx'teki data-surface="default"'tan gelir.
  ...["Modal", "ConfirmDialog"].map((primitive) =>
    row({
      primitive,
      variant: "default",
      file: "modal.tsx",
      bg: "modal-bg",
      text: ["modal-fg", "color-text-muted"],
      ownSurface: true,
      inverse: "n/a",
    }),
  ),
  row({
    primitive: "Avatar",
    variant: "initials",
    file: "avatar.tsx",
    bg: "avatar-bg",
    text: ["avatar-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  // FEAT-002 yeni primitive'leri (design §3.5). Chip ve CostBadge ters kapta remap'lenir.
  row({
    primitive: "Chip",
    variant: "default",
    file: "chip.tsx",
    bg: "chip-bg",
    text: ["chip-fg"],
    ui: ["chip-border"],
    ownSurface: false,
    inverse: "remap",
  }),
  row({
    primitive: "Chip",
    variant: "selected",
    file: "chip.tsx",
    bg: "chip-selected-bg",
    text: ["chip-selected-fg"],
    ownSurface: false,
    inverse: "remap",
  }),
  row({
    primitive: "SegmentedControl",
    variant: "track",
    file: "segmented-control.tsx",
    bg: "segment-bg",
    text: ["segment-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "SegmentedControl",
    variant: "selected",
    file: "segmented-control.tsx",
    bg: "segment-selected-bg",
    text: ["segment-selected-fg"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "BottomSheet",
    variant: "default",
    file: "bottom-sheet.tsx",
    bg: "sheet-bg",
    text: ["color-text"],
    ui: ["sheet-handle"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "CostBadge",
    variant: "default",
    file: "cost-badge.tsx",
    bg: "cost-bg",
    text: ["cost-fg"],
    ownSurface: false,
    inverse: "remap",
  }),
  ...[
    "accordion.tsx",
    "empty-state.tsx",
    "loading-state.tsx",
    "error-state.tsx",
    "breadcrumb.tsx",
    "section.tsx",
  ].map((file) =>
    row({
      primitive: file.replace(".tsx", ""),
      variant: "default",
      file,
      bg: "container",
      text: ["color-text", "color-text-muted"],
      ownSurface: false,
      inverse: "remap",
    }),
  ),
  // FEAT-005 alan bileşeni (plan D2): fiyat sayfası plan kartı kendi kağıt zeminini çizer.
  row({
    primitive: "PlanCard",
    variant: "default",
    file: "../billing/plan-card.tsx",
    bg: "card-bg",
    text: ["card-fg", "color-text-muted"],
    ownSurface: true,
    inverse: "light",
  }),
  // FEAT-006 asistan alan bileşenleri (plan D2, design §4.2). Kart ve composer kendi kağıt
  // zeminini çizer; kullanıcı balonu birincil zeminde (data-surface="inverse", G18) beyaz metin.
  row({
    primitive: "QuestionCard",
    variant: "default",
    file: "../assistant/question-card.tsx",
    bg: "card-bg",
    text: ["card-fg", "color-text-muted"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "ComposerBar",
    variant: "default",
    file: "../assistant/composer-bar.tsx",
    bg: "composer-bg",
    text: ["color-text", "field-placeholder"],
    ui: ["composer-border"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "MessageBubble",
    variant: "assistant",
    file: "../assistant/message-log.tsx",
    bg: "color-surface",
    text: ["color-text", "color-text-muted"],
    ownSurface: true,
    inverse: "light",
  }),
  row({
    primitive: "MessageBubble",
    variant: "user",
    file: "../assistant/message-log.tsx",
    bg: "color-primary",
    text: ["color-on-primary"],
    ownSurface: false,
    inverse: "same",
  }),
];

/** AC-4f kap zeminleri: açık ve koyu (inverse) kapların her biri için üç zemin. */
export const CONTAINER_BACKGROUNDS = {
  light: ["color-surface", "color-bg", "color-surface-sunken"],
  inverse: ["color-surface-inverse", "color-surface-inverse-strong", "color-primary"],
} as const;
